# 1.7 测试入口清单

本轮证据统一写入 `docs/closure-v2/evidence/current/`，每个运行报告携带构建 SHA-256。历史套件与固定基线复现不计入当前通过数量。

| 文件 | 归属与运行方式 |
|---|---|
| `tests/acceptance_browser.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/browser-harness.mjs` | 当前真实 HTTP 来源浏览器测试基础设施 |
| `tests/catalog.test.mjs` | 当前核心合同 · `npm test` |
| `tests/closure-gate.test.mjs` | 当前核心合同 · `npm test` |
| `tests/closure-properties.test.mjs` | 当前核心合同 · `npm test` |
| `tests/closure.test.mjs` | 当前核心合同 · `npm test` |
| `tests/contracts.test.mjs` | 当前核心合同 · `npm test` |
| `tests/core.test.mjs` | 当前核心合同 · `npm test` |
| `tests/core_browser_regression.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/editing.test.mjs` | 当前核心合同 · `npm test` |
| `tests/editor_browser.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/fixtures/README.md` | 夹具／辅助／手动历史入口 · 不单独计为通过 |
| `tests/generation.test.mjs` | 当前核心合同 · `npm test` |
| `tests/gestures.test.cjs` | 当前核心合同 · `npm test` |
| `tests/harmony.test.mjs` | 当前核心合同 · `npm test` |
| `tests/legacy-v1/browser_test.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/legacy-v1/bundle_smoke.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/legou-browser.js` | 当前动效与播放回归 · 由 verify-interactions.mjs 实际执行 |
| `tests/legou-fixture.js` | 夹具／辅助／手动历史入口 · 不单独计为通过 |
| `tests/playback.test.mjs` | 当前核心合同 · `npm test` |
| `tests/playback_browser.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/prism.test.mjs` | 当前核心合同 · `npm test` |
| `tests/prism_browser.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/run_browser_tests.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/session.test.mjs` | 当前核心合同 · `npm test` |
| `tests/studio-browser.js` | 夹具／辅助／手动历史入口 · 不单独计为通过 |
| `tests/studio.test.mjs` | 当前核心合同 · `npm test` |
| `tests/ui_checkpoint.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |
| `tests/verify-audio.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-baseline.mjs` | 固定旧提交缺陷复现 · 保留原始失败，不计当前功能通过 |
| `tests/verify-closure-baseline.mjs` | 固定旧提交缺陷复现 · 保留原始失败，不计当前功能通过 |
| `tests/verify-closure.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-cross-browser.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-css-migration.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-gate-injection.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-interactions.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-journey.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-long-timeline.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-real-banks.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-release-flow.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-save-feedback.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-soak.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-storage.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-visual.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/verify-workflow.mjs` | 当前浏览器／发行专项 · 独立脚本；主入口见 scripts/verify.mjs |
| `tests/visual_review.py` | 历史 inline DOM 或旧版工具 · 不作为1.7验收；对应功能迁移到当前 storage/workflow/interactions/release-flow/visual/audio 套件 |

## 当前必需检查

- `npm run verify`：构建、182项核心合同、真实来源存储、工作流、下载回读、指针/键盘、候选与录音、长时间轴、视觉及63段音频信号检查。
- `verify-journey.mjs`：两布局连续18步控制器级流程、全曲/选区音频及独立HTML重开。
- `verify-soak.mjs`：30分钟8轨32小节负载及最终真实刷新。
- `verify-cross-browser.mjs` 与原生Safari记录：macOS浏览器范围；WebKit不代替Safari。
- `verify-real-banks.mjs`：6套真实下载，内嵌保存后阻断外网重开渲染。
- `verify-gate-injection.mjs`：用明确标识的合成验收账测试发布门禁进程退出码，不充当产品完成证据。
- `verify-css-migration.mjs`：使用固定旧HTML/JS对比当前CSS；需要Git历史，独立源码包不以此脚本代替核心重建。
- `package-release.mjs`：已提交源码归档、独立安装/构建/测试及交付HTML哈希比对。

人工音乐审听单独记录。小屏、Android、Windows依据用户指示排除。
