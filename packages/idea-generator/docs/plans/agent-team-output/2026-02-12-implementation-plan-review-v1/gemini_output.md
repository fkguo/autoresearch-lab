VERDICT: READY

## Blockers
None. The plan is methodically structured, decoupled, and evidence-first.

## Non-blocking
1. **Schema Versioning Policy**: M1 defines validation tools but lacks an explicit task to define the versioning strategy (e.g., SemVer vs. CalendarVer) for the JSON-RPC contracts and DomainPacks. This is crucial for long-term plugin compatibility.
2. **Data Directory Isolation**: M2.1 (`IdeaStore`) implies file I/O. To strict adhere to `AGENTS.md` hygiene ("Do not leave research-team scaffolds... in this repo"), the implementation plan should explicitly mandate that the `IdeaStore` default path respects a `HEP_DATA_DIR` or similar environment variable, preventing accidental data commits.
3. **RPC Compliance Suite**: M2.3 mentions a server skeleton. It would be beneficial to explicitly task an "RPC Compliance Test Suite" (client-side test runner) to verify the server against the OpenRPC spec automatically.

## Real-research fit
- **Evidence-First**: The inclusion of `novelty_delta_table` (M3.4) and `GroundingAudit Gate` (M2.8) directly addresses the "hallucination vs. innovation" tension in theoretical physics.
- **Negative Results**: M5.4 (Failure Library) is a high-value feature often missed in standard software engineering but critical for research efficiency (avoiding dead ends).
- **HEP Specifics**: M3 correctly identifies the need for a `formalism registry` and `retrieval recipes`, ensuring the agent speaks the language of the domain (Lagrangians, amplitudes) rather than generic text.

## Robustness & safety
- **Circuit Breakers**: M2.4 appropriately plans for budget/step limits.
- **Drift Guard**: M1.6 provides a necessary hard gate against schema/implementation divergence.
- **Clean Room**: M5.2 enforces "clean-room" protocols for review, essential for unbiased evaluation.

## Specific patch suggestions

**1. Enforce Data Isolation in `docs/plans/2026-02-12-implementation-plan-tracker.md`**
*Goal: Prevent research data from polluting the code repository.*

```markdown
<<<<
  - Acceptance：能写入/读取 `IdeaNode`；`node.list` 可分页遍历全部节点（cursor/total_count）。
====
  - Acceptance：能写入/读取 `IdeaNode`；`node.list` 可分页遍历全部节点（cursor/total_count）；**必须支持 `IDEA_STORE_PATH` 环境变量，禁止默认写入代码库目录**。
>>>>
```

**2. Add Versioning Policy to `docs/plans/2026-02-12-implementation-plan-tracker.md`**
*Goal: Ensure backward compatibility for future DomainPacks.*

```markdown
<<<<
  - Acceptance：CI 检测到 OpenRPC 复制粘贴 schema 或 schema 漂移时直接失败（或最小脚本可检测并报错）。

**产物**
====
  - Acceptance：CI 检测到 OpenRPC 复制粘贴 schema 或 schema 漂移时直接失败（或最小脚本可检测并报错）。
- [ ] **M1.7** Schema Versioning Policy (SemVer/CalVer)
  - Acceptance：制定文档明确 schema 变更（breaking vs non-breaking）的版本号递增规则，并在 CI 中检查。

**产物**
>>>>
```

**3. Explicit RPC Compliance Testing in `docs/plans/2026-02-12-implementation-plan-tracker.md`**
*Goal: Automated verification of the API contract.*

```markdown
<<<<
  - Acceptance：每个方法都有可执行的最小实现（哪怕 stub），并返回 schema-valid 响应。
====
  - Acceptance：每个方法都有可执行的最小实现（哪怕 stub），并返回 schema-valid 响应；建立 **RPC Compliance Suite** (client-side test) 自动验证实现符合 OpenRPC 定义。
>>>>
```
