VERDICT: READY

## Blockers

None. The M1.5 scope is well-contained, the acceptance criteria are concrete and met (46 tests pass, `make validate` green, drift fail-fast demonstrated), and the design correctly treats the bundled artifact as a derived tooling product rather than a new SSOT.

## Non-blocking

1. **Bundle determinism is under-specified.** The review packet says "bundled file与实时生成结果完全一致" — but JSON key ordering, whitespace, and floating-point serialization can differ across Python versions or `json.dumps` settings. Recommend pinning `sort_keys=True, indent=2` in `bundle.py` and documenting the canonical serialization in `CONTRACT_SOURCE.json`.

2. **`$ref` rewriting scope.** The description says refs are rewritten to `#/components/schemas/*`, but OpenRPC methods can also `$ref` into `#/components/contentDescriptors/*`, `#/components/examples/*`, etc. If today's schema only uses `schemas`, that's fine — but add a guard/assertion in `bundle.py` that fails loudly if an unhandled `$ref` target prefix is encountered, rather than silently dropping it.

3. **CI cache / artifact upload.** The `.github/workflows/ci.yml` runs `make validate` + `pytest`, but the packet doesn't mention caching `pip install` or uploading the bundled JSON as a CI artifact. Non-blocking, but helpful for debugging future drift failures in CI.

4. **`sync_contracts_snapshot.sh` error handling.** The script "在同步后自动生成 bundled 产物" — confirm it uses `set -euo pipefail` and that a failed bundle generation propagates a non-zero exit code. Silent failures here would undermine the entire drift-detection chain.

5. **Test isolation for `test_validate_fails_on_bundle_drift`.** If this test mutates the on-disk bundled file and a parallel test runner reads it, you get flaky tests. Confirm the test writes to a `tmp_path` fixture copy, not the repo's actual artifact.

## Real-research fit

The design is appropriate for an evidence-first HEP ecosystem:

- **Provenance chain intact.** The bundled artifact carries `x-bundle-note` provenance and `CONTRACT_SOURCE.json` traces back to the canonical OpenRPC + schemas. This means downstream agents (e.g., a `hepar` orchestrator or a `research-team` convergence gate) can always verify which contract version they are validating against.

- **No semantic drift.** The explicit exclusion of changes to `idea_core_rpc_v1.openrpc.json` and `*.schema.json` means the physics-facing contract (idea proposals, evidence payloads, novelty metadata) is untouched. This is correct for M1.5.

- **Extensibility to broader physics.** Because the bundle is mechanically derived, adding new RPC methods (e.g., for cosmology or condensed-matter idea generation) only requires editing the SSOT schemas — the bundle pipeline propagates automatically. No rewrite needed.

- **One concern for real use:** The drift check compares byte-for-byte equality of the full bundled JSON. In a real multi-contributor HEP team, someone running `make bundle-contracts` on a different OS/Python might produce a semantically identical but byte-different file. Consider adding a semantic-equivalence fallback (deep JSON compare) that triggers only when byte compare fails, to produce a more informative diff.

## Robustness & safety

| Aspect | Assessment |
|---|---|
| **Hallucination mitigation** | The bundle is mechanically generated from SSOT sources with a closed `$ref` resolution — no LLM is in the loop for contract generation. Good. |
| **Fail-fast** | Drift detection is fail-fast in `validate.py`. The error message should include a diff snippet (first divergent key path), not just "drift detected". |
| **Reproducibility** | The drift-repro log (`2026-02-13-m1.5-bundle-drift-repro-v1.txt`) documents a manual tamper → fail → rebundle → pass cycle. This is a good regression artifact. |
| **CI gating** | `make validate` in CI means no PR can land with a stale bundle. Correct. |
| **No SSOT pollution** | `x-bundle-note` + exclusion rules prevent the bundle from being treated as authoritative. Confirm that `validate.py` also asserts the presence of `x-bundle-note` in the bundled file as a structural invariant. |

## Specific patch suggestions

### 1. `src/idea_core/contracts/bundle.py` — Pin deterministic serialization

```python
# Near the top of generate_bundle() or wherever the final JSON is written:
import json

def write_bundle(bundle_dict: dict, output_path: Path) -> None:
    """Write bundle with deterministic serialization."""
    output_path.write_text(
        json.dumps(bundle_dict, sort_keys=True, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
```
**Why:** Prevents platform-dependent byte differences from causing false drift failures.

---

### 2. `src/idea_core/contracts/bundle.py` — Guard unhandled `$ref` prefixes

