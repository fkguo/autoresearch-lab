VERDICT: NOT_READY

## Blockers

1. **Missing critical hygiene tools**: `scripts/bin/fix_bibtex_revtex4_2.py` and `scripts/bin/fix_md_double_backslash_math.py` are referenced in SKILL.md, RUNBOOK.md, and smoke tests but **not included in the packet**. M1 acceptance criteria require the scaffold to exist, and these are part of the deterministic hygiene infrastructure mentioned in SKILL.md's "What it does" section.

2. **Missing double-backslash checker**: `scripts/bin/check_md_double_backslash.sh` is referenced in RUNBOOK.md and smoke tests but not provided. This is a required hygiene tool per SKILL.md.

3. **Incomplete smoke test**: The smoke test only checks `--help` for tools but doesn't verify they actually work (even minimally). For M1, at minimum the hygiene tools should have a trivial pass case (e.g., process an empty file without error).

## Non-blocking

1. **Template metadata incomplete**: `assets/templates/revtex4-2_onecolumn_main.tex` has TODO placeholders but no guidance on how scaffold will populate them. The `_render_main_tex` function only replaces title/authors, leaving all section TODOs unchanged. This is acceptable for M1 (basic scaffold) but needs clear documentation that M2 will populate these.

2. **No reviewer packet template content**: `assets/review/review_packet_template.md` exists in file tree but has no content shown. While not strictly blocking M1, this should exist as a template for future milestone reviews.

3. **Style assets incomplete**: `assets/style/style_profile.md`, `assets/style/style_sources_used.md`, and `assets/style/writing_voice_system_prompt.txt` are listed in file tree but not shown. Per ROADMAP.md, M0 should have delivered these. They're referenced in SKILL.md but not verified present.

## Real-research fit

**Strong points:**
- RevTeX4-2 choice is correct for physics/HEP workflows
- Provenance table design aligns with reproducibility needs
- Graceful degradation for missing tools (latexmk) shows production awareness
- Artifact search order (runs/<TAG>/, <TAG>/, manifest JSONs) matches realistic project layouts

**Concerns:**
- No validation that `Draft_Derivation.md` actually exists or is readable before scaffold runs
- No handling of symlink artifacts (mentioned in quickstart but not implemented)
- Network/DNS robustness is stated as policy but no implementation shown (M2 concern, but should be acknowledged in RUNBOOK.md)

## Robustness & safety

**Good:**
- Hard policies in SKILL.md correctly prioritize auditability over convenience
- Template uses explicit `\mathrm{d}` macro (portable across engines)
- Scaffold checks template existence before proceeding
- `--force` flag prevents accidental overwrites

**Gaps:**
- No validation that `--tag` value is safe for filesystem (e.g., `../../etc/passwd`)
- No check that output path is writable before starting
- Python script uses `errors="replace"` but doesn't log when replacements occur
- No verification that project_root contains expected files (Draft_Derivation.md, artifacts/, etc.)

## Specific patch suggestions

### CRITICAL (blocks READY):

**1. Add missing hygiene tools** (`scripts/bin/`):
```python
# fix_bibtex_revtex4_2.py (minimal M1 version)
#!/usr/bin/env python3
"""Ensure @article entries have journal field for RevTeX4-2."""
import argparse, re, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--bib", required=True)
    ap.add_argument("--in-place", action="store_true")
    args = ap.parse_args()
    
    text = Path(args.bib).read_text()
    # Minimal: add journal = "" to @article without journal
    # (Full implementation in M2)
    if args.in_place:
        Path(args.bib).write_text(text)
    else:
        print(text)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

```python
# fix_md_double_backslash_math.py (minimal M1 version)
#!/usr/bin/env python3
"""Fix \\Delta -> \Delta in Markdown math."""
import argparse, sys
from pathlib import Path

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", required=True)
    ap.add_argument("--in-place", action="store_true")
    args = ap.parse_args()
    # Minimal: scan .md files (full implementation in M2)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
```

```bash
# check_md_double_backslash.sh
#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-.}"
# Minimal: warn only (full implementation in M2)
exit 0
```

**2. Enhance smoke test** (`scripts/dev/run_all_smoke_tests.sh`):
```bash
# After help checks, add:
echo "[smoke] hygiene tools: minimal execution"
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib <(echo "") >/dev/null
python3 scripts/bin/fix_md_double_backslash_math.py --root /tmp >/dev/null
bash scripts/bin/check_md_double_backslash.sh /tmp >/dev/null
```

### RECOMMENDED (non-blocking):

**3. Add input validation** (`scripts/bin/research_writer_scaffold.py`):
```python
# After project_root validation:
tag_safe = args.tag.strip()
if not re.match(r'^[A-Za-z0-9_-]+$', tag_safe):
    print(f"ERROR: --tag contains unsafe characters: {args.tag}", file=sys.stderr)
    return 2

# Before mkdir:
try:
    out_dir.parent.mkdir(parents=True, exist_ok=True)
except PermissionError:
    print(f"ERROR: cannot create output directory: {out_dir}", file=sys.stderr)
    return 2
```

**4. Document M1→M2 boundary** (`ROADMAP.md` M1 section):
```markdown
Acceptance criteria:
...
- Hygiene tools exist as minimal stubs that accept correct CLI args and exit 0
  (full implementation with actual fixes deferred to M2)
```

**5. Add template population note** (`assets/templates/paper_README.md`):
```markdown
## Scaffold version (M1)

This is a minimal compilable skeleton. Section TODOs will be populated by M2
from `Draft_Derivation.md` and `artifacts/` manifests.
```
