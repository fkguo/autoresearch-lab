# Prompt: 2026-03-15 Standalone — `NEW-R03b` Batch A：Python 活跃 runtime / RPC 异常边界收口

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
>
> 本文件对应一个新的实现对话。
>
> 目标不是“把仓里所有 `except Exception` 一次性扫光”。
> 这批只做一件事：
>
> 把**仍在 active runtime / RPC / eval 边界上决定错误语义**的宽泛 Python catch 收口成：
>
> - 具体异常类型；或
> - 明确、少量、带理由的 `CONTRACT-EXEMPT`
>
> 并补齐对应的 regression/tests。

## 0. 为什么下一批是它

`UX-01` + `UX-05` 已收口，Phase 1 现在只剩一个 pending：`NEW-R03b`。

`meta/REDESIGN_PLAN.md` 已经把它定义成：

- 不引入 `AutoresearchError`
- Python 侧采用标准异常层次 + 域特定异常类
- 把宽泛 catch 从 active authority path 上拿掉

但 `NEW-R03b` 不能按“281 个 broad handlers 一次做完”来开工。那样只会得到一份过宽、不可验证、最后靠 `CONTRACT-EXEMPT` 糊过去的 prompt。

所以这批必须先切第一刀：

- 只打 active runtime / RPC / eval boundary
- 只处理那些**现在还在决定 public/runtime behavior** 的宽泛 catch
- best-effort cleanup / optional-read / diagnostic-fallthrough 这类已经明确是 `CONTRACT-EXEMPT` 的点，不在本批展开

这批做完后，Phase 1 才能以“错误语义边界已经不再靠裸 `Exception` 兜底”进入真正 closeout 状态。

## 1. 本批要解决什么

当前 Python 侧仍有一组 catch，虽然数量不多，但位置都很关键：

1. MCP stdio client 的写请求 / initialize 边界仍在用宽泛 `except Exception as e`
2. eval runner 的 schema / JSON / pointer 读取路径仍有多处宽泛 catch
3. retry / run-card / RPC server 等边界仍有“任何异常都一把抓”的写法
4. `idea-core` 的 orchestration / retry path 里，还有少量会直接决定 failed-result / deny / parse-error 语义的宽泛 catch

这些点的问题不是“代码风格不好看”，而是：

- 它们仍在决定 runtime 对外怎么解释失败
- 它们让 transport / parse / validation / programmer-error 混在一起
- 它们让 review 很难判断 suppression 到底是设计、还是 accidental fallback

## 2. 本批硬边界

### 2.1 In scope

只处理以下文件里的 active boundary catches，以及为了它们新增/更新的相邻测试：

- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evals.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/retry.py`
- `packages/hep-autoresearch/src/hep_autoresearch/toolkit/run_card.py`
- `packages/idea-core/src/idea_core/rpc/server.py`
- `packages/idea-core/src/idea_core/hepar/retry_ops.py`
- `packages/idea-core/src/idea_core/hepar/orchestrator.py`

必要时允许：

- 在各自 package 内新增**很薄**的局部异常类型文件或模块内异常类
- 更新这些文件的相邻 tests / fixtures / regression checks
  - 这里的“相邻 tests”只指这些 target files 自己已有或需要新增的 tests，不包括碰巧 import 到它们的无关模块测试
- 新增一个 CI-ready 的 diff-scoped / file-scoped 检查脚本，用于锁定“本批 target files 不再出现裸 broad catch”

### 2.2 Out of scope

本批明确禁止：

- 全仓 sweep 所有 281 个 broad handlers
- 修改任何**不在本批 7 个 target files 内** 的 broad catch，即使它们与本批文件相邻、或刚好出现在同一个 diff 里
- 顺手清 `packages/hep-autoresearch/src/hep_autoresearch/toolkit/ingest.py`
- 顺手清 `paper_reviser.py` / `method_design.py` / `adapters/shell.py` 大体量文件
- 新建 repo-wide `AutoresearchError`
- 新建一个覆盖全仓的巨型 `errors.py`
- 把所有 broad catch 机械改成一堆无语义的 `ValueError`
- 仅仅给 active authority catch 加注释就算完成
- 借题发挥推进 TS migration / runtime redesign / lane 外 refactor

## 3. 本批的正确目标状态

完成后，本批 target files 应满足：

1. 决定 runtime / RPC / eval public behavior 的 catch，不再是无差别 `except Exception`
2. transport / parse / schema / timeout / caller misuse 这些失败类型，至少在 boundary 上被区分开
3. 如果某个 broad catch 必须保留，必须：
   - 真的是 fail-closed 或 diagnostic boundary
   - 带 `CONTRACT-EXEMPT`
   - 注释说明为什么这里 broad catch 是正确设计
4. 新异常类型必须是局部、语义明确的，不准再造一层 pseudo-framework
5. 对应 error path 有 regression/tests，而不是“看代码觉得应该没问题”

## 4. 设计规则

### 4.1 不要引入统一错误大一统

明确禁止：

- `AutoresearchError`
- `PythonRuntimeErrorBase`
- repo-wide shared Python exception hierarchy

允许的是**局部、薄、语义明确**的异常，例如：

- transport / protocol / parse / validation / retry exhaustion 这类边界名词

但是否真的要新增类，必须看具体场景；能用标准异常清楚表达时，不要额外造类。

### 4.2 broad catch 只允许两种结局

对本批 target files 中当前的 broad catch，只允许两种结局：

1. 改成具体异常类型
2. 明确保留为 `CONTRACT-EXEMPT`

第三种结局不允许：

- 原样保留且无说明

### 4.3 programmer error 不能伪装成 runtime fallback

像下面这些东西，不应被包装成“正常 runtime failure”：

- 明显的类型错误
- 本地逻辑 bug
- 非预期的 programming mistake

如果某个边界必须把未知异常转成 failed result，也要明确这是 fail-closed boundary，而不是 silent fallback。

### 4.4 保留 `from exc`

凡是把一个底层异常转换成更明确的边界异常或 `RuntimeError` / `ValueError`，默认保留 `raise ... from exc`，不要把原因链切断。

## 5. 本批优先处理的具体问题

### 5.1 `mcp_stdio_client.py`

重点看：

- `_request()` 写 stdin 的失败
- `initialize()` 对 `_request("initialize", ...)` 的包装

要求：

- 不要再用一个 broad catch 把所有写失败 / startup failure / protocol failure 混成同一种错误
- 至少把 I/O / timeout / protocol-shape 这几类边界分开

### 5.2 `evals.py`

重点看：

- case schema validation
- artifact schema validation
- JSON 读取
- pointer 解析

要求：

- JSON 读失败、pointer 缺失、schema invalid 这几类不应共享同一种 broad fallback
- 保持 deterministic user-facing messages

### 5.3 `retry.py` 与 `idea_core/hepar/retry_ops.py`

重点看：

- retry loop 现在是“catch all then filter”

要求：

- 改成只 catch retryable tuple 或等价的明确边界
- 不要把非 retryable programmer error 也纳入 retry control flow

### 5.4 `run_card.py`

重点看：

- `relative_to(repo_root)` 的 broad fallback

要求：

- 如果这里只需要处理相对路径越界 / 不能 relative 的情形，就改成具体异常

### 5.5 `idea_core/rpc/server.py`

重点看：

- stdin request parse path
- `handle_request()` 的 internal-error safety belt

要求：

- parse error、invalid request、internal error 的边界不要继续混淆
- 真正保底的 broad catch 若保留，必须明确 why

### 5.6 `idea_core/hepar/orchestrator.py`

重点看：

- `_execute_role()` 里把 executor 失败转成 `WorkResult(status="failed")` 的路径

要求：

- 明确这里是 fail-closed runtime boundary，而不是 silent suppression
- 若 broad catch 仍需要存在，必须有 `CONTRACT-EXEMPT` + regression 证明语义正确

## 6. 开工前必须读取

至少完整读取：

1. `AGENTS.md`
2. `meta/remediation_tracker_v1.json`
3. `meta/REDESIGN_PLAN.md`
4. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
5. `meta/docs/2026-02-20-deep-refactoring-analysis.md`
6. 本文件
7. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/mcp_stdio_client.py`
8. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/evals.py`
9. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/retry.py`
10. `packages/hep-autoresearch/src/hep_autoresearch/toolkit/run_card.py`
11. `packages/idea-core/src/idea_core/rpc/server.py`
12. `packages/idea-core/src/idea_core/hepar/retry_ops.py`
13. `packages/idea-core/src/idea_core/hepar/orchestrator.py`
14. 相邻 tests

