# NEW-R08 — Published Skill-Pack Payload LOC/Modularity Governance Rebaseline

## Goal

Rebaseline `NEW-R08` against the current checked-in skills ecosystem without doing runtime/package implementation work. This lane is governance-only: it updates the item's authoritative wording so it reflects the live published `skill-pack` payload boundary, the current CODE-01.1 checker behavior, and the real scale of the backlog.

The deliverable is not “split every oversized skill script now.” The deliverable is a truthful governance baseline plus a bounded future-work framing.

## Required Reads

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. the full `NEW-R08` section in `meta/REDESIGN_PLAN.md`
4. `meta/ECOSYSTEM_DEV_CONTRACT.md` `CODE-01`
5. `meta/scripts/check_loc.py`
6. `packages/skills-market/README.md`
7. `packages/skills-market/packages/index.json`
8. `packages/skills-market/packages/*.json`
9. `packages/skills-market/scripts/install_skill_runtime/source_payload.py`
10. `packages/skills-market/scripts/install_skill_runtime/package_contracts.py`
11. current checked-in `skills/**`
12. `packages/**` only as needed to confirm live packaging/distribution truth

## Authority Rules

- The authoritative maintenance/distribution boundary for `NEW-R08` is the published `skill-pack` payload defined by `packages/skills-market/packages/*.json` via `source.subpath` + `source.include`/`source.exclude`.
- Raw checked-in `skills/**` remains relevant as local source material, but it is not by itself the primary backlog boundary for `NEW-R08`.
- Nonpublished repo-local skills such as `.system` remain subject to generic `CODE-01` when touched, but they must not redefine `NEW-R08`.
- `meta/scripts/check_loc.py` is the current live repo-wide `CODE-01.1` implementation. Record its real suffix coverage truth; do not claim broader enforcement than the code actually provides.

## Exact Source-Proof Commands

Run these commands and paste their exact outputs into the closeout.

### 1. Published payload summary

```bash
python3 - <<'PY'
from pathlib import Path
import json, sys
root = Path.cwd()
sys.path.insert(0, str(root / 'packages' / 'skills-market' / 'scripts'))
from install_skill_runtime.source_payload import collect_payload_files
market_root = root / 'packages' / 'skills-market' / 'packages'

def loc(fp):
    c = 0
    for line in fp.read_text(errors='ignore').splitlines():
        s = line.strip()
        if not s or s.startswith('#') or s.startswith('//') or s.startswith('/*') or s == '*/' or s.startswith('*'):
            continue
        c += 1
    return c

package_count = 0
payload_files = 0
payload_script_files = 0
payload_over200 = 0
payload_over200_unexempt = 0

for path in sorted(market_root.glob('*.json')):
    if path.name == 'index.json':
        continue
    data = json.loads(path.read_text())
    if data.get('package_type') != 'skill-pack':
        continue
    package_count += 1
    source = data['source']
    files = collect_payload_files(root / source['subpath'], source['include'], source.get('exclude', []))
    payload_files += len(files)
    for fp in files:
        if 'scripts' not in fp.parts or fp.suffix not in {'.py', '.sh', '.ts', '.js', '.jl'}:
            continue
        payload_script_files += 1
        n = loc(fp)
        if n > 200:
            payload_over200 += 1
            header = '\n'.join(fp.read_text(errors='ignore').splitlines()[:5])
            if 'CONTRACT-EXEMPT: CODE-01.1' not in header:
                payload_over200_unexempt += 1

print(f'published_skill_packs={package_count}')
print(f'payload_files={payload_files}')
print(f'payload_script_files={payload_script_files}')
print(f'payload_over200={payload_over200}')
print(f'payload_over200_unexempt={payload_over200_unexempt}')
PY
```

### 2. Suffix coverage proof

```bash
python3 - <<'PY'
from pathlib import Path
import json, sys
from collections import Counter
root = Path.cwd()
sys.path.insert(0, str(root / 'packages' / 'skills-market' / 'scripts'))
from install_skill_runtime.source_payload import collect_payload_files
market_root = root / 'packages' / 'skills-market' / 'packages'

def loc(fp):
    c = 0
    for line in fp.read_text(errors='ignore').splitlines():
        s = line.strip()
        if not s or s.startswith('#') or s.startswith('//') or s.startswith('/*') or s == '*/' or s.startswith('*'):
            continue
        c += 1
    return c

counter = Counter()
for path in sorted(market_root.glob('*.json')):
    if path.name == 'index.json':
        continue
    data = json.loads(path.read_text())
    if data.get('package_type') != 'skill-pack':
        continue
    source = data['source']
    files = collect_payload_files(root / source['subpath'], source['include'], source.get('exclude', []))
    for fp in files:
        if 'scripts' not in fp.parts or fp.suffix not in {'.py', '.sh', '.ts', '.js', '.jl'}:
            continue
        n = loc(fp)
        if n > 200:
            header = '\n'.join(fp.read_text(errors='ignore').splitlines()[:5])
            counter[(fp.suffix, 'all')] += 1
            if 'CONTRACT-EXEMPT: CODE-01.1' in header:
                counter[(fp.suffix, 'exempt')] += 1
            else:
                counter[(fp.suffix, 'unexempt')] += 1

covered = {'.py': 'yes', '.ts': 'yes', '.js': 'yes', '.sh': 'no', '.jl': 'no'}
print('suffix\tover200\texempt\tunexempt\tcovered_by_check_loc')
for suffix in sorted({key[0] for key in counter}):
    print(f"{suffix}\t{counter[(suffix, 'all')]}\t{counter[(suffix, 'exempt')]}\t{counter[(suffix, 'unexempt')]}\t{covered.get(suffix, 'no')}")
PY
```

