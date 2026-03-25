# Prompt: 2026-03-25 `EVO-12` Slice 2 — Minimal Real Skill-Pack Auto-Safe Onboarding

> 默认继承 `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`。
> 本批只处理 `packages/skills-market/**` 上的 install-side lifecycle authority follow-up。

## 0. Scope Lock

本批唯一目标：

1. 仅对两个真实 `skill-pack` 做 immutable ref + `install_policy.auto_safe` onboarding：
   - `codex-cli-runner`
   - `auto-relay`
2. 新增独立 rollout 测试，证明这两个 package 在 `--source-root <repo>` 条件下可通过 `--auto-safe` 成功安装。
3. 将 `packages/skills-market/README.md` 的 rollout wording 从“尚未 rollout”收紧到“仅这两个 package 已 limited rollout”。

## 1. Explicitly Out Of Scope

以下内容都不允许顺手带入：

1. `EVO-12a`
2. usage / frequency / success-rate health reporting
3. deprecated / retire automation
4. broader catalog rollout
5. `source.repo` authority repoint 到 monorepo `skills/`
6. symlink-route auto-safe parity
7. compatibility / export mirror updates
8. `packages/skills-market/scripts/install_skill_runtime/**` 或 `market_install_policy.py` 的非必要改写

如果实现过程中发现只有改 installer/runtime 才能继续，必须先证明是 direct install-side blocker；否则停止并回报，而不是静默扩批。

## 2. Required Reads Before Coding

至少读取：

1. `AGENTS.md`
2. `meta/docs/prompts/IMPLEMENTATION_PROMPT_CHECKLIST.md`
3. `meta/REDESIGN_PLAN.md` 中 `EVO-12`
4. `meta/remediation_tracker_v1.json` 中 `EVO-12`
5. 本文件
6. `packages/skills-market/README.md`
7. `packages/skills-market/packages/auto-relay.json`
8. `packages/skills-market/packages/codex-cli-runner.json`
9. `packages/skills-market/tests/test_validate_market.py`
10. `packages/skills-market/tests/test_install_skill_auto_safe.py`

## 3. Locked Decisions

1. `source.repo` authority 保持现状：`autoresearch-lab/skills`
2. `source.ref` 必须使用该 source authority 的真实 immutable commit SHA；拿不到就 fail-closed，不允许占位 SHA
3. 本批固定只 onboard `codex-cli-runner` + `auto-relay`
4. `auto-relay` 作为真实 Python runtime onboarding representative；测试可以用 bounded seam 保持本地可复现，但不能改写 metadata authority
5. README 只做最小 operator-facing truth sync；`docs/SYMLINK_INSTALL.md` 默认不改，除非 live contradiction 被证明不可分离

## 4. Acceptance Commands

```bash
git diff --check
python3 packages/skills-market/scripts/validate_market.py
python3 -m pytest \
  packages/skills-market/tests/test_validate_market.py \
  packages/skills-market/tests/test_install_skill.py \
  packages/skills-market/tests/test_install_skill_auto_safe.py \
  packages/skills-market/tests/test_auto_safe_market_package_rollout.py -q
```

## 5. Review Packet Minimum

formal review packet 默认至少包含：

1. `packages/skills-market/packages/codex-cli-runner.json`
2. `packages/skills-market/packages/auto-relay.json`
3. `packages/skills-market/tests/test_auto_safe_market_package_rollout.py`
4. `packages/skills-market/README.md`
5. 实现仍依赖的 install authority files（schema / validator / installer / install flow）

若当前 worktree 在 review 前已 dirty 或新增文件，默认先执行：

```bash
npx gitnexus analyze --force
```

然后至少补：

1. `detect_changes`
2. 必要时 `context` / `impact`
3. Front-door Surface Audit（至少检查 `packages/skills-market/README.md`，并说明 `docs/SYMLINK_INSTALL.md` 是否适用）

## 6. Governance Order

1. implementation commit 前不要修改：
   - `AGENTS.md`
   - `meta/remediation_tracker_v1.json`
   - `meta/REDESIGN_PLAN.md`
2. bounded implementation commit 后，再做 closeout sync
3. closeout 必须明确：
   - 本批为何仍是 `EVO-12` slice 2，而不是 `EVO-12a`
   - absorb-now 仅包含这两个 package 的 onboarding
   - 其余 catalog rollout 仍未开始
