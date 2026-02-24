VERDICT: READY

## Blockers

None. The M2.12 implementation is well-scoped, regression-clean (37 passed), and contract-preserving (no OpenRPC/schema snapshot drift). The critical `file://` URI decode fix is minimal and correct. The demo campaign exercises the required flow (`campaign.init → search.step → eval.run → rank.compute → node.promote`) with fixed-seed replay, and the isomorphism logic covers both positive and negative cases.

## Non-blocking

1. **`unquote` import not shown.** The URI decode fix uses `unquote` from `urllib.parse` — confirm the import is present in `store.py`. If it's missing at module level, it would fail at runtime for any path with percent-encoded characters (e.g., `%20`). Low risk since tests pass, but worth confirming the import line exists.

2. **Manifest schema versioning.** The schema file is `demo_manifest_v1.schema.json` — good. But the manifest JSON itself should carry `"$schema"` or `"manifest_version": "v1"` so downstream tooling can route to the correct validator. If it's already there, great; if not, add a one-line field.

3. **`compare_manifests` path notation.** The JSONPath-style `$.key_results.rank_compute.method` in `first_diff_path` is good, but consider whether array indices (e.g., `$.key_results.new_node_ids[2]`) are handled. If `new_node_ids` is a list and a future diff lands inside it, the path should be unambiguous. This is a nice-to-have for M2.12.

4. **Demo evidence directory is absolute-path-dependent.** The `file:///Users/fkg/Nutstore%20Files/...` URIs in the manifest are machine-specific. For reproducibility across machines (CI, collaborators), consider storing a relative path alongside the absolute `file://` URI, or normalizing to repo-root-relative in the manifest. Not blocking since this is a local demo.

5. **Schema validation error ordering.** `sorted(validator.iter_errors(manifest), key=lambda err: list(err.path))` sorts by path as a list — this works but is fragile for mixed-type path segments (integers vs. strings). Consider `key=lambda err: [str(p) for p in err.path]` for stable sort.

6. **Test coverage for the URI decode fix.** The fix is in `store.py` but the test is in `test_m2_12_demo_replay.py`. Add a focused unit test in `tests/engine/test_store.py` that directly exercises `store.resolve_artifact_ref("file:///path/with%20spaces/foo.json")` → correct `Path`. This isolates the regression from the demo machinery.

## Real-research fit

**Strong.** The fixed-seed replayable demo is exactly what an evidence-first HEP pipeline needs for auditable idea generation:

- **Reproducibility**: Fixed seed + idempotency keys + structural isomorphism checks mean a reviewer can re-run and verify identical outputs. This directly supports the provenance chain required for any physics claim originating from the idea generator.
- **Artifact manifest**: The `demo_manifest.json` with `campaign_id`, `new_node_ids`, ranked nodes, and handoff refs maps naturally to the HEP workflow where you need to trace an idea (e.g., "new effective operator at dimension-8") back through the search/eval/rank pipeline to the evidence that seeded it.
- **Isomorphism as a primitive**: Structural comparison of manifests is the right abstraction for detecting whether a re-run produced semantically identical results. In HEP, this matters when you want to confirm that a parameter scan or model-building suggestion is stable under re-execution (not hallucinated or stochastic drift).
- **Extensibility path**: The `campaign.init → search.step → eval.run → rank.compute → node.promote` flow is HEP-first but domain-agnostic. Swapping the search/eval modules for, say, condensed-matter or cosmology would require changing the domain knowledge injected at `search.step` and `eval.run`, not the orchestration skeleton.

## Robustness & safety

1. **Hallucination mitigation via idempotency**: The fixed-seed + idempotency-key design means the system can detect when an LLM-generated idea is non-deterministic across runs. If `isomorphic=false` on a replay with identical inputs, that's a hallucination/drift signal. This is a strong safety primitive.

2. **Provenance chain**: The manifest captures the full pipeline state — input summaries, intermediate artifact refs, and validation status. This is sufficient for post-hoc audit ("why did the system suggest this anomalous coupling?").

3. **Missing: checksum/hash of artifact contents.** The manifest references artifacts by `file://` URI but doesn't include content hashes (SHA-256). If an artifact file is modified after the run, the manifest won't detect tampering. Add a `sha256` field per artifact ref in the manifest schema.

4. **Missing: budget accounting in manifest.** The goal mentions "budget/accounting behavior" but the manifest schema and demo outputs don't show token/cost accounting. If the budget is tracked internally but not surfaced in the manifest, add a `budget_summary` section (`tokens_used`, `api_calls`, `wall_time_s`).

5. **Error path for schema validation.** The code collects validation errors via `iter_errors` but the review bundle doesn't show what happens when validation fails. Confirm that the runner exits non-zero (or raises) on schema validation failure, rather than silently producing an invalid manifest.

## Specific patch suggestions

### Patch 1: Add content hash to manifest schema

**File:** `src/idea_core/demo/schemas/demo_manifest_v1.schema.json`

In the `artifact_ref` object (or wherever artifact URIs appear), add:

```json
"artifact_ref": {
  "type": "object",
  "properties": {
    "uri": { "type": "string", "format": "uri" },
    "sha256": { "type": "string", "pattern": "^[a-f0-9]{64}$" }
  },
  "required": ["uri", "sha256"]
}
```

**File:** `src/idea_core/demo/m2_12_replay.py`

After writing each artifact file, compute and embed the hash:

```python
import hashlib

def _hash_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()
```

### Patch 2: Add focused URI-decode unit test

**File:** `tests/engine/test_store.py` (new or append)

```python
def test_resolve_artifact_ref_with_percent_encoded_spaces(tmp_path):
    target = tmp_path / "sub dir" / "artifact.json"
    target.parent.mkdir()
    target.write_text("{}")
    encoded_uri = (tmp_path / "sub%20dir" / "artifact.json").as_uri()
    # Or construct manually:
    from urllib.parse import quote
    encoded_uri = "file://" + quote(str(target))
    resolved = store.resolve_artifact_ref(encoded_uri)
    assert resolved == target.resolve()
```

### Patch 3: Add `manifest_version` field to manifest output

**File:** `src/idea_core/demo/m2_12_replay.py`

At manifest construction, add:

```python
manifest["manifest_version"] = "v1"
```

**File:** `src/idea_core/demo/schemas/demo_manifest_v1.schema.json`

Add to `required` and `properties`:

```json
"manifest_version": { "type": "string", "const": "v1" }
```

### Patch 4: Surface budget accounting in manifest

**File:** `src/idea_core/demo/m2_12_replay.py`

After the campaign completes, add:

```python
manifest["budget_summary"] = {
    "total_steps": len(campaign.steps),
    "wall_time_s": round(elapsed, 3),
    # If token tracking is available:
    # "tokens_used": campaign.budget.tokens_used,
}
```

### Patch 5: Add relative path to manifest artifact refs

**File:** `src/idea_core/demo/m2_12_replay.py`

Where artifact URIs are written to the manifest, also include:

```python
import os

def _artifact_entry(abs_path: Path, repo_root: Path) -> dict:
    return {
        "uri": abs_path.as_uri(),
        "relative_path": str(abs_path.relative_to(repo_root)),
        "sha256": _hash_file(abs_path),
    }
```

This makes manifests portable across machines while preserving the absolute URI for local resolution.
