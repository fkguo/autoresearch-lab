VERDICT: NOT_READY

## Blockers

1. **No source files provided for review.** The review bundle references four implementation files (`src/idea_core/engine/retrieval.py`, `src/idea_core/engine/domain_pack.py`, `src/idea_core/engine/service.py`, `tests/engine/test_retrieval_recipes_m33.py`) and two evidence logs, but **none of their contents are included in the packet**. I cannot verify acceptance criteria, assess safety properties, or propose concrete patches without seeing the actual code and test bodies. This is a hard blocker for any meaningful architectural review.

2. **Evidence packet schema is unspecified.** The bundle describes a payload shape (`recipes[]`, `evidence_items[]` with `uri`, `summary`, `relevance`) but provides no formal JSON Schema, Pydantic model, or artifact contract definition. Without a versioned schema:
   - Downstream consumers (the idea-card builder, claim enrichment, audit replay) have no compile-time or validation-time guarantee of shape.
   - There is no migration path when the schema evolves (e.g., adding `confidence`, `retrieval_timestamp`, `source_api_version`).
   - Hallucination-mitigation audits cannot structurally distinguish a fabricated evidence item from a legitimate one.

3. **No provenance metadata on evidence items.** The described `evidence_items[]` structure (`uri`, `summary`, `relevance`) is missing critical provenance fields:
   - `retrieval_timestamp` — when was this fetched?
   - `api_source` and `api_query` — exact query sent to INSPIRE/PDG, for reproducibility.
   - `raw_response_hash` — content-addressable fingerprint of the upstream API response.
   - `summary_source` — was `summary` extracted from the API response or LLM-generated? This is a **hallucination-critical** distinction.
   
   Without these, the evidence chain is not auditable and the system cannot distinguish real retrieval from fabricated evidence.

4. **`relevance` field semantics undefined.** Is this a float score? An enum? LLM-generated text? Who computes it—the retrieval recipe, the operator, or the LLM? Without clear semantics and bounded typing, this field is a hallucination surface.

## Non-blocking

1. **Recipe template parameterization mechanism unclear.** The bundle says templates exist "per operator family" with a "generic fallback," but doesn't describe the interpolation mechanism. Recommend explicit Jinja2-style or f-string templates with a declared parameter schema per template, so that invalid parameterizations fail loudly rather than producing malformed queries.

2. **Evidence deduplication across ticks.** If multiple operator ticks query INSPIRE for overlapping results, the same paper URI may appear in multiple evidence packets. The `evidence_uris` list on claims should be deduplicated (set semantics) with earliest-retrieval-wins provenance. Not blocking but will cause noise in downstream consumption.

3. **`DomainPackAssets.librarian_recipes` mutability.** If the default recipe book is a mutable singleton on the domain pack, concurrent operators sharing the pack could observe or mutate shared state. Recommend the pack expose a factory method (`get_recipe_book() -> LibrarianRecipeBook`) that returns a fresh or frozen copy.

4. **Test coverage gap: network failure / empty results.** The TDD log shows red→green for the happy path (`missing evidence_packet_ref`). There should also be tests for:
   - INSPIRE/PDG returning 0 hits → evidence packet still written with `evidence_items: []`, claims get no new URIs.
   - Network timeout / HTTP error → graceful degradation, error recorded in packet, operator tick not poisoned.
   - Malformed API response → validation error caught, logged, packet marked as `status: "error"`.

5. **Artifact path convention.** `artifacts/evidence_packets/<step>-tick-XXX-librarian.json` uses a tick counter (`XXX`). Clarify whether this is zero-padded, monotonic across steps, and whether concurrent ticks within a step can collide. Recommend including a UUID or content hash suffix for collision-freedom.

## Real-research fit

**Strengths:**
- Tying retrieval directly to operator families (`AnomalyAbduction`, `SymmetryOperator`, `LimitExplorer`) is the right abstraction—different physics reasoning modes genuinely require different literature search strategies (anomaly-driven searches focus on experimental discrepancies; symmetry operators need group-theory classification papers; limit explorers need exclusion-limit databases).
- Writing evidence packets as artifacts (not just in-memory) is essential for HEP audit culture where referees expect reproducible citation trails.
- Injecting `evidence_packet_ref` into `operator_events` enables replay, which is critical for debugging multi-agent runs.

**Gaps for real HEP use:**
- **INSPIRE search quality.** INSPIRE's API supports structured queries (`find a author and t title and k keywords`) vs. free-text. The recipe templates must use INSPIRE's structured syntax, not just dump natural language into the search endpoint. Otherwise hit quality will be poor and researchers will lose trust immediately.
- **PDG integration specificity.** PDG data is structured (particle properties, branching ratios, mass limits), not document-oriented. The "recipe template" abstraction (query → hits with URIs) may not fit PDG well. PDG lookups should return structured data (e.g., `{"particle": "H0", "mass": "125.25 ± 0.17 GeV", "pdg_id": "S126"}`) rather than document-style evidence items. Consider a `StructuredDataEvidence` variant alongside `DocumentEvidence`.
- **arXiv cross-referencing.** INSPIRE records link to arXiv IDs. The evidence items should normalize URIs to canonical arXiv IDs (`arXiv:YYMM.NNNNN`) when available, enabling deduplication against the researcher's existing bibliography and future `zotero-import` integration.
- **Citation graph depth.** A single INSPIRE query returns direct hits. Real physics discovery often requires following citation chains (paper A cites B which cites C where the key insight lives). The recipe architecture should have an explicit extension point for multi-hop retrieval without requiring it now.