```python
_HANDLED_REF_PREFIXES = (
    "#/components/schemas/",
    # Add more as the contract grows:
    # "#/components/contentDescriptors/",
)

def _rewrite_ref(ref: str) -> str:
    if ref.startswith("#/"):
        return ref  # already internal
    # External file ref → rewrite
    resolved_prefix = _resolve_to_component_path(ref)
    if not resolved_prefix.startswith(_HANDLED_REF_PREFIXES):
        raise ValueError(
            f"Unhandled $ref target prefix: {ref!r} → {resolved_prefix!r}. "
            "Add support in bundle.py before proceeding."
        )
    return resolved_prefix
```
**Why:** Prevents silent `$ref` drops when future schemas add content descriptors or examples.

---

### 3. `src/idea_core/contracts/validate.py` — Enhance drift error message with diff

```python
import json
from difflib import unified_diff

def _check_bundle_consistency(bundled_path: Path, regenerated: dict) -> list[str]:
    errors = []
    existing = bundled_path.read_text(encoding="utf-8")
    expected = json.dumps(regenerated, sort_keys=True, indent=2, ensure_ascii=False) + "\n"
    if existing != expected:
        diff_lines = list(unified_diff(
            existing.splitlines(keepends=True),
            expected.splitlines(keepends=True),
            fromfile="on-disk bundle",
            tofile="regenerated bundle",
            n=3,
        ))
        # Show first 40 diff lines to keep output readable
        snippet = "".join(diff_lines[:40])
        errors.append(
            f"Bundle artifact drift detected.\n"
            f"Run `make bundle-contracts` to regenerate.\n"
            f"Diff (first 40 lines):\n{snippet}"
        )
    return errors
```
**Why:** "drift detected" alone forces the developer to manually diff. Showing the first divergent lines makes the error immediately actionable.

---

### 4. `src/idea_core/contracts/validate.py` — Assert `x-bundle-note` presence

```python
def _check_bundle_structure(bundle: dict) -> list[str]:
    errors = []
    # ... existing shape checks ...
    if "x-bundle-note" not in bundle.get("info", {}):
        errors.append(
            "Bundled artifact missing 'info.x-bundle-note'. "
            "This field is required to mark the file as a derived artifact."
        )
    return errors
```
**Why:** Structural invariant that prevents the bundle from being confused with the SSOT.

---

### 5. `tests/contracts/test_bundle_contracts.py` — Ensure test isolation via `tmp_path`

```python
def test_validate_fails_on_bundle_drift(tmp_path):
    """Drift detection must use a tmp copy, not the repo artifact."""
    import shutil
    repo_bundle = CONTRACTS_DIR / "idea_core_rpc_v1.bundled.json"
    test_bundle = tmp_path / "idea_core_rpc_v1.bundled.json"
    shutil.copy2(repo_bundle, test_bundle)

    # Tamper
    data = json.loads(test_bundle.read_text())
    data["info"]["title"] = "TAMPERED"
    test_bundle.write_text(json.dumps(data, sort_keys=True, indent=2) + "\n")

    errors = run_validation(bundle_path=test_bundle, check_bundle=True)
    assert any("drift" in e.lower() for e in errors)
```
**Why:** Avoids flaky tests under parallel execution and avoids dirtying the working tree.

---

### 6. `scripts/sync_contracts_snapshot.sh` — Add strict mode

```bash
#!/usr/bin/env bash
set -euo pipefail  # <-- confirm this is present at line 2

# ... existing sync logic ...

echo ">>> Regenerating bundled artifact..."
python -m idea_core.contracts.bundle || {
    echo "ERROR: bundle generation failed. Aborting sync." >&2
    exit 1
}
```
**Why:** Ensures a failed bundle generation halts the script rather than leaving a stale artifact.

---

### 7. `contracts/idea-generator-snapshot/CONTRACT_SOURCE.json` — Add bundle provenance field

```json
{
  "ssot": "contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.openrpc.json",
  "bundled_artifact": "contracts/idea-generator-snapshot/schemas/idea_core_rpc_v1.bundled.json",
  "bundle_generator": "src/idea_core/contracts/bundle.py",
  "bundle_note": "Derived artifact. Regenerate via `make bundle-contracts`. Do not hand-edit."
}
```
**Why:** Closes the provenance loop — anyone inspecting `CONTRACT_SOURCE.json` can trace both the SSOT and the derived bundle back to the generator code.
