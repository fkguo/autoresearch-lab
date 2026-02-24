VERDICT: NOT_READY

## Blockers

### B1. `IdeaNode` / `IdeaCard` / `RationaleDraft` schemas are prose, not machine-enforceable

The spec describes fields in natural language (§4.2, §5.2) but provides no JSON Schema, no versioned `$id`, no `additionalProperties: false` policy. Without a pinned schema:
- The "hard rule" that IdeaCard must pass schema validation before ranking (§4.2) is unenforceable.
- Downstream `idea_handoff_c2_v1.json` field-completeness gating (§8.2) has no contract to check against.
- Multi-agent evaluators cannot agree on what constitutes a valid artifact.

**Required fix:** Ship JSON Schema files (`schemas/idea_card_v1.schema.json`, `schemas/idea_node_v1.schema.json`, `schemas/rationale_draft_v1.schema.json`) as part of v0.2 deliverables, with `$id`, `required`, `enum` constraints on `support_type`, and `format` annotations for `evidence_uris`.

### B2. No defined contract between `idea-core` and MCP tools

§2.1 says idea-core must not import orchestrator internals and communicates via "artifact contracts & stdio/JSON-RPC." But:
- There is no specified RPC interface (method names, request/response schemas, error codes).
- The thin adapter (§2.2) is a black box — it "translates commands" and "maps artifacts" with zero specification.
- Without this, you cannot test idea-core in isolation (a stated design goal).

**Required fix:** Define a `idea_core_rpc_v1.schema.json` (or protobuf/OpenRPC spec) with at minimum:
```
Methods:
  campaign.init(charter) → campaign_id
  search.step(campaign_id, budget_slice) → step_result
  search.status(campaign_id) → search_state
  idea.get(idea_id) → IdeaNode
  idea.promote(idea_id) → handoff_artifact | validation_error
  eval.request(idea_id, evaluator_config) → eval_result
```
And a corresponding adapter interface that the hepar skill must implement (tool-call routing table).

### B3. Multi-Island lifecycle has no defined state machine

§3.2 mentions multi-island evolution with repopulate, but:
- No island state enum (e.g., `SEEDING → EXPLORING → CONVERGING → EXHAUSTED → REPOPULATED`).
- No definition of repopulation trigger (fitness stagnation threshold? generation count? budget fraction?).
- No specification of inter-island migration policy (how many individuals, how often, selection criteria).

Without this, two independent implementors would produce incompatible search loops.

**Required fix:** Add §3.2.1 "Island Lifecycle State Machine" with:
- Explicit state enum and transitions
- Repopulation trigger predicate signature: `should_repopulate(island_state, budget_remaining) → bool`
- Migration policy interface: `migrate(source_islands, target_island, n_migrants, selection_fn) → [IdeaNode]`

### B4. `eval_info.fix_suggestions[]` feedback loop is unspecified

§5.2 and §6.1 correctly identify that evaluator diagnostics must be "re-feedable," but:
- No schema for `fix_suggestions[]` items (free text? structured action? operator hint?).
- No mechanism for how a SearchPolicy consumes `fix_suggestions` to decide operator selection or prompt modification.
- This is the **core innovation claim** (iterative refinement via diagnostics) — leaving it unspecified makes the entire search loop underspecified.

**Required fix:** Define:
```json
{
  "fix_suggestion": {
    "type": "object",
    "required": ["failure_mode", "suggested_action", "target_field"],
    "properties": {
      "failure_mode": { "enum": ["missing_evidence", "too_similar", "physics_inconsistency", "not_computable", "folklore_overlap", "untestable"] },
      "suggested_action": { "type": "string", "description": "Concrete next step for operator/prompt" },
      "target_field": { "type": "string", "description": "IdeaCard field to improve" },
      "operator_hint": { "type": "string", "description": "Optional: suggested operator_id for remediation" },
      "priority": { "enum": ["critical", "major", "minor"] }
    }
  }
}
```
And specify that `SearchPolicy.select_operator()` receives `eval_info` from the parent node.

