# 固定基线与证据范围

- 主工程：当前仓库的 `GridTone/`，复用现有工程，无另建主项目。
- 固定基线：`0f9977725a68930aa57f93369828a041de860586`，乐构 1.5.0。
- 计划登记提交：`6affd57`。当时会话引用缺少附件，随后收到施工计划 ZIP，原文保存在 `spec/`。
- 开发分支：`codex/gridtone-studio`；目标远端：`zzliu-coder/musiclego` 的 `main`。
- 用户已有 `design/legou/pre-refresh-project.gridtone` 和根目录旧版 ZIP 未纳入新提交，也未被改写。
- 本轮按功能依赖实施；提交记录是实际保存点，不为尚未验收的阶段补造“通过”标签。

## 已知问题与处理

| 问题 | 基线证据 | 1.6 对应实现 / 检查 |
|---|---|---|
| F01 16 小节读取冲突 | `evidence/baseline.json` 记录固定版本真实校验错误 | model 的 PATTERN_BARS；contracts、workflow |
| F02 减半变成 240 ticks | 固定版本真实界面输入 80 / 120，实际输出 240 | durationNotes；contracts 时间矩阵 |
| F03 单 autosave | 固定版本 io.js 源码记录 | ProjectRepository；storage 实际同源刷新、跨标签页 |
| F04 和声说明缺失 | 固定版本 progression 输出结构 | harmony、generation 元数据；harmony / generation 测试 |
| F05 小屏反馈 | 用户本轮明确推迟小屏专题 | 不计为本轮完整移动端通过 |
| F06 旧验证入口 | 固定 package.json 指向旧 Python 浏览器套件 | scripts/verify.mjs 与严格发行门槛 |
| F07 长时间轴压缩 | 固定 arrange.js 的 1200px 总宽限制 | 每小节 96px 的滚动编辑轴；256 小节浏览器测量 |

`baseline.json` 中的 CONFIRMED_DEFECT 表示复现了旧问题；它不是新应用功能通过计数。

## 测试入口清单

| 入口 | 当前用途 |
|---|---|
| `npm test` | 当前 model / editing / command / harmony / generation / playback / gesture / catalog 核心测试 |
| `npm run verify` | 当前构建、核心、真实同源存储、工作流、三种导出、指针与焦点、桌面视觉、离线音频 |
| `npm run verify:soak` | 独立运行满 30 分钟的 8 轨 / 32 小节回归，记录堆和 DOM 资源趋势 |
| `npm run verify:release` | 上述工程检查、长测及 87 项验收门槛；必需项未通过时非零退出 |
| `tests/verify-baseline.mjs` | 在隔离 origin 只读复现固定 1.5.0 行为，并比较旧工程迁移音乐事件 |
| `tests/legou-browser.js` | 原有行为断言在本轮构建上重新执行，结果写入 interactions.json |
| `tests/*_browser.py`、`run_browser_tests.py`、`tests/legacy-v1/` | 历史界面脚本，保留参考，当前标准验收不调用 |
| `tests/studio-browser.js`、旧 `design/legou/*results.json` | 历史证据；不直接挪用旧 PASS 作为本轮结果 |

## 证据可追溯性

每个当前浏览器报告写入所加载 HTML 的 SHA-256；统一验证记录实际进程退出码和原始日志。旧 fixture 位于 `evidence/fixtures/legacy-v1.gridtone` 与 `legacy-v2.gridtone`；完整成功路径、MIDI、WAV 和长测工程也放在同一目录。

硬件验收环境：Apple M3 MacBook Air、8 核、16 GB 内存、macOS 26.6.2 arm64；浏览器版本由音频基准报告记录。没有把设备序列号或用户私人作品放进证据包。