### 3. Dominant skill-cluster concentration proof

```bash
python3 - <<'PY'
from pathlib import Path
import json, sys
root = Path.cwd()
sys.path.insert(0, str(root / 'packages' / 'skills-market' / 'scripts'))
from install_skill_runtime.source_payload import collect_payload_files
market_root = root / 'packages' / 'skills-market' / 'packages'

def loc(fp):
    c = 0
    for line in fp.read_text(errors='ignore').splitlines():
        s = line.strip()
        if not s or s.startswith('#') or s.startswith('//') or s.startswith('/*') or s == '*/' or s.startswith('*'):
            continue
        c += 1
    return c

print('package_id\tpayload_files\tpayload_script_files\tpayload_over200\tpayload_over200_unexempt')
for path in sorted(market_root.glob('*.json')):
    if path.name == 'index.json':
        continue
    data = json.loads(path.read_text())
    if data.get('package_type') != 'skill-pack':
        continue
    source = data['source']
    files = collect_payload_files(root / source['subpath'], source['include'], source.get('exclude', []))
    script_files = [fp for fp in files if 'scripts' in fp.parts and fp.suffix in {'.py', '.sh', '.ts', '.js', '.jl'}]
    over200 = [fp for fp in script_files if loc(fp) > 200]
    unexempt = [fp for fp in over200 if 'CONTRACT-EXEMPT: CODE-01.1' not in '\n'.join(fp.read_text(errors='ignore').splitlines()[:5])]
    print(f"{path.stem}\t{len(files)}\t{len(script_files)}\t{len(over200)}\t{len(unexempt)}")
PY
```

## Required Changes

1. Update `meta/REDESIGN_PLAN.md` so `NEW-R08` no longer claims a stale “6 scripts” cleanup.
2. Update `meta/remediation_tracker_v1.json` so `NEW-R08` remains pending but is renamed and described as a published-payload governance backlog with the current source-proof totals.
3. Check in this canonical prompt as the governance artifact for the rebaseline lane.

## Explicit No-Go

- no edits under `packages/**`
- no skill-script decomposition or refactor
- no `check_loc.py` implementation change
- no `skills-market` metadata change
- no market installer/runtime/package behavior change
- no review fallback reviewer if one of the required backends fails
- no commit, push, or merge without explicit coordinator authorization

## Acceptance

- `git diff --check`
- `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null`
- rerun the exact source-proof commands above and paste the exact outputs into closeout
- explicitly confirm whether `packages/**` stayed untouched

## Review Packet

The packet must include:

- current and rewritten `NEW-R08` plan/tracker wording
- `meta/ECOSYSTEM_DEV_CONTRACT.md` `CODE-01`
- `meta/scripts/check_loc.py`
- `packages/skills-market` payload authority (`README.md`, `packages/*.json`, installer payload collector)
- the published-payload source-proof outputs
- the explicit conclusion that this lane is governance-only and leaves `packages/**` untouched

## Review Requirements

1. Formal three-reviewer review:
   - `Opus`
   - `Gemini-3.1-Pro-Preview`
   - `OpenCode(zhipuai-coding-plan/glm-5.1)`
2. If any reviewer backend is unavailable, record the exact failure and stop for coordinator decision. Do not use a fallback reviewer.
3. Formal self-review after reviewer convergence.

## Historical-Prompt Rule

Treat older phase/batch prompts that mention `NEW-R08` as historical artifacts. Do not rewrite them unless they are being re-promoted as live authority.

## Closeout Template

Use this exact template:

```text
[lane]:
`NEW-R08 skills LOC budget rebaseline`

[branch]:
`codex/new-r08-skills-loc-budget-rebaseline`

[worktree]:
`/Users/fkg/Coding/Agents/autoresearch-lab-new-r08-skills-loc-budget-rebaseline`

[status]:
`done_pending_version_control_authorization | blocked`

[head]:
`<git-head>`

[scope]:
`what was inspected, what governance files changed, and whether packages/** stayed untouched`

[authority_check]:
- `current live authority` -> `<summary>`
- `current gap / stale wording` -> `<summary>`
- `smallest truthful next deliverable` -> `<summary>`
- `did item remain pending or change` -> `<reason>`

[acceptance]:
- `git status --short` -> `<output>`
- `git diff --check` -> `pass/fail`
- `python3 -m json.tool meta/remediation_tracker_v1.json >/dev/null` -> `pass/fail`
- `targeted source-proof command(s)` -> `<summary>`
- `packages/** untouched` -> `yes/no`

[review]:
- `Opus` -> `<verdict>`
- `Gemini-3.1-Pro-Preview` -> `<verdict>`
- `OpenCode(zhipuai-coding-plan/glm-5.1)` -> `<verdict>`
- `self-review` -> `<verdict>`
- `adopted/deferred/declined amendments` -> `<summary>`

[governance_touch]:
`yes/no`

[plan_mode]:
`required`

[blocker]:
`none | <reason>`

[next_action]:
`await coordinator decision`
```