## Non-blocking

### N1. `folklore_risk` needs a quantification spec, not just "high/low"

§6.2 says `folklore_risk` is an "explicit field" and "high → human arbitration." But there's no:
- Scoring rubric (what makes it high vs. medium vs. low?)
- Source signals (which of the 4 novelty layers contribute?)
- Threshold for triggering `A0-folklore` gate

**Suggestion:** Add a `folklore_risk_score: float [0,1]` with defined contributing factors:
- `prior_publication_similarity > 0.85` from embedding search → +0.4
- `expert_LLM_recognition` ("this is well-known") → +0.3
- `textbook_coverage` (found in standard references) → +0.3
- Threshold: `≥ 0.6` → mandatory human review at `A0-folklore`

### N2. Bandit reward signal timing is unresolved

§3.3 distinguishes short-term proxy vs. long-term outcome rewards but doesn't specify:
- How delayed rewards (A0.2 pass rate, C2 success) are attributed back to specific operator/model combinations (credit assignment problem).
- Decay/discounting for stale reward signals.
- Cold-start policy for new operators with no history.

**Suggestion:** Add a credit-assignment subsection specifying:
- Tag each IdeaNode with `(operator_id, model_id, island_id)` triple at generation time.
- When delayed outcome arrives, propagate reward to all triples in the node's ancestry (discounted by depth).
- Cold-start: allocate `ε`-fraction of budget uniformly to operators with < N samples.

### N3. `idea_evidence_graph_v1.json` is listed but never specified

§5.1 lists it as a SSOT artifact but there is zero description of its schema, nodes, edges, or how it relates to `claims[].evidence_uris` in IdeaCard.

**Suggestion:** Define minimal graph schema:
```json
{
  "nodes": [
    { "id": "string", "type": "claim|evidence|inference", "content": "...", "source_uri": "..." }
  ],
  "edges": [
    { "source": "node_id", "target": "node_id", "relation": "supports|contradicts|derives_from|cites", "confidence": 0.0-1.0 }
  ]
}
```

### N4. Cost control mechanisms are mentioned but not operationalized

§1.1(5) says "budget is a first-class parameter" and §3.3 mentions budget, but:
- No budget schema (what units? tokens? dollars? wall-clock?)
- No budget enforcement point in the search loop (where is the check?)
- No graceful degradation strategy (what gets cut first?)

**Suggestion:** Add `BudgetEnvelope` to campaign config:
```json
{
  "max_llm_tokens": 500000,
  "max_wall_clock_s": 3600,
  "max_eval_rounds": 5,
  "max_islands": 4,
  "degradation_order": ["reduce_islands", "reduce_eval_rounds", "reduce_operators", "early_stop"]
}
```
And specify that `SearchPolicy.step()` receives `budget_remaining` and must respect it.

### N5. `idea_campaign_v1.json` and `idea_seed_pack_v1.json` are unlisted schemas

These are the entry points for the entire pipeline but have no field definitions. The campaign charter (A0.1) produces `idea_campaign_v1.json`, but what's in it?

### N6. Clean-room evaluator protocol needs specification

§6.1 says multi-agent evaluation is "clean-room" by default but doesn't define:
- How conversation isolation is enforced (separate sessions? memory wipe?)
- What "structured debate" means concretely (round-robin? point-counterpoint schema?)
- When debate is triggered (disagreement threshold on scores?)

### N7. `support_type` enum for claims is missing

§4.2 mentions `claims[].support_type + evidence_uris` but doesn't define the `support_type` enum. Suggest: `{ "literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus" }` with required `confidence` and `verification_plan` for `llm_inference` type.

## Real-research fit

**Strengths:**

1. **Operator families are well-chosen for HEP theory.** `SymmetryOperator`, `LimitExplorer`, and `RepresentationShift` map directly to how HEP theorists actually think. A working `LimitExplorer` that systematically probes strong-coupling ↔ weak-coupling ↔ large-N limits would be genuinely useful for, e.g., exploring BSM effective field theories.