## Robustness & safety

1. **Hallucination surface: LLM-generated summaries.** If `summary` in evidence items is LLM-generated from titles/abstracts, it must be flagged as such (`"summary_type": "llm_generated"` vs `"api_extracted"`). An LLM can fabricate plausible-sounding physics claims about a paper that don't match its actual content. This is the single highest-risk hallucination vector in the entire retrieval pipeline.

2. **Hallucination surface: fabricated URIs.** If the LLM is involved in constructing INSPIRE/PDG queries or processing results, it may hallucinate paper identifiers. All URIs in evidence items must be **validated against the raw API response**. Recommend a `raw_hits_hash` field on the recipe result and a post-hoc validator that confirms every `uri` in `evidence_items` appears in the raw response.

3. **Novelty check interaction.** Evidence packets feed into `idea_card.claims[].evidence_uris`, which downstream novelty checkers will use. If the novelty checker sees a claim "supported by" 5 INSPIRE papers, it must distinguish between "these papers exist and were retrieved" and "these papers actually support this specific claim." The `relevance` field is doing too much work here—consider splitting into `retrieval_relevance` (query-result match quality) and `claim_support_strength` (how strongly this evidence supports the specific claim), with the latter requiring explicit LLM reasoning that is itself auditable.

4. **Rate limiting and API abuse.** INSPIRE and PDG have rate limits. The retrieval recipes must include rate-limiting logic or delegate to a shared rate limiter. Multiple operators ticking in parallel could easily exceed INSPIRE's courtesy limits, leading to IP bans that would break the entire pipeline.

5. **Determinism for replay.** Evidence packet artifacts must be sufficient for full replay without re-querying APIs. This means the packet must store the complete raw response (or a content-addressed reference to it), not just the processed evidence items. Otherwise "replay" is not truly deterministic.

## Specific patch suggestions

> **Note:** Since source files were not provided, these patches are structural specifications rather than line-level diffs. Once source files are shared, I will provide exact line edits.

### Patch 1: `src/idea_core/engine/retrieval.py` — Add versioned evidence packet schema

```python
# Add at module level, before LibrarianRecipeTemplate

from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime
import hashlib

EVIDENCE_PACKET_SCHEMA_VERSION = "0.3.3"  # tracks M3.3

class EvidenceItem(BaseModel):
    uri: str  # Canonical: arXiv:YYMM.NNNNN or INSPIRE recid or PDG id
    uri_type: Literal["arxiv", "inspire_recid", "pdg_entry", "doi", "other"]
    summary: str
    summary_source: Literal["api_abstract", "api_title", "llm_generated"]
    relevance_score: float = Field(ge=0.0, le=1.0)
    relevance_rationale: str  # one-sentence justification, auditable

class RecipeResult(BaseModel):
    template_id: str
    operator_family: str
    query_rendered: str          # exact query string sent to API
    api_endpoint: str            # e.g. "https://inspirehep.net/api/literature"
    raw_response_hash: str       # SHA-256 of raw JSON response bytes
    hit_count: int
    evidence_items: list[EvidenceItem]

class EvidencePacket(BaseModel):
    schema_version: str = EVIDENCE_PACKET_SCHEMA_VERSION
    step: str
    tick: int
    retrieval_timestamp: datetime
    operator_id: str
    recipes: list[RecipeResult]
    evidence_items: list[EvidenceItem]  # flattened across recipes, deduplicated by uri
    status: Literal["ok", "partial", "error"]
    error_detail: str | None = None
```

**Why:** This makes the contract machine-verifiable. Downstream consumers import the model. Schema version enables migration.

### Patch 2: `src/idea_core/engine/retrieval.py` — Add raw response hashing and URI validation

```python
# Inside the retrieval execution method (wherever API calls are made):

import hashlib

def _execute_query(self, endpoint: str, query: str) -> tuple[dict, str]:
    """Returns (parsed_response, sha256_hash_of_raw_bytes)."""
    raw_bytes = self._http_client.get(endpoint, params={"q": query}).content
    raw_hash = hashlib.sha256(raw_bytes).hexdigest()
    parsed = json.loads(raw_bytes)
    return parsed, raw_hash

def _validate_uris_against_raw(
    self, evidence_items: list[EvidenceItem], raw_response: dict
) -> list[EvidenceItem]:
    """Drop any evidence item whose URI doesn't appear in raw API response."""
    raw_uris = self._extract_uris_from_raw(raw_response)
    validated = []
    for item in evidence_items:
        if item.uri in raw_uris:
            validated.append(item)
        else:
            logger.warning(f"Dropping fabricated URI {item.uri} not in raw response")
    return validated
```

