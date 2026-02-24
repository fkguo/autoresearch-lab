VERDICT: READY

## Blockers

No blockers remain. The four v1 blockers (B1–B4) are credibly closed:

- **B1 (source context)**: Full source excerpts provided for all five files.
- **B2 (evidence packet contract)**: `librarian_evidence_packet_v1.schema.json` is present, `Draft202012Validator` is used in tests.
- **B3 (provenance metadata)**: `api_source`, `api_query`, `raw_response_hash`, `retrieval_timestamp`, `summary_source` all present in schema and code.
- **B4 (relevance semantics)**: `relevance_policy: "template_prior_v1"` is a schema `const`, and `relevance` is bounded `[0, 1]`.

No new blockers identified.

## Non-blocking

### N1. `raw_response_hash` is a synthetic hash, not an actual API response hash

`LibrarianRecipeTemplate.render()` computes `raw_response_hash = sha256(provider + '|' + query + '|' + summary)`. This hashes the *template expansion*, not any actual HTTP response body. The field name `raw_response_hash` implies it's hashing a real upstream response. This is acceptable for the M3.3 template-prior phase (no live API calls), but:

- **Recommendation**: Rename to `template_expansion_hash` or add a `hash_source: "template_expansion"` discriminator field to the recipe object so that when M4+ introduces live INSPIRE/PDG HTTP calls, consumers can distinguish synthetic from real provenance hashes without a breaking contract change.

### N2. `summary_source` is locked to `const: "template"` in schema

The schema enforces `"summary_source": { "const": "template" }`. When live retrieval lands, this will require a schema version bump. Consider relaxing to `"enum": ["template", "api", "llm_extract"]` now to avoid a breaking v2 schema.

### N3. `provider` enum is closed to `["INSPIRE", "PDG"]`

Same issue: adding arXiv, HEPData, or Zotero later forces a schema version bump. An `"additionalProperties": false` + closed enum is good for safety, but consider whether a `"pattern": "^[A-Z][A-Z0-9_]{1,31}$"` regex constraint gives you extensibility without sacrificing validation strength.

### N4. `campaign_id` format is `"uuid"` in schema but `build_packet` receives it as `str`

No runtime validation in `build_packet` ensures the `campaign_id` is actually a UUID. If a caller passes a non-UUID `campaign_id`, the packet will be written but fail schema validation only if a downstream consumer re-validates. Consider adding an early `uuid.UUID(campaign_id)` guard in `build_packet`.

### N5. Evidence packet artifact path uses `Path.resolve().as_uri()`

```python
evidence_packet_ref = self.store.artifact_path(
    campaign_id, "evidence_packets", evidence_packet_name,
).resolve().as_uri()
```

`Path.as_uri()` produces `file:///...` URIs that are machine-local. This is fine for local-first single-machine campaigns but will break in distributed/cloud artifact stores. Flag as a known limitation for M4+.

### N6. `_compact_text` silently degrades empty/non-string values

```python
def _compact_text(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
```

If `operator_output.claim_text` is `None` or empty, the query template will contain fallback text like `"candidate claim"`, producing a meaningless INSPIRE query. This is benign for template-prior but should log a warning so operators with missing claim text are surfaced during development.

### N7. Deduplication is URI-string-exact, not normalized

`_dedupe_uris` uses exact string comparison. URLs differing only by trailing slash, query parameter order, or encoding will not be deduped. Acceptable for M3.3 since all URIs are template-generated (deterministic), but note for live retrieval.

### N8. `DomainPackAssets.librarian_recipes` default factory on frozen dataclass

```python
librarian_recipes: LibrarianRecipeBook = field(default_factory=build_default_librarian_recipe_book)
```

This is correct for `dataclasses.field(default_factory=...)` on a `frozen=True` dataclass, but it means every `DomainPackAssets` that doesn't explicitly pass `librarian_recipes` constructs a full recipe book. The `hep.default` and `hep.operators.v1` packs in `domain_pack.py` both use the default factory — this is intentional but means they share identical recipe books. If operator-family-specific packs are meant to have tailored recipes, the `hep.operators.v1` loader should explicitly pass a customized recipe book.

### N9. Test coverage gap: no negative/edge-case tests

`test_retrieval_recipes_m33.py` has a single happy-path test. Missing:
- Unknown operator family → fallback template path
- Empty `claim_text` / `hypothesis` → fallback rendering
- Schema validation failure injection (e.g., tampered packet)
- Idempotency replay of `search.step` with librarian artifacts

