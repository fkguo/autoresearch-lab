# NEW-05 Monorepo Migration Design

> **Date**: 2026-02-24
> **Status**: Approved
> **Scope**: REDESIGN_PLAN Phase 0 — NEW-05 + NEW-R13 (concurrent)

## Decisions

| Decision | Choice |
|----------|--------|
| Location | `/Users/fkg/Coding/Agents/autoresearch/` (sibling to current `Autoresearch/`) |
| Git strategy | Fresh start; archive tags on original repos |
| npm scope | `@autoresearch/*` (was `@hep-research/*`) |
| Package rename | `hep-research-mcp` → `hep-mcp` (NEW-R13) |
| skills placement | Root `skills/`, not under `packages/` |
| Excluded | `idea-runs/`, `docs/`, `reviews/`, `scripts/`, `skills-publish-tree/` |

## Target Structure

```
autoresearch/
├── packages/
│   ├── hep-mcp/                  # TS MCP server (renamed from hep-research-mcp)
│   ├── shared/                   # TS shared types + utils
│   ├── pdg-mcp/                  # TS PDG tools
│   ├── zotero-mcp/               # TS Zotero tools
│   ├── hep-autoresearch/         # Python orchestrator (retiring)
│   ├── idea-core/                # Python idea engine (retiring)
│   ├── idea-generator/           # JSON Schema SSOT + validation scripts
│   ├── skills-market/            # Python skill marketplace
│   ├── orchestrator/             # TS new orchestrator (NEW-05a Stage 1, empty scaffold)
│   ├── idea-engine/              # TS idea engine (NEW-05a Stage 3, empty scaffold)
│   └── agent-arxiv/              # TS Agent-arXiv (EVO-15, empty scaffold)
├── skills/                       # Skill implementations (Bash + Python + wolframscript)
│   ├── hep-calc/
│   ├── hepar/
│   ├── research-team/
│   ├── research-writer/
│   ├── review-swarm/
│   └── ... (17 skills total)
├── meta/                         # Project governance (was autoresearch-meta)
│   ├── schemas/                  # JSON Schema SSOT
│   ├── scripts/                  # codegen, lint, CI scripts
│   ├── docs/                     # Design docs, plans
│   └── REDESIGN_PLAN.md
├── pnpm-workspace.yaml           # TS package management
├── package.json                  # Root workspace package
├── tsconfig.json                 # Root TS config (from hep-research-mcp-main)
├── Makefile                      # Top-level: codegen, lint, test, smoke
├── AGENTS.md
├── CLAUDE.md                     # Updated path mappings
├── .gitignore
└── .github/workflows/ci.yml
```

## Source Mapping

| Source (current disk) | Target (monorepo) | Method |
|-----------------------|-------------------|--------|
| `hep-research-mcp-main/packages/hep-research-mcp/` | `packages/hep-mcp/` | Copy + rename |
| `hep-research-mcp-main/packages/shared/` | `packages/shared/` | Copy |
| `hep-research-mcp-main/packages/pdg-mcp/` | `packages/pdg-mcp/` | Copy |
| `hep-research-mcp-main/packages/zotero-mcp/` | `packages/zotero-mcp/` | Copy |
| `hep-research-mcp-main/tsconfig.json` | `tsconfig.json` | Copy + adapt |
| `hep-research-mcp-main/package.json` | `package.json` | Rewrite |
| `hep-research-mcp-main/pnpm-workspace.yaml` | `pnpm-workspace.yaml` | Rewrite |
| `hep-autoresearch/` | `packages/hep-autoresearch/` | Copy |
| `idea-core/` | `packages/idea-core/` | Copy |
| `idea-generator/` | `packages/idea-generator/` | Copy |
| `skills-market/` | `packages/skills-market/` | Copy |
| `skills/` | `skills/` | Copy |
| `autoresearch-meta/` | `meta/` | Copy |
| `Autoresearch/AGENTS.md` | `AGENTS.md` | Copy |
| `Autoresearch/CLAUDE.md` | `CLAUDE.md` | Copy + update paths |

## Package Rename Details (NEW-R13)

All internal imports and package.json references change:

| Old | New |
|-----|-----|
| `@hep-research/hep-research-mcp` | `@autoresearch/hep-mcp` |
| `@hep-research/shared` | `@autoresearch/shared` |
| `@hep-research/pdg-mcp` | `@autoresearch/pdg-mcp` |
| `@hep-research/zotero-mcp` | `@autoresearch/zotero-mcp` |

All `import ... from '@hep-research/...'` statements must be updated across the TS codebase.

## New TS Package Scaffolds (NEW-05a Stage 1)

Minimal scaffolds for future TS packages. Each gets:
- `package.json` with name, version 0.0.1, no deps yet
- `tsconfig.json` extending root
- `src/index.ts` with a placeholder export
- Entry in `pnpm-workspace.yaml`

Packages: `orchestrator`, `idea-engine`, `agent-arxiv`

## Configuration Files

### pnpm-workspace.yaml
```yaml
packages:
  - "packages/*"
```

### Root package.json
```json
{
  "name": "autoresearch",
  "private": true,
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "clean": "pnpm -r clean"
  }
}
```

### Makefile targets
- `codegen`: JSON Schema → TS/Python type generation
- `codegen-check`: Verify generated files match committed
- `lint`: pnpm lint + Python linting
- `test`: pnpm test + pytest
- `smoke`: End-to-end smoke test (MCP server starts, responds to listTools)
- `code-health-check`: NEW-R02a CI gate scripts

### .github/workflows/ci.yml
- Triggered on push/PR
- Steps: install → build → lint → test → codegen-check → smoke
- Covers SYNC-05/06, C-04, REL-01 gates

## Execution Steps

1. Tag all 6 git repos with `archive/pre-monorepo`
2. Create `/Users/fkg/Coding/Agents/autoresearch/` and `git init`
3. Copy files per source mapping table (excluding .git, node_modules, __pycache__, dist, .env)
4. Create new config files (pnpm-workspace.yaml, root package.json, Makefile, .gitignore)
5. Rename packages: `@hep-research/*` → `@autoresearch/*` in all package.json + import statements
6. Rename directory: `hep-research-mcp` → `hep-mcp`
7. Create empty scaffolds for orchestrator, idea-engine, agent-arxiv
8. `pnpm install` → `pnpm build` → `pnpm test` to verify
9. Create CI workflow
10. Initial commit
11. Update CLAUDE.md path mappings

## Verification Checklist

- [ ] All TS packages build without errors
- [ ] All existing tests pass (`pnpm -r test`)
- [ ] `@autoresearch/*` imports resolve correctly
- [ ] Python packages importable (`python -c "import hep_autoresearch"`)
- [ ] MCP server starts and responds to listTools
- [ ] No `@hep-research/` references remain in codebase
- [ ] CLAUDE.md paths updated
- [ ] `make codegen-check` placeholder works
