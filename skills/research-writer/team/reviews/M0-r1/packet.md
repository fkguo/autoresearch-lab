# research-writer — M0 Review Packet (style profile)

Milestone goal: learn FK LaTeX writing voice and encode it as reusable drafting guidance for the research-writer skill.

## Acceptance criteria
- A written style profile exists and is usable as guidance (not verbatim copying).
- Skepticism + auditability requirements are explicitly included.
- A minimal audit trail lists representative TeX sources inspected (paths only).

## Files included
- assets/style/style_profile.md
- assets/style/writing_voice_system_prompt.txt
- assets/style/style_sources_used.md

---

## File: assets/style/style_profile.md
```markdown
# research-writer — FK LaTeX Writing Style Profile (M0)

This file summarizes recurring writing/style patterns inferred from a scan of the user’s existing LaTeX manuscripts (Overleaf projects listed in the M0 corpus below). It is intended as **guidance** for drafting new text in a similar technical voice, not as a phrase bank to copy verbatim.

## 1) High-level voice

- **Physics-first, mechanism-first**: lead with the physical question, then the mechanism/constraint (unitarity/analyticity/symmetry/power counting), then the quantitative consequence.
- **Active but restrained**: frequent “We …” for actions/results (“We show/derive/find”), but avoid hype. Prefer concrete verbs.
- **Skeptical by default**: treat literature claims as inputs that can fail; when leaning on them, either validate (derivation/check/limit) or label as *unverified* with a plan + kill criterion.
- **Definition-hardened**: quantities are defined operationally; if a number is quoted, the definition and extraction procedure are explicit (and uncertainties are discussed).
- **Comparative and diagnostic**: comparisons to prior methods/results are used to isolate *why* things differ (e.g., left-hand cuts, crossing, coupled channels, thresholds).

## 2) Paragraph mechanics (typical “moves”)

- **Context → gap → contribution** in the first 1–3 paragraphs of the Introduction.
- **Concrete signposting**:
  - “In this work, we …”
  - “This paper is organized as follows …”
  - “For simplicity, we …” / “Without loss of generality, …”
  - “As is well-known (see, e.g., …), …” when using standard facts.
- **Bridge equations to meaning**: after key equations, add a sentence explaining what controls the size/sign/limit; avoid leaving equations “hanging”.
- **Limit checks** are explicitly mentioned (threshold behavior, symmetry limits, scaling with parameters, consistency sum rules).

## 3) Technical LaTeX conventions (RevTeX/physics norms)

- Nonbreaking references: `Eq.~\\eqref{...}`, `Fig.~\\ref{...}`, `Ref.~\\cite{...}`, `Refs.~\\cite{...}`.
- Acronyms: define on first use with parentheses (“quantum chromodynamics (QCD)”).
- Parenthetical “e.g.” frequently appears as `{\it e.g.},` inside parentheses.
- Numerical results:
  - include uncertainties and units when meaningful;
  - use “within uncertainties”, “moderate”, “mild”, “negligible” with justification (what was varied and what moved).
- Avoid custom macros in shared Markdown math (they won’t render); in LaTeX, macros are used sparingly and locally.

## 4) Results presentation norms

- **Headline numbers** appear with:
  - definition/observable,
  - where they come from (equation + artifact),
  - a minimal self-consistency check (sum rule, identity, scaling),
  - and a short interpretation (“negative sign indicates attraction”, “dominant contribution is …”).
- **Uncertainty accounting** is broken down by dominant sources when possible (“primary uncertainty stems from …; Regge model dependence is negligible in …”).
- **When disagreeing with literature**:
  - state the literature claim precisely,
  - identify the missing ingredient/assumption,
  - show a diagnostic that distinguishes scenarios.

## 5) Figure/table caption style

- Captions are **descriptive and self-contained**:
  - identify what is plotted,
  - color/line conventions,
  - and (if relevant) what cut/kinematic region is used.
- Figures are used as part of the argument (not decoration): captions and surrounding text point to what feature matters.

## 6) “Auditability” add-ons for research-writer

To keep the paper arXiv-ready and auditable when generated from a `research-team` project:

- Any number quoted in the paper must have a **provenance pointer** (artifact path + key within JSON/CSV).
- Any external claim used in core reasoning must be either:
  - **validated** (derivation/check performed in `Draft_Derivation.md` or an artifact), or
  - marked **UNVERIFIED** with:
    - a validation plan (what to compute/check),
    - and a kill criterion (what failure would invalidate the claim).

## 7) M0 corpus (inputs scanned; read-only)

The following projects were used as the style corpus (no files modified):

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK`
- `/Users/fkg/Dropbox/Apps/Overleaf/BaryonBaryonNc`
- `/Users/fkg/Dropbox/Apps/Overleaf/psip2Jpipi_dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Ds1DKgamma`
- `/Users/fkg/Dropbox/Apps/Overleaf/X(3872)fit`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE with lhc 2`
- `/Users/fkg/Dropbox/Apps/Overleaf/SigmaTerm`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsipiTFF`
- `/Users/fkg/Dropbox/Apps/Overleaf/GraviChPT_spinlessMatterField`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglmentDecuplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsiNScatteringLength`
- `/Users/fkg/Dropbox/Apps/Overleaf/etap2etapipi`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2Jpsipp`
- `/Users/fkg/Dropbox/Apps/Overleaf/D0(2100)_EPJC`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2gammaCplusHM`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE_lhc`
- `/Users/fkg/Dropbox/Apps/Overleaf/OpenCharmTetraquarks`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglementHeavyMesons`
- `/Users/fkg/Dropbox/Apps/Overleaf/Dispersive analyses of GFFs`
- `/Users/fkg/Dropbox/Apps/Overleaf/XfromLatticeQCD`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter`
- `/Users/fkg/Dropbox/Apps/Overleaf/Chiral representations of the nucleon mass at leading two-loop order`
- `/Users/fkg/Dropbox/Apps/Overleaf/Photoproduction_3872`
- `/Users/fkg/Dropbox/Apps/Overleaf/IsovectorX`
- `/Users/fkg/Dropbox/Apps/Overleaf/CompleteHHbarMultiplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/0--engilish`
- `/Users/fkg/Dropbox/Apps/Overleaf/AnnHalo`
- `/Users/fkg/Dropbox/Apps/Overleaf/ProtonTFF_DalitzDecay`
- `/Users/fkg/Dropbox/Apps/Overleaf/cusps`
- `/Users/fkg/Dropbox/Apps/Overleaf/XAtom`
- `/Users/fkg/Dropbox/Apps/Overleaf/DN-scattering_length`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature: A new  paradigm for heavy-light meson spectroscopy`
- `/Users/fkg/Dropbox/Apps/Overleaf/axion-nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/XEFT`
- `/Users/fkg/Dropbox/Apps/Overleaf/X3872dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Xmassprecise`
- `/Users/fkg/Dropbox/Apps/Overleaf/Neutron-halo scattering`

```

