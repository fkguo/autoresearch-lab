# Statistical-Physics-Inspired Distributor Policies (Exploration/Exploitation)

> Date: 2026-02-12  
> Scope: `Distributor` in `idea-core` (budget allocation across `model_backend × operator × island/team`)  
> Goal: Keep policies **implementable** (few state variables, O(N) per step) and **auditable** (deterministic replay from logged artifacts).

This note treats the Distributor as a **stochastic policy** over a discrete action set, and borrows control knobs from statistical physics:

- **Softmax ⇔ Gibbs/Boltzmann distribution**
- **Temperature / annealing** for exploration→exploitation scheduling
- **Free energy** and **entropy** as diagnostics / control targets
- **Replicator dynamics** (multiplicative weights) as an alternative policy update rule

It provides two concrete, auditable formulations and a minimal artifact logging spec.

---

## 1) Map softmax to Boltzmann / Gibbs

Let actions be indexed by $i \in \{1,\dots,N\}$. An action can be joint or factorized, e.g.

- joint: $i \equiv (\mathrm{backend\_id}, \mathrm{operator\_id}, \mathrm{island\_id}, \mathrm{team\_id})$
- factorized: sample $\mathrm{backend\_id} \sim p_b$, $\mathrm{operator\_id} \sim p_o$, $\mathrm{island\_id} \sim p_s$ independently (recommended for audit + fewer stats)

### 1.1 Gibbs distribution

Stat-phys form:

- energy: $E_i$ (lower is better)
- temperature: $T > 0$ (higher = more random)

Then:

$p_i = \exp(-E_i / T) / Z(T)$, where $Z(T) = \sum_j \exp(-E_j / T)$ is the partition function.

### 1.2 Softmax as “energy = negative score”

Common bandit form:

$p_i = \mathrm{softmax}(s_i / T) = \exp(s_i / T) / \sum_j \exp(s_j / T)$

This is identical to Gibbs with:

$E_i := -s_i$

So every change you make to the logits $s_i$ is literally “shaping the energy landscape”.

### 1.3 Cost-aware energy (chemical potential intuition)

Ideation actions have non-uniform cost (tokens, wall-clock, tool calls). Make that explicit:

- $Q_i$: reward estimate (EMA or windowed mean)
- $C_i$: cost estimate (EMA), in the same “currency” as your budget fuse (tokens/USD/seconds)
- $\lambda_{\text{cost}} \ge 0$: cost weight

When the chosen arm includes a **team topology** (multiple roles), the cost estimate must incorporate team structure:

$C_i = C^{\text{base}}_i \cdot \mathrm{team\_cost\_multiplier}(\mathrm{team\_policy\_id}_i)$

where `team_cost_multiplier` is derived from the team's role count and per-role cost table (see architecture spec §3.4.3).
The Distributor **must not** start a tick if $\mathrm{estimated\_tick\_cost}(\mathrm{team\_topology}) > \mathrm{budget\_remaining}$ (pre-tick budget check; return `budget_exhausted` with `reason=insufficient_for_minimum_tick`).

Define “utility” $U_i := Q_i - \lambda_{\text{cost}} C_i$, then:

$p_i \propto \exp(U_i / T)$

Equivalently, energy:

$E_i := \lambda_{\text{cost}} C_i - Q_i$

This keeps the Distributor honest under heterogeneous teams/backends.

---

## 2) Policy A — Annealed Cost-Aware Gibbs + Entropy Floor (recommended v0.2)

### 2.1 State (minimal, per action i)

Maintain per-action stats (all auditable scalars):

- `n_i`: selection count
- `Q_i`: reward EMA (or windowed mean)
- `C_i`: cost EMA (optional but recommended)

Optional (still simple):

- `σ_i`: reward stdev estimate (or robust MAD) for uncertainty bonus
- `t_last_i`: last chosen step index (for “staleness” bonus)

### 2.2 Reward (scalar) and shaping (auditable)

Evaluator outputs are multi-objective (`novelty/feasibility/impact/tractability/grounding`). Turn that into a scalar, and **log the mapping**:

$r = w \cdot \mathrm{scorecard} - \mathrm{penalty\_gate\_fail} - \lambda_{\text{cost}} \cdot \mathrm{realized\_cost}$

Where:

- $w$ is a fixed weight vector per campaign (artifact)
- `penalty_gate_fail` is an explicit penalty if grounding/schema gates fail (do not silently drop)