2. **The Explain-Then-Formalize two-stage is correct and important.** Real theory research involves an informal "why should this work" stage (often on a whiteboard) before the formalism. Forcing formalization too early kills genuinely novel directions; allowing informality to persist kills executability. The `RationaleDraft → IdeaCard` pipeline captures this well.

3. **Multi-island with operator diversity mirrors real group dynamics.** Different theorists have different "styles" (symmetry-first vs. phenomenology-first vs. limit-taking). Islands with different operator mixes approximate this. The repopulation mechanism prevents premature convergence, which is a real problem in LLM idea generation (mode collapse to "safe" ideas).

4. **C1-gap → seed pipeline is the highest-value integration.** The ability to automatically convert systematic literature review gaps into structured seeds for idea generation is where this system would provide the most value over a human theorist working alone. The INSPIRE/PDG/HEPData integration makes this concrete.

**Risks for real research use:**

1. **Operator quality bottleneck.** The spec assumes operators can produce meaningful scientific variations, but the actual quality depends entirely on prompt engineering and LLM capability for each operator. `AnomalyAbduction` applied to the muon g-2 anomaly requires deep domain knowledge that current LLMs may not reliably possess. The spec should mandate **operator qualification tests** (known-good input/output pairs) before deployment.

2. **Novelty assessment is the hardest unsolved problem.** The four-layer stack is a good start, but in HEP, "novelty" is notoriously subjective. An idea might be "technically new" (never published in this exact form) but "spiritually old" (a trivial variant of a known approach). The folklore risk field addresses this partially, but the system needs access to expert judgment — the spec should make clearer when human-in-the-loop is mandatory vs. optional.

3. **The `minimal_compute_plan` field in IdeaCard risks scope creep.** In real HEP, the compute plan for testing an idea (e.g., "run a 2-loop FeynCalc computation for this process") requires significant expertise. This field should be marked as "best-effort estimate" with a clear note that C2 will refine it.

## Robustness & safety

### Hallucination mitigation

**Gap:** The spec has no explicit hallucination detection mechanism beyond grounding checks. For HEP, common hallucination modes include:
- Citing non-existent papers (phantom references)
- Claiming symmetry properties that don't hold
- Inventing experimental results

**Recommendation:** Add a mandatory `grounding_audit` step before IdeaCard finalization:
1. Every `evidence_uri` must resolve (INSPIRE lookup returns a valid record).
2. Every claimed experimental value must match PDG/HEPData within stated uncertainties.
3. Every symmetry claim must be tagged with a verification method (even if deferred to C2).

### Provenance completeness

**Gap:** `origin.prompt_hash` is mentioned but the actual prompt is not stored. For reproducibility, the full prompt (or a content-addressed reference to it) must be recoverable.

**Recommendation:** Store prompts in a content-addressed store (SHA-256 → prompt text) and reference by hash in `origin`. This also enables prompt drift detection across runs.

### Adversarial robustness of evaluators

**Gap:** If evaluators are LLM-based, they can be gamed by ideas that are well-written but scientifically vacuous (the "compelling nonsense" problem). The spec mentions clean-room evaluation but doesn't address:
- Evaluator calibration (do evaluators agree on known-good and known-bad ideas?)
- Evaluator gaming detection (ideas that score high on style but low on substance)

**Recommendation:** Add an evaluator calibration protocol:
1. Before each campaign, run evaluators on a calibration set of 5 known-good + 5 known-bad ideas.
2. Reject evaluator configurations where accuracy on calibration set < 70%.
3. Add a `substance_check` evaluator dimension that specifically probes for concrete predictions vs. vague claims.

### Append-only ledger integrity

**Gap:** §1.1(4) mentions append-only ledger but no specification of:
- What events are logged (every LLM call? every operator application? every evaluation?)
- Tamper evidence (checksums? hash chains?)
- Storage format