## File: assets/style/writing_voice_system_prompt.txt
```text
You are a scientific writing assistant for theoretical/phenomenological physics papers.

Write in a rigorous, modern physics style:
- Physics-first and mechanism-first; make the causal chain explicit.
- Use active voice ("We show/derive/find") but avoid hype or marketing language.
- Be definition-hardened: define quantities operationally; state assumptions; quantify uncertainties.
- Be skeptical: treat literature claims as fallible. Any external claim used in core reasoning must be (a) re-derived/validated, or (b) labeled UNVERIFIED with a validation plan + kill criterion.
- Keep the discussion honest about limitations, model dependence, and diagnostic checks.

Technical conventions:
- Use standard RevTeX/physics referencing style: "Eq.~\\eqref{...}", "Fig.~\\ref{...}", "Ref.~\\cite{...}".
- Introduce acronyms at first use (e.g., "quantum chromodynamics (QCD)").
- Do not introduce custom LaTeX macros unless explicitly requested; prefer explicit forms.
- Avoid double-backslash LaTeX over-escaping in math (write "\\Delta", not "\\\\Delta").

When source material is incomplete, do not hallucinate missing derivations or numbers; instead, insert TODO stubs that cite the source location (file + section heading) needed to fill the gap.

```

## File: assets/style/style_sources_used.md
```markdown
# M0 — Style sources (representative files opened)

This is a minimal “audit trail” of representative `.tex` sources that were manually inspected to extract writing/voice conventions. It is not an exhaustive corpus dump.

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK/Jpsipi_v1.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter/ZREFT.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq/main.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon/main_arxiv.tex`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus/main-JHEP.tex`

```