**Why:** This is the primary anti-hallucination gate for fabricated references.

### Patch 3: `src/idea_core/engine/domain_pack.py` — Recipe book factory, not singleton

```diff
 class DomainPackAssets:
-    librarian_recipes: LibrarianRecipeBook = default_recipe_book()
+    _recipe_book_factory: Callable[[], LibrarianRecipeBook] = default_recipe_book
+
+    def get_recipe_book(self) -> LibrarianRecipeBook:
+        """Return a fresh recipe book instance. Thread-safe for concurrent operators."""
+        return self._recipe_book_factory()
```

**Why:** Prevents shared mutable state between concurrent operator ticks.

### Patch 4: `src/idea_core/engine/service.py` — Normalize arXiv URIs in claim injection

```python
# In the method that injects URIs into idea_card.claims[].evidence_uris:

import re

_ARXIV_PATTERN = re.compile(r'arxiv\.org/abs/(\d{4}\.\d{4,5})')

def _normalize_uri(uri: str) -> str:
    """Canonicalize to arXiv:YYMM.NNNNN when possible."""
    m = _ARXIV_PATTERN.search(uri)
    if m:
        return f"arXiv:{m.group(1)}"
    return uri

# In the injection loop:
existing = set(claim.evidence_uris)
for uri in new_uris:
    canonical = _normalize_uri(uri)
    if canonical not in existing:
        claim.evidence_uris.append(canonical)
        existing.add(canonical)
```

**Why:** Deduplication and interoperability with bibliography tools (Zotero, BibTeX).

### Patch 5: `tests/engine/test_retrieval_recipes_m33.py` — Add failure-mode tests

```python
# Add these test cases:

def test_evidence_packet_on_zero_hits(mock_inspire_empty_response, engine):
    """Evidence packet is still written with empty items on 0 hits."""
    result = engine.search_step(...)
    packet = load_evidence_packet(result.evidence_packet_ref)
    assert packet.status == "ok"
    assert packet.evidence_items == []
    assert packet.recipes[0].hit_count == 0

def test_evidence_packet_on_network_error(mock_inspire_timeout, engine):
    """Network failure produces error packet, does not crash operator tick."""
    result = engine.search_step(...)
    packet = load_evidence_packet(result.evidence_packet_ref)
    assert packet.status == "error"
    assert "timeout" in packet.error_detail.lower()
    # Operator tick still completes
    assert result.operator_events[-1].status != "crashed"

def test_fabricated_uri_dropped(mock_inspire_response, engine, monkeypatch):
    """URIs not in raw API response are dropped from evidence items."""
    # Inject a fabricated URI into the LLM's processing output
    ...
    packet = load_evidence_packet(result.evidence_packet_ref)
    uris = [item.uri for item in packet.evidence_items]
    assert "arXiv:9999.99999" not in uris  # fabricated

def test_evidence_packet_schema_version(engine):
    """Packet carries schema version for downstream migration."""
    result = engine.search_step(...)
    packet = load_evidence_packet(result.evidence_packet_ref)
    assert packet.schema_version == "0.3.3"
```

**Why:** The TDD log only shows happy-path red→green. Failure modes are where hallucination and data corruption actually happen in production.

### Patch 6: `docs/` — Add evidence packet schema spec

Create `docs/schemas/evidence-packet-v0.3.3.md`:

```markdown
# Evidence Packet Schema v0.3.3 (M3.3)

## Purpose
Artifact contract for Librarian retrieval evidence packets.

## Canonical path
`artifacts/evidence_packets/<step>-tick-<NNN>-librarian.json`

## Schema (Pydantic source of truth)
`src/idea_core/engine/retrieval.py::EvidencePacket`

## Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| schema_version | str | ✓ | Semver, currently "0.3.3" |
| step | str | ✓ | Search step identifier |
| tick | int | ✓ | Operator tick number within step |
| retrieval_timestamp | datetime | ✓ | ISO 8601 UTC |
| operator_id | str | ✓ | Which operator produced this |
| recipes | list[RecipeResult] | ✓ | One per template executed |
| evidence_items | list[EvidenceItem] | ✓ | Deduplicated union across recipes |
| status | enum | ✓ | "ok" / "partial" / "error" |
| error_detail | str | ✗ | Present when status != "ok" |

## Migration policy
- Additive fields: bump patch version, no migration needed.
- Breaking changes: bump minor version, add migrator in `src/idea_core/engine/migrations/`.
```

**Why:** Artifact contracts must be documented outside the code for cross-team consumption (the idea-card builder, novelty checker, and audit tooling are separate components).

---

**Summary:** The architectural direction is sound—operator-family-specific retrieval recipes writing auditable artifact packets is the right pattern for evidence-first HEP research. However, the bundle cannot be approved without (a) the actual source files for review, (b) a formal evidence packet schema with provenance fields, (c) anti-hallucination URI validation, and (d) failure-mode test coverage. The four blockers are all addressable in a single revision cycle.
