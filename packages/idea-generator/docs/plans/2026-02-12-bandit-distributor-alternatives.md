# Better alternatives to Softmax+EMA for Distributor budget allocation (MAB)

> Scope: allocating budget across multiple **LLM backends and/or operators** (multi-armed bandit) under: scale, uncertainty/variance, cold start, non-stationarity, and cost sensitivity.
>
> Goal: replace (or at least **strictly dominate**) “softmax(score-EMA)” with policies that have **principled exploration**, **variance awareness**, and **explicit cost/budget constraints**, while staying **deterministic/auditable**.

---

## 0) Why Softmax + EMA is brittle (and where it breaks)

Softmax-on-EMA is basically *Boltzmann exploration with ad‑hoc recency weighting*. It’s attractive because it’s simple, but it fails precisely where LLM orchestration is hard:

- **No uncertainty modeling**: it treats an EMA mean as truth; high-variance arms can look “best” by luck and steal budget.
- **Scale pathologies**: with many arms, softmax probabilities can become numerically tiny; exploration becomes accidental and can “die out”.
- **Cold start**: new arms start with no data; unless you hand-tune priors/initial scores, they get starved (or over-fed) in unstable ways.
- **Non-stationarity**: EMA is a blunt forgetting mechanism; it cannot *detect* changes, only smear them.
- **Cost blindness**: if arms differ by USD/token, latency, or multi-role team cost, “reward-only” softmax can overspend.

Treat Softmax+EMA as a **baseline** (easy to ship), not a “final” allocator.

---

## 1) Canonical bandit alternatives (by failure mode)

### A) Uncertainty + variance (stochastic, stationary)

**UCB family (optimism under uncertainty)**
- **UCB1** (Auer, Cesa‑Bianchi, Fischer, 2002): pick `argmax_i (mean_i + bonus_i)`; bonus shrinks as `n_i` grows; deterministic, simple, strong guarantees.
- **UCB‑V / empirical Bernstein UCB** (Audibert, Munos, Szepesvári, 2009): replaces Hoeffding-style bonuses with **variance-aware** bonuses → more stable when reward noise differs across backends/operators.
- **KL‑UCB** (Garivier & Cappé, 2011): uses KL divergence confidence bounds; typically tighter than UCB1 for bounded rewards.

**Bayesian / sampling**
- **Thompson Sampling** (Thompson, 1933; modern analysis e.g. Agrawal & Goyal, 2012/2013): sample a plausible mean for each arm from its posterior and pick the best; handles uncertainty naturally and tends to behave well in practice.
- **Bayes‑UCB** (Kaufmann, Cappé, Garivier, 2012): choose arm by a high posterior quantile (an “optimistic” posterior index). Often **deterministic given the posterior** (helpful for audit).

**Design translation for LLM routing**
- Use reward normalization into `[0,1]` (or bounded) so “bounded bandit” assumptions roughly hold.
- Prefer **variance-aware UCB** when evaluator noise is heteroscedastic (common with LLM-judge scores).

### B) Cold start + scale (many arms, shared structure)

When the number of arms grows (many operators / model variants), per-arm learning becomes sample-inefficient. Standard fix: **structure**.

**Contextual bandits (parameter sharing across arms)**
- **LinUCB** (Li, Chu, Langford, Schapire, 2010) and **OFUL / linear bandits** (Abbasi‑Yadkori, Pál, Szepesvári, 2011): assume expected reward is (approximately) linear in features; generalize across arms and contexts.
- **Linear Thompson Sampling** (Agrawal & Goyal, 2013): Bayesian linear bandit; strong cold-start behavior if you encode good priors/features.

**Practical features for LLM Distributor**
- Prompt/task features (length, domain tags, required tools).
- “Operator phenotype” features (expected novelty vs grounding vs formalization rate).
- Backend features (cost, latency, context length, tool support).

**Hierarchical priors (arm sharing without explicit features)**
- Use a population prior across arms (backend/operator family) so new arms inherit reasonable uncertainty and don’t require hard-coded initial scores.

### C) Non-stationarity (drift, regime switches, “provider changes”)

LLM routing is *non-stationary* (model updates, rate limits, safety filters, traffic spikes).

**Forgetting / windowing**
- **Discounted UCB** / **Sliding-Window UCB** (Garivier & Moulines, 2011): keep only recent evidence (window) or exponentially downweight the past (discount). Deterministic and easy to implement.

**Adversarial-robust (worst-case drift)**
- **EXP3** (Auer et al., 2002): multiplicative-weights bandit for adversarial rewards; maintains probabilities, but updates include importance weighting (higher variance).
- Variants for drifting best-arm (**shifting regret**), e.g. EXP3.S / “tracking the best expert”, and **Rexp3** / variation-budget approaches (Besbes, Gur, Zeevi, 2014).

**Change-point detection + reset (engineering-friendly)**
- Run a lightweight detector (e.g., CUSUM/Page-Hinkley) per arm (or globally) and **reset** that arm’s statistics on detected shifts. This is often more interpretable than trying to tune a single EMA constant forever.

### D) Cost-sensitive / budgeted (dollars, tokens, wall-clock, multi-role teams)

If each pull has a different cost, the correct objective is not “maximize mean reward”, but something like:

- maximize **reward per unit cost** (ratio), or
- maximize reward subject to **budget constraints** (knapsack), or
- maximize `reward − λ·cost` (Lagrangian).