Then update EMA:

$Q_i \leftarrow (1-\alpha) Q_i + \alpha r$

### 2.3 Gibbs policy with explicit bonuses

Define the logit (utility) as:

$U_i := Q_i - \lambda_{\text{cost}} C_i + b_{\text{uncert}}(i) + b_{\text{stale}}(i) + b_{\text{novel}}(i)$

Examples (pick only what you can measure + log):

- uncertainty bonus (UCB-like): $b_{\text{uncert}}(i) = \kappa \frac{\sigma_i}{\sqrt{1 + n_i}}$
- staleness bonus: $b_{\text{stale}}(i) = \kappa_{\text{stale}} \log\bigl(1 + (t - t_{\text{last},i})\bigr)$
- novelty pressure (if you track “mode collapse”): $b_{\text{novel}}(i) = \kappa_H \bigl(H_{\text{target}} - H_{\text{recent}}\bigr)_+$

Then sample via:

$p_i = \mathrm{softmax}(U_i / T)$

### 2.4 Temperature schedule (annealing + re-heating)

Use a schedule driven by **budget progress**, not just step count:

- $\mathrm{progress} := \mathrm{spent\_tokens} / \mathrm{max\_tokens}$ (or $\mathrm{spent\_cost\_usd} / \mathrm{max\_cost\_usd}$, $\mathrm{spent\_wall\_clock\_s} / \mathrm{max\_wall\_clock\_s}$, etc.)

A simple monotone anneal:

$T(\mathrm{progress}) = \max\left(T_{\min}, T_{\max} \cdot \left(\frac{T_{\min}}{T_{\max}}\right)^{\mathrm{progress}}\right)$  (exponential in progress)

Re-heating triggers (optional but very effective in practice):

- if `stagnant == true` for `k` steps, set $T \leftarrow \min(T_{\max}, \rho T)$ with $\rho > 1$
- if semantic diversity of top-k falls below threshold, increase $T$ or increase entropy floor $\epsilon$

All triggers must be written as **explicit rules** and logged when fired.

### 2.5 Entropy floor (anti-collapse, cheap and auditable)

Even with temperature, Gibbs can collapse early. Add a floor:

$p'_i = (1-\epsilon) p_i + \epsilon \cdot \frac{1}{N}$

Where $\epsilon \in [0, 0.2]$ is small and logged.

This is the policy-level analogue of “mutation” in evolutionary dynamics.

### 2.6 Free energy + entropy diagnostics (log-only, but valuable)

Compute per step:

- partition function: $Z = \sum_j \exp(U_j / T)$
- free energy: $F = -T \log Z$
- Shannon entropy: $H(p') = -\sum_i p'_i \log p'_i$
- effective number of actions: $N_{\mathrm{eff}} = \exp(H(p'))$

Use these as health metrics:

- `H` too low / `N_eff` near 1 → collapse risk
- `F` trending flat while rewards stagnate → likely stuck basin → reheat or repopulate

---

## 3) Policy B — Replicator / Multiplicative Weights with KL Inertia (good for fast adaptation)

This is the “evolutionary dynamics” alternative to directly recomputing softmax over `Q_i`.

### 3.1 Core update (discrete replicator / exponentiated gradient)

Maintain nonnegative weights $w_i$ with initialization $w_i = 1$.

Define an estimated advantage $\hat{A}_i$ (baseline-subtracted reward estimate). For bandit feedback (only observe reward for chosen action), use an importance-weighted estimator:

- if action $i_t$ chosen at prob $p_{i_t}$ and reward $r_t$ observed:
  - $\hat{A}_{i_t} = (r_t - b_t) / \max(p_{i_t}, p_{\min})$
  - $\hat{A}_{j \ne i_t} = 0$

Then:

$w_i \leftarrow w_i \cdot \exp(\eta \hat{A}_i)$  
$p_i \leftarrow (1-\epsilon) \cdot \frac{w_i}{\sum_j w_j} + \epsilon \cdot \frac{1}{N}$

Notes:

- $\eta$ is a learning rate; increasing $\eta$ makes the system more “low temperature” (more selective).
- The $\epsilon$-mixing plays the role of mutation (prevents absorbing states).

### 3.2 KL inertia (optional, still simple)

If you instead compute `p` via a KL-regularized objective, you get “inertia” automatically:

$p_{t+1} = \operatorname*{arg\,max}_{p} \left[ \langle p, Q \rangle - \frac{1}{\eta} \mathrm{KL}(p \| p_t) \right]$

Closed form solution is exactly multiplicative weights. Practically: log $\mathrm{KL}(p_{t+1} \| p_t)$ as a stability diagnostic.

### 3.3 Where the physics analogy fits

- Replicator dynamics is a population evolving under “fitness” $\hat{A}_i$.
- $\epsilon$-mixing is mutation rate.
- $\eta$ is the selection strength (inverse temperature analogue).

This policy is especially good when you want **fast online adaptation** (e.g., a backend’s performance degrades mid-run).

---

## 4) What to log (artifacts) for audit + replay

Minimum requirement: given artifacts + RNG seed, you can replay the Distributor’s action choices and recompute all derived metrics (entropy/free energy/KL).

### 4.1 Artifact: `distributor_policy_config_v1.json` (once per campaign)

Log the immutable configuration:

- `campaign_id`
- `policy_family`: `annealed_gibbs_entropy_floor | replicator_mw_kl`
- action space definition:
  - `factorization`: `joint | backend×operator×island` (recommended)
  - enumerations: `backend_ids[]`, `operator_ids[]`, `island_ids[]` (and optionally `team_ids[]`)
- reward mapping:
  - `score_weights` (vector with names)
  - `gate_fail_penalty`
  - `lambda_cost` and cost units
- annealing params (Policy A):
  - `T_min`, `T_max`, `anneal_shape`
  - `reheat_rules[]` (explicit thresholds)
  - `epsilon_floor`
- replicator params (Policy B):
  - `eta_schedule`
  - `epsilon_floor`
  - `p_min` (for importance weighting)
- deterministic sampling:
  - `rng_alg` (e.g., `pcg64`, `mt19937`)

### 4.2 Artifact: `distributor_events_v1.jsonl` (append-only, one per step)

One JSON object per Distributor decision point:

- identifiers: `campaign_id`, `step_id`, `decision_id`, `timestamp`
- budget context: `budget_snapshot_ref` (or inline `budget_snapshot`), `progress`
- action set (explicit IDs) and policy state snapshot hash:
  - `action_ids[]` or factorized IDs
  - `state_snapshot_ref` (optional) or `state_digest`
- computed quantities (log raw + normalized):
  - `T`, `epsilon_floor`, `eta` (if applicable)
  - for each action: `Q_i`, `C_i`, bonuses, `U_i`, `logit_i`
  - `p_pre_floor[]`, `p_final[]`
  - `Z`, `free_energy_F`, `entropy_H`, `N_eff`, `kl_to_prev`
- sampling + outcome:
  - `rng_seed` (or `rng_seed_ref`) and `sampled_action_id`
  - `realized_cost`, `observed_reward_r`, `baseline_b`
  - `new_node_ids[]` produced under this action (cross-link to `idea_candidates_v1.jsonl`)
- triggered rules:
  - `reheat_triggered` / `degradation_event_triggered` with reason strings

### 4.3 Artifact: `distributor_state_snapshot_v1.json` (optional periodic snapshot)

Useful for debugging long runs:

- per action: `n_i`, `Q_i`, `C_i`, (`σ_i`), (`w_i`), `t_last_i`
- current `p`, `T`, and last `decision_id`

### 4.4 End-of-run summary: `distributor_diagnostics_v1.json` (optional)

Aggregate metrics to compare policies/backends/operators:

- selection counts by action and by factor (backend/operator/island)
- time series summaries of `T`, `H`, `N_eff`, `F`, and reward
- “regime change” annotations (reheat events, stagnation windows)

---

## 5) Implementation notes (keep it simple)

1. Prefer **factorized** distributions ($p_{\mathrm{backend}} \times p_{\mathrm{operator}} \times p_{\mathrm{island}}$) unless you have enough data for joint stats. This reduces variance and makes logs smaller.
2. Keep the Distributor independent from domain details: it sees only `reward`, `cost`, and evaluator diagnostics (e.g., stagnation/diversity flags).
3. Make the policy selection deterministic under replay:
   - log the RNG seed per decision
   - log logits and normalization details (avoid “it was softmax-ish”)
4. Treat “gates” as first-class: failures are explicit negative reward and explicit counters, not silent drops.