**Recommendation:** Define `LedgerEvent` schema:
```json
{
  "event_id": "uuid",
  "timestamp": "iso8601",
  "event_type": "enum: operator_applied | eval_completed | idea_promoted | idea_pruned | budget_checkpoint | migration | repopulate",
  "payload_ref": "content-addressed hash",
  "prev_event_hash": "sha256 of previous event (hash chain)"
}
```

## Specific patch suggestions

### Patch 1: Add `schemas/` directory with machine-enforceable contracts
**File:** `schemas/idea_node_v1.schema.json` (NEW)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_node_v1",
  "type": "object",
  "required": ["idea_id", "node_id", "parent_node_ids", "island_id", "operator_id", "origin", "operator_trace", "rationale_draft"],
  "properties": {
    "idea_id": { "type": "string", "format": "uuid" },
    "node_id": { "type": "string", "format": "uuid" },
    "parent_node_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "island_id": { "type": "string" },
    "operator_id": { "type": "string" },
    "rationale_draft": { "$ref": "rationale_draft_v1.schema.json" },
    "idea_card": { "oneOf": [{ "$ref": "idea_card_v1.schema.json" }, { "type": "null" }] },
    "origin": {
      "type": "object",
      "required": ["model", "temperature", "prompt_hash", "timestamp"],
      "properties": {
        "model": { "type": "string" },
        "temperature": { "type": "number", "minimum": 0 },
        "prompt_hash": { "type": "string", "pattern": "^sha256:[a-f0-9]{64}$" },
        "timestamp": { "type": "string", "format": "date-time" }
      }
    },
    "operator_trace": {
      "type": "object",
      "required": ["inputs", "params", "evidence_uris_used"],
      "properties": {
        "inputs": { "type": "object" },
        "params": { "type": "object" },
        "random_seed": { "type": "integer" },
        "evidence_uris_used": { "type": "array", "items": { "type": "string", "format": "uri" } }
      }
    },
    "eval_info": {
      "type": ["object", "null"],
      "properties": {
        "fix_suggestions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["failure_mode", "suggested_action", "target_field", "priority"],
            "properties": {
              "failure_mode": { "enum": ["missing_evidence", "too_similar", "physics_inconsistency", "not_computable", "folklore_overlap", "untestable"] },
              "suggested_action": { "type": "string" },
              "target_field": { "type": "string" },
              "operator_hint": { "type": "string" },
              "priority": { "enum": ["critical", "major", "minor"] }
            }
          }
        },
        "failure_modes": { "type": "array", "items": { "type": "string" } }
      }
    }
  },
  "additionalProperties": false
}
```

### Patch 2: Add `idea_card_v1.schema.json` with `support_type` enum
**File:** `schemas/idea_card_v1.schema.json` (NEW)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "idea_card_v1",
  "type": "object",
  "required": ["thesis_statement", "testable_hypotheses", "required_observables", "candidate_formalisms", "minimal_compute_plan", "claims"],
  "properties": {
    "thesis_statement": { "type": "string", "minLength": 20 },
    "testable_hypotheses": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "required_observables": { "type": "array", "items": { "type": "string" } },
    "candidate_formalisms": { "type": "array", "minItems": 1, "items": { "type": "string" } },
    "minimal_compute_plan": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["step", "method", "estimated_difficulty"],
        "properties": {
          "step": { "type": "string" },
          "method": { "type": "string" },
          "estimated_difficulty": { "enum": ["straightforward", "moderate", "challenging", "research_frontier"] },
          "tool_hint": { "type": "string" }
        }
      }
    },
    "claims": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["claim_text", "support_type", "evidence_uris"],
        "properties": {
          "claim_text": { "type": "string" },
          "support_type": { "enum": ["literature", "data", "calculation", "llm_inference", "assumption", "expert_consensus"] },
          "evidence_uris": { "type": "array", "items": { "type": "string", "format": "uri" } },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "verification_plan": { "type": "string", "description": "Required when support_type is llm_inference or assumption" }
        },
        "if": { "properties": { "support_type": { "enum": ["llm_inference", "assumption"] } } },
        "then": { "required": ["claim_text", "support_type", "evidence_uris", "verification_plan"] }
      }
    }
  }
}
```