**Bandits with Knapsacks (BwK)**
- **BwK** (Badanidiyuru, Kleinberg, Slivkins, 2013; later extensions e.g. Agrawal & Devanur, 2016): bandits with *resource consumption* constraints; canonical framework when you have a total budget and per-action costs.

**Engineering translation**
- Treat each action as consuming a vector cost: `cost_usd`, `tokens`, `wall_clock_s`, and (optionally) `role_cost` (Team topology).
- Use a primal-dual/Lagrangian view: maintain shadow prices for resources and choose actions that maximize `UCB(utility) − Σ_k λ_k·cost_k`.

---

## 2) Concise recommendation (what to implement for idea-generator)

### Recommended default policy (v0.3 target): cost-aware non-stationary contextual bandit

1) **Contextual** (for scale + cold start): LinUCB / OFUL *or* Linear Thompson Sampling using prompt/operator/backend features.
2) **Non-stationary** (for drift): discounted or sliding-window updates of sufficient statistics; optionally add change-point resets.
3) **Cost-aware** (for real budgets): optimize a Lagrangian index `score = upper_confidence(quality) − Σ λ_k·cost_k`, with λ updated to respect budgets.
4) **Robust to noisy evaluators**: prefer variance-aware bonuses (UCB‑V/empirical Bernstein) or posterior-based uncertainty.
5) **Fallback safety**: keep an EXP3-style policy available when you distrust stationarity assumptions (or you see adversarial-like drift).

### If you need “deterministic by default”

- Use **(discounted/sliding-window) UCB‑V** + cost-adjusted index + deterministic tie-breaks.
- Optionally use **Bayes‑UCB** (posterior quantile) instead of Thompson sampling to avoid runtime randomness.

---

### Safety bounds for importance weighting

When using replicator/EXP3-style policies with importance-weighted estimators, `p_min` (the floor for `1/p_i` clipping) **must** satisfy `p_min >= 1/(10*N)` where `N` is the number of arms.
For typical idea-generator deployments (`N ∈ [10, 50]`), this gives `p_min ∈ [0.002, 0.01]`.
Values below this threshold produce explosive variance that defeats the purpose of structured exploration.
Log `p_min` in `distributor_policy_config_v1.json`.

## 3) Deterministic + auditable operation (how to make bandits reviewable)

Make the Distributor a **pure, replayable state machine**:

1) **Version everything**: `policy_id`, `policy_version`, and full hyperparameters (discount/window, priors, confidence level).
2) **Log every decision** as an append-only ledger event:
   - step identifiers: `(campaign_id, step_id, island_id, operator_id, backend_id)`
   - inputs: context feature hash + budget snapshot + eligible arms set
   - per-arm stats used for scoring (n, mean, variance or posterior params; discounted counts if used)
   - computed per-arm index components (quality UCB, cost penalties, λ values)
   - chosen arm + deterministic tie-break rationale
3) **Randomness discipline** (if using Thompson sampling):
   - derive a per-step seed deterministically from `(campaign_id, step_id, policy_version)` and record it,
   - record the PRNG algorithm + sampled values needed to reproduce the choice.
4) **Replay tool**: given the ledger event stream, recompute choices and assert equality (or emit a diff explaining divergence).

This turns the Distributor into something you can “audit like a compiler”: same inputs → same decision trace.

---

## 4) Canonical references (starting set)

Stochastic/adversarial MAB foundations
- P. Auer, N. Cesa‑Bianchi, P. Fischer (2002). *Finite-time Analysis of the Multiarmed Bandit Problem.* Machine Learning. (UCB1)
- P. Auer, N. Cesa‑Bianchi, Y. Freund, R. Schapire (2002). *The nonstochastic multiarmed bandit problem.* (EXP3)
- W. R. Thompson (1933). *On the Likelihood that One Unknown Probability Exceeds Another in View of the Evidence.* (Thompson sampling)

Variance-aware / information-theoretic UCB
- J.-Y. Audibert, R. Munos, C. Szepesvári (2009). *Exploration–exploitation tradeoff using variance estimates in multi-armed bandits.* (UCB‑V)
- A. Garivier, O. Cappé (2011). *The KL-UCB algorithm for bounded stochastic bandits and beyond.* (KL‑UCB)
- E. Kaufmann, O. Cappé, A. Garivier (2012). *On Bayesian upper confidence bounds for bandit problems.* (Bayes‑UCB)

Contextual / linear bandits
- L. Li, W. Chu, J. Langford, R. Schapire (2010). *A contextual-bandit approach to personalized news article recommendation.* (LinUCB)
- Y. Abbasi‑Yadkori, D. Pál, C. Szepesvári (2011). *Improved Algorithms for Linear Stochastic Bandits.* (OFUL)
- S. Agrawal, N. Goyal (2013). *Thompson Sampling for Contextual Bandits with Linear Payoffs.* (Linear TS)

Non-stationary bandits
- A. Garivier, E. Moulines (2011). *On upper-confidence bound policies for non-stationary bandit problems.* (discounted/sliding-window UCB)
- O. Besbes, Y. Gur, A. Zeevi (2014). *Stochastic multi-armed bandit problem with non-stationary rewards.* (variation budget; non-stationary regret)

Budgeted / cost-constrained bandits
- A. Badanidiyuru, R. Kleinberg, A. Slivkins (2013). *Bandits with Knapsacks.* (BwK)

Surveys / references
- S. Bubeck, N. Cesa‑Bianchi (2012). *Regret Analysis of Stochastic and Nonstochastic Multi-armed Bandit Problems.* (survey)
- T. Lattimore, C. Szepesvári (2020). *Bandit Algorithms.* (book)