These are not M3.3-blocking but should be added before M3.4.

## Real-research fit

**Strengths:**

1. **Template-prior approach is sound for bootstrapping.** In real HEP research workflows, before you query INSPIRE live, you need to know *what* to query. The `LibrarianRecipeTemplate` pattern encodes domain knowledge about which query patterns are relevant for anomaly-abduction vs. symmetry-selection-rule vs. limit-regime problems. This mirrors how experienced physicists mentally construct INSPIRE queries.

2. **Operator-family dispatch is well-matched to HEP research patterns.** The three families (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`) cover the main cognitive modes in BSM phenomenology. The query templates (e.g., `primarch:{domain} AND fulltext:"{claim_text}" AND fulltext:"anomaly"`) use real INSPIRE query syntax — `primarch` is actually `primarch` in INSPIRE's SPIRES-era syntax (though the modern API uses `arxiv_categories`; see patch suggestion below).

3. **Evidence-packet-as-artifact is a good architectural choice.** Writing packets to `artifacts/evidence_packets/` with schema validation creates an audit trail that's essential for reproducible physics research. The `evidence_packet_ref` in `operator_events` enables replay and third-party verification.

4. **PDG integration via query templates is forward-looking.** PDG's search endpoint is less API-friendly than INSPIRE, but the template pattern will adapt well when PDG's programmatic API matures.

**Concerns for real use:**

- The INSPIRE query templates use `primarch:` which is legacy SPIRES syntax. Modern INSPIRE API (`api.inspirehep.net/api/literature`) uses `arxiv_categories` for category filtering. The landing URIs correctly point to `inspirehep.net/literature?...` but the query string format may not return useful results on the actual INSPIRE search frontend.
- Relevance scores are static template priors (0.80–0.92), which is honest but means the system cannot yet distinguish high-quality evidence from noise. The `relevance_policy: "template_prior_v1"` field correctly signals this limitation.

## Robustness & safety

1. **Hallucination mitigation**: The `summary_source: "template"` field is a critical safety signal — it tells downstream consumers that summaries are template-generated, not LLM-hallucinated. This is exactly the right approach. When live retrieval is added, summaries extracted by LLMs should carry `summary_source: "llm_extract"` with a separate confidence score.

2. **Provenance chain**: `raw_response_hash` → `recipe_id` → `evidence_packet_ref` → `claim.evidence_uris` provides a complete provenance chain from recipe template to idea card. This is auditable.

3. **Schema strictness**: `additionalProperties: false` at all levels prevents schema drift. Combined with `Draft202012Validator` in tests, this catches contract violations early.

4. **Thread safety**: `DomainPackIndex` uses `threading.Lock()` for cache access. `search_step` operates under `store.mutation_lock(campaign_id)`. No race conditions visible.

5. **Missing safety**: No rate-limiting or circuit-breaker pattern for when live INSPIRE/PDG calls are added. The template-prior phase doesn't need this, but the `LibrarianRecipeBook.build_packet` interface should be designed to accept an `async` HTTP client in M4+.

6. **No injection risk in current design**: Query templates use Python `str.format()` with controlled `fields` dict keys. Since there are no live API calls, there's no injection surface. When live HTTP calls are added, the `query` string must be parameterized, not interpolated into raw URLs.

## Specific patch suggestions

### Patch 1: `src/idea_core/engine/schemas/librarian_evidence_packet_v1.schema.json`

**What to change**: Relax `summary_source` and add `hash_source` discriminator to future-proof the schema without a v2 bump.

```json
// In recipes[].items.properties.hits[].items.properties:
// CHANGE:
"summary_source": { "const": "template" }
// TO:
"summary_source": { "enum": ["template", "api", "llm_extract"] }

// In recipes[].items.properties, ADD after "raw_response_hash":
"hash_basis": {
  "type": "string",
  "enum": ["template_expansion", "http_response_body"],
  "default": "template_expansion"
}
```

Also add `"hash_basis"` to the recipe's `required` array.

### Patch 2: `src/idea_core/engine/retrieval.py` — INSPIRE query syntax fix

**What to change**: Replace `primarch:` with the working INSPIRE search syntax.

```python
# In build_default_librarian_recipe_book(), for ALL INSPIRE templates:
# CHANGE:
query_template='primarch:{domain} AND fulltext:"{claim_text}" AND fulltext:"anomaly"',
# TO:
query_template='find a {domain} and t "{claim_text}" and t "anomaly"',
# OR (modern INSPIRE REST API style):
query_template='arxiv_categories:{domain} AND "{claim_text}" AND "anomaly"',
```

Apply analogously to `inspire.symmetry_selection_rules.v1`, `inspire.limit_regime.v1`, and `inspire.generic.hep.v1`.

### Patch 3: `src/idea_core/engine/retrieval.py` — Add warning for fallback text

**What to change**: Add logging when `_compact_text` returns fallback.

```python
import logging

_log = logging.getLogger(__name__)

def _compact_text(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        _log.warning("_compact_text: non-string value %r, using fallback %r", type(value).__name__, fallback)
        return fallback
    compact = " ".join(value.split())
    if not compact:
        _log.warning("_compact_text: empty string, using fallback %r", fallback)
        return fallback
    return compact
```

### Patch 4: `src/idea_core/engine/retrieval.py` — Add `hash_basis` to rendered recipe

**What to change**: In `LibrarianRecipeTemplate.render()`, add `hash_basis` field.

```python
# After the raw_response_hash line, add to the returned dict:
"hash_basis": "template_expansion",
```

### Patch 5: `tests/engine/test_retrieval_recipes_m33.py` — Add fallback-template and edge-case tests

**What to change**: Add two test functions after the existing test.

```python
def test_m3_3_unknown_operator_family_uses_default_templates(tmp_path: Path) -> None:
    """Operator families not in the recipe book should fall back to default templates."""
    from idea_core.engine.retrieval import build_default_librarian_recipe_book
    from idea_core.engine.operators import OperatorOutput

    book = build_default_librarian_recipe_book()
    output = OperatorOutput(
        operator_id="test.unknown_family",
        operator_family="UnknownFamilyXYZ",
        backend_id="test",
        hypothesis="some hypothesis",
        claim_text="some claim",
        rationale_title="title",
        rationale="rationale",
        evidence_uris_used=[],
        trace_inputs={},
        trace_params={},
    )
    packet = book.build_packet(
        campaign_id="00000000-0000-0000-0000-000000000000",
        step_id="00000000-0000-0000-0000-000000000001",
        tick=1,
        island_id="island-0",
        operator_output=output,
        domain="hep-ph",
        formalism_id="hep/toy",
        generated_at="2026-02-13T00:00:00Z",
    )
    assert len(packet["recipes"]) == 2
    assert packet["recipes"][0]["recipe_id"] == "inspire.generic.hep.v1"
    assert packet["recipes"][1]["recipe_id"] == "pdg.generic.hep.v1"


def test_m3_3_claim_evidence_uris_deduplication() -> None:
    """Duplicate URIs across packet and operator evidence should be deduped."""
    from idea_core.engine.retrieval import LibrarianRecipeBook

    shared_uri = "https://inspirehep.net/literature?sort=mostrecent&q=test"
    packet_payload = {
        "evidence_items": [
            {"uri": shared_uri},
            {"uri": "https://pdg.lbl.gov/search?query=test"},
        ]
    }
    result = LibrarianRecipeBook.claim_evidence_uris(
        packet_ref="file:///artifacts/packet.json",
        packet_payload=packet_payload,
        operator_evidence_uris=[shared_uri, "https://example.org/other"],
    )
    assert result == [
        "file:///artifacts/packet.json",
        shared_uri,
        "https://pdg.lbl.gov/search?query=test",
        "https://example.org/other",
    ]
```

### Patch 6: `src/idea_core/engine/domain_pack.py` — Explicit recipe book for `hep.operators.v1`

**What to change**: Make the operator-families pack's recipe book assignment explicit rather than relying on default factory, to signal intentionality and enable future customization.

```python
# In the hep.operators.v1 lambda loader:
# CHANGE:
loader=lambda: DomainPackAssets(
    pack_id="hep.operators.v1",
    ...
    search_operators=hep_operator_families_m32(),
    operator_selection_policy="island_index_v1",
),
# TO:
loader=lambda: DomainPackAssets(
    pack_id="hep.operators.v1",
    ...
    search_operators=hep_operator_families_m32(),
    librarian_recipes=build_default_librarian_recipe_book(),
    operator_selection_policy="island_index_v1",
),
```

This is a no-op functionally but makes the dependency explicit in code.