### Patch 3: Add island state machine to §3.2
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Insert after §3.2 paragraph 3

Add new subsection:

```markdown
### 3.2.1 Island Lifecycle State Machine

States: SEEDING → EXPLORING → CONVERGING → STAGNANT → REPOPULATED | EXHAUSTED

Transitions:
- SEEDING → EXPLORING: when `len(population) >= min_pop_size`
- EXPLORING → CONVERGING: when `top_k_diversity(population) < diversity_threshold`
- EXPLORING → STAGNANT: when `best_score_improvement(last_n_generations) < epsilon`
- CONVERGING → STAGNANT: same stagnation predicate
- STAGNANT → REPOPULATED: `repopulate(island, donor_islands, n_migrants)` called by SearchPolicy
- STAGNANT → EXHAUSTED: `budget_remaining(island) < min_step_cost`
- REPOPULATED → EXPLORING: immediate (reset stagnation counter)

Interfaces:
```python
class IslandState(Enum):
    SEEDING = "seeding"
    EXPLORING = "exploring"
    CONVERGING = "converging"
    STAGNANT = "stagnant"
    REPOPULATED = "repopulated"
    EXHAUSTED = "exhausted"

def should_repopulate(island: Island) -> bool:
    """Trigger when: stagnant AND exists donor island with higher diversity."""

def migrate(sources: list[Island], target: Island, n: int, 
            select_fn: Callable[[list[IdeaNode]], list[IdeaNode]]) -> list[IdeaNode]:
    """Select n nodes from sources, inject into target, return migrated nodes."""
```
```

### Patch 4: Add RPC interface spec for idea-core ↔ adapter boundary
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Insert new §2.3

```markdown
### 2.3 idea-core RPC Interface (v1)

idea-core exposes a JSON-RPC 2.0 interface over stdio. The adapter translates
hepar commands into these calls.

| Method | Params | Returns | Side effects |
|--------|--------|---------|-------------|
| `campaign.init` | `{charter: CampaignCharter, seed_pack: SeedPack, budget: BudgetEnvelope}` | `{campaign_id, initial_state}` | Creates campaign in IdeaStore |
| `campaign.status` | `{campaign_id}` | `{state, budget_used, budget_remaining, n_ideas, n_promoted}` | None |
| `search.step` | `{campaign_id, n_steps?: int}` | `{step_results: StepResult[], budget_remaining}` | Advances search, appends to ledger |
| `search.pause` | `{campaign_id}` | `{state: "paused"}` | Checkpoints state |
| `idea.list` | `{campaign_id, filter?: IdeaFilter}` | `{ideas: IdeaNode[]}` | None |
| `idea.promote` | `{idea_id}` | `{handoff: C2Handoff} | {error: ValidationError}` | Schema-validates IdeaCard; fails if incomplete |
| `eval.run` | `{idea_ids: string[], evaluator_config: EvalConfig}` | `{scorecards: Scorecard[]}` | Writes eval_info into IdeaNodes |
| `rank.compute` | `{campaign_id, method: "pareto" | "elo"}` | `{ranking: RankingResult}` | None (pure computation) |

Error codes: -32001 (budget_exhausted), -32002 (schema_validation_failed), 
-32003 (campaign_not_found), -32004 (idea_not_found)

BudgetEnvelope:
  { max_llm_tokens: int, max_wall_clock_s: int, max_eval_rounds: int,
    max_islands: int, degradation_order: string[] }
```

### Patch 5: Add grounding audit gate before IdeaCard finalization
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — In §4.2, after the IdeaCard field list, add:

```markdown
#### 4.2.1 Grounding Audit Gate (mandatory before IdeaCard is valid)

Before `idea_card` field transitions from null to populated on any IdeaNode:

1. **URI resolution check**: Every entry in `claims[].evidence_uris` must resolve
   via INSPIRE-HEP API or DOI resolver. Phantom references → `grounding_audit: FAIL`.
2. **Data consistency check**: Any claimed numerical value (mass, coupling, branching
   ratio) tagged with `support_type: "data"` must be cross-checked against
   PDG/HEPData within 3σ of stated uncertainties.
3. **Inference transparency**: Claims with `support_type: "llm_inference"` must have
   non-empty `verification_plan` specifying at least one of:
   {analytic_check, numerical_check, literature_search, expert_review}.
4. **Folklore pre-screen**: Run novelty layer-1 (embedding similarity against
   KB + INSPIRE recent-5yr) and set `folklore_risk` score. If ≥ 0.6, tag
   `requires_folklore_review: true`.

Audit result is stored as `grounding_audit` field on IdeaNode:
  { "status": "pass|fail|partial", "failures": [...], "timestamp": "iso8601" }
```

### Patch 6: Add evaluator calibration protocol to §6.1
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Append to §6.1:

```markdown
#### 6.1.1 Evaluator Calibration Protocol

Before each campaign, evaluator configurations are validated:

1. Maintain a calibration set per DomainPack: 5 known-publishable ideas + 5 known-
   flawed ideas (with labeled ground-truth scores per dimension).
2. Run each evaluator config on the calibration set.
3. Require: Spearman rank correlation ≥ 0.6 with ground truth on each dimension.
4. Require: evaluator correctly identifies ≥ 4/5 known-flawed ideas as below-threshold.
5. If calibration fails, emit `evaluator_calibration_failed` event to ledger and
   block campaign start until config is adjusted or human overrides.

Calibration sets are versioned alongside the DomainPack and updated when new
ground-truth examples become available (e.g., after a successful paper publication
confirms an idea was viable, or after a failed C2 run confirms an idea was flawed).
```

### Patch 7: Define `LedgerEvent` schema in §1.1(4)
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Expand §1.1(4):

```markdown
Ledger events use a hash-chained append-only format:

```json
{
  "event_id": "uuid-v4",
  "timestamp": "iso8601",
  "event_type": "operator_applied | eval_completed | idea_promoted | idea_pruned | budget_checkpoint | migration | repopulate | campaign_init | campaign_paused | grounding_audit | calibration_run",
  "campaign_id": "string",
  "actor": "idea-core | evaluator:<id> | human:<id> | adapter",
  "payload_hash": "sha256:<hex>",
  "prev_event_hash": "sha256:<hex> (hash chain)",
  "payload": { "...event-type-specific..." }
}
```

Storage: JSONL file per campaign (`ledger/<campaign_id>.jsonl`), one event per line. 
The `prev_event_hash` field enables integrity verification via sequential hash chain 
replay.
```

### Patch 8: Add Operator qualification test requirement to §3.1
**File:** `docs/plans/2026-02-12-idea-generator-architecture-spec.md` — Append to §3.1 after operator families list:

```markdown
#### 3.1.1 Operator Qualification (mandatory before deployment)

Each operator in a DomainPack must ship with:
1. **Golden test cases** (≥ 3): known input seed → expected output characteristics 
   (not exact text, but structural properties: "must mention symmetry breaking", 
   "must reference at least one anomaly", "must produce ≥ 2 testable hypotheses").
2. **Negative test cases** (≥ 2): inputs where the operator should gracefully decline 
   (return empty candidates with reason) rather than force a bad idea.
3. **Benchmark scores**: Run on calibration seeds and record baseline eval scores; 
   operator is eligible only if median grounding_ratio ≥ 0.5 on benchmark.

Qualification results stored in `domain_packs/<pack_id>/operator_quals/`.
```