此外，必须显式遵循 `IMPLEMENTATION_PROMPT_CHECKLIST.md` §2 的 GitNexus 生命周期要求：

- 开工前 freshness check
- 审核前按 dirty worktree 规则 refresh
- post-change 用 `detect_changes` / `impact` / `context`；若 MCP transport 失败，必须记录失败并回退到直接源码检查 + exact tests

如果 implementation 过程中发现需要把 scope 拉到 `runtime_adapter.py` 或其他大文件，必须先说明为什么当前 prompt 边界不够，再决定是否扩 scope；禁止默认顺手拉入。

## 7. 验收要求

至少包含：

- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/hep-autoresearch/tests -q`
- `PYTHONPYCACHEPREFIX=/tmp/pycache python3 -m pytest packages/idea-core/tests -q`
- 新增或更新的 targeted tests
- `git diff --check`

并新增一个**精确到本批 target files** 的 broad-catch gate，至少验证：

- 本批 target files 中，不再存在未解释的 `except Exception` / `except Exception as e`
- 保留的 broad catch 必须带 `CONTRACT-EXEMPT`

这个 gate 应该落成可复用、可进 CI 的脚本，而不是一次性的 ad-hoc grep。

并且，每一个被修改的 broad catch 都必须有对应的 error-path test 覆盖；不接受只靠 happy-path 测试或人工阅读来证明行为正确。

注意：

- 不要把 gate 扩成全仓 blocker
- 只锁本批 target files，避免 prompt scope 漂移

## 8. 完成定义

只有同时满足以下条件，这批才算完成：

1. 本批 target files 的 active boundary catches 已收口
2. broad catch 不再承担未解释的 public/runtime authority
3. 保留的 broad catch 都有明确 `CONTRACT-EXEMPT`
4. regression/tests 覆盖关键 error path
5. formal `review-swarm` 0 blocking
6. `self-review` 0 blocking

正式 `review-swarm` reviewer 固定为：

- `Opus`
- `Gemini-3.1-Pro-Preview`
- `OpenCode(kimi-for-coding/k2p5)`

## 9. 审核重点

`review-swarm` 和 `self-review` 必须明确检查：

1. 有没有只是把 broad catch 换个壳，而没有真正分离错误语义
2. 有没有把 programmer error 错误地塞进 retry / fallback
3. 有没有把本该 narrow 的 catch 机械改成 `ValueError`
4. 有没有把 lane 扩到 `ingest.py` / `paper_reviser.py` / `method_design.py` 这类大文件
5. 新增 tests 是否真的锁住 error path，而不是只跑 happy path
6. H-01 / `McpError` 错误码映射参考有没有在本批应触达的 MCP/RPC boundary 上被明确处理，而不是被静默跳过

## 10. SSOT 同步要求

实现收尾时：

- `meta/remediation_tracker_v1.json`：按实际 closeout 更新 `NEW-R03b`
- `AGENTS.md`：同步 Phase 1 状态
- `meta/REDESIGN_PLAN.md`：仅在需要把 `NEW-R03b` 分裂成多个 bounded follow-up 时才更新；否则不写流水账
- `.serena/memories/architecture-decisions.md`：只有当本批沉淀出长期稳定的 Python boundary invariant 时才更新

关于 `REDESIGN_PLAN.md` 中“错误码与 H-01 `McpError` 错误码映射表对齐（供 MCP 边界转换参考）”这条验收：

- 本 Batch A 必须在**本批 target files 触达的 MCP / RPC boundary** 上明确处理这一点
- 但不要求在本批完成 repo-wide 的 Python error-code 对齐
- 如果实现后仍有剩余 repo-wide mapping debt，必须在 closeout 里明确写成后续 `NEW-R03b` follow-up，而不是静默略过
