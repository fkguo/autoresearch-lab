VERDICT: READY

## Blockers

(none)

## Non-blocking

1. **System prompt could be more explicit about provenance pointers**: The `writing_voice_system_prompt.txt` mentions TODO stubs but doesn't explicitly require the provenance pointer convention described in §6 of the style profile ("artifact path + key within JSON/CSV"). Consider adding a sentence like: "When quoting numerical results, include a provenance pointer (artifact path + key) so the number is traceable."

2. **Style profile §3 has an escaping ambiguity**: The example `{\it e.g.},` uses old-style LaTeX font commands; modern practice is `\textit{e.g.},`. Minor, but worth noting if this will be used as normative guidance.

3. **Corpus list vs. inspected list mismatch is fine but could be clarified**: §7 lists ~40 projects as "corpus," while `style_sources_used.md` lists 5 files as "representative files opened." The distinction (full corpus vs. sampled inspection) is implicit but clear enough. A one-sentence clarification in `style_sources_used.md` (e.g., "These 5 files were sampled from the 42-project corpus listed in §7 of style_profile.md") would be helpful.

## Real-research fit

The style profile captures authentic physics-writing norms well:
- The "physics-first, mechanism-first" framing matches how experienced phenomenologists structure arguments.
- The skepticism/auditability requirements (§6) are appropriate for a research team that wants reproducible, arXiv-ready drafts.
- The paragraph mechanics (context→gap→contribution, bridge equations to meaning) reflect actual journal-style expectations.
- The figure/table caption norms ("descriptive and self-contained") align with RevTeX and journal standards.

The system prompt is lean but usable; it distills the profile into actionable drafting instructions without overloading the context window.

## Robustness & safety

- **No PII exposure**: File paths are local user paths, which is acceptable for a personal style profile; they reveal nothing beyond the author's own work.
- **No model weights or credentials** in the files.
- **Skepticism requirements are safety-positive**: The explicit UNVERIFIED labeling + kill-criterion pattern reduces risk of hallucinated claims propagating into papers.
- **No risk of verbatim copying**: The profile explicitly states it is "guidance … not a phrase bank to copy verbatim."

## Specific patch suggestions

1. **`writing_voice_system_prompt.txt`, line ~12** — Add provenance requirement:
   ```diff
   - When source material is incomplete, do not hallucinate missing derivations or numbers; instead, insert TODO stubs that cite the source location (file + section heading) needed to fill the gap.
   + When source material is incomplete, do not hallucinate missing derivations or numbers; instead, insert TODO stubs that cite the source location (file + section heading) needed to fill the gap. When quoting numerical results from artifacts, include a provenance pointer (artifact path + key) so the number is traceable.
   ```

2. **`style_sources_used.md`, line 3** — Clarify sampling relationship:
   ```diff
   - This is a minimal "audit trail" of representative `.tex` sources that were manually inspected to extract writing/voice conventions. It is not an exhaustive corpus dump.
   + This is a minimal "audit trail" of representative `.tex` sources (sampled from the 42-project corpus listed in style_profile.md §7) that were manually inspected to extract writing/voice conventions. It is not an exhaustive corpus dump.
   ```
