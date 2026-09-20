# 四项评审修复与验收

日期：2026-09-20。基线提交：`6f4bbb483c3154421d5781d6a5fff1bea4b5fe4b5fe4b`。
评审包 SHA-256：`8a7cd388eaa4cb641df7a28dff706e90c2ef5fb39f0f5d412d1156572c4c138f`。

## 修复范围

1. **播放重排**：取消与重新排程共用 `now + 3ms` 切换点，使用相同的边界容差。切换点之前已排程的声音保留，之后重新排程，并立即调用 tick。变速以切换点的音乐位置为锚，保持临近音符连续。轨道增删等原有结构性重启路径未改动。
2. **重叠音符**：SVG 按最新数据数组顺序移动 keyed 节点。已有根节点保持身份，更新属性和内部图形，音符和力度层共用补丁。倒序命中与绘制层叠一致，保留静态网格、手势捕获和 rAF 合并。
3. **编辑热路径**：`cloneProject` 深复制音符与采样元数据，复用不可变采样字符串；`projectEquals` 比较正文引用/字符串值和音乐/元数据，避免 JSON 序列化大正文。WeakMap 只复用同一正文的格式校验结果，正文更换和外部导入仍校验；元数据一直校验。命令结果提交复用 `changed` 和已校验文档，直接手势仍有校验边界。常用编辑命令不再套一层重复命令提交。保存入队仍捕获独立快照。
4. **恢复点**：IndexedDB 升级到 v3，增加轻量 `recovery-index`，在升级事务中一次性回填旧恢复点大小。普通保存读取索引、不读取恢复正文；只有新增恢复点时才整理历史。文档、版本、索引、恢复正文处于同一事务；30 秒间隔、每作品 10 个、历史总量 120 MiB 限制保留。列表和删除也使用索引。

项目文件仍为 v3，原生 JavaScript、Web Audio、撤销模型和界面保持。数据库版本与项目文件版本是两件事。升级后旧版本网页需刷新，旧构建不能以数据库 v2 打开已升级的本机数据库；工程导出文件的格式不变。升级会一次读取已有恢复正文，以后普通保存不再重复读取。当前作品保存本身仍需写入完整文档，此轮没有迁移采样到独立资源仓库。

## 实际验证

| 检查 | 结果 |
|---|---|
| `npm test` | **488 PASS，0 FAIL，0 跳过**；原 475 项及新增 13 项 |
| `npm run build` | PASS；开发入口与离线单文件重新生成 |
| `python3 scripts/audit-design-source.py` | PASS；无新样式覆盖、无样式字面值错误 |
| 可控音频时钟，生产 AudioEngine | 7 个起音前后时刻、连续更新、循环边界、变速，未漏排或重复 |
| Chromium 真实 SVG / IndexedDB | 8 组 PASS：节点身份/顺序、入队快照、禁止历史正文读取、数量/预算、冲突、故障回滚与队列恢复、删除、v2/旧格式迁移 |
| 完整应用和离线单文件，真实鼠标 | 修改 → 撤销 → 重做，数据/SVG/可见顶层/选中音符始终一致 |
| 4 MiB WAV 完整页面音符编辑 | 校验 **1** 次、比较 **1** 次，最大一次 JSON 序列化 **937 字符**；离线构建本轮操作约 11.8ms（含绘制，单次观察） |
| 完整应用删除 → 撤销 → 保存 → 页面刷新 | PASS；音符恢复，采样正文不变 |
| 真实 Web Audio 调度，编辑另一轨 | 源码入口 180 次编辑 / 31 个起音；最终离线构建 180 次编辑 / 28 个起音，逐个核对源节点 start/stop，没有漏排或重复 |

浏览器：macOS HeadlessChrome 153，通过 Playwright CLI 的独立测试配置运行，未操作用户当前页或用户作品。临时 `review-test-*` 数据库测试后删除。音频检查根据实际 Web Audio 源节点的排程、取消时间，**不代表扬声器听感已验收**。控制台只有 favicon 404，没有应用异常。

## 同机生产函数微基准

`node scripts/benchmark-review-edits.mjs 6f4bbb4` 对比当前代码与 Git 中的旧 model/commands。1,024 音符；三次预热、五次测量取中位数；Node v22.22.3。

| 内嵌采样字符串 | 修改前 | 修改后 |
|---|---:|---:|
| 0 MiB | 6.965ms | 5.280ms |
| 4 MiB | 128.966ms | 6.647ms |
| 8 MiB | 264.024ms | 4.227ms |

测量包含编辑快照、生产命令、提交校验/比较、保存快照。排除 DOM、音频和 IndexedDB；数值会随环境/JIT 波动，8 MiB 小于 4 MiB 没有业务含义。普通编辑的正文序列化次数为零另有断言保证。

## 复验入口

- `npm test`
- `npm run build`
- `node scripts/benchmark-review-edits.mjs 6f4bbb4`
- 本机启动后访问 `/tests/review-browser.html`，点击“运行隔离测试”，读取 `reviewResults`。测试直接加载生产模块；预算压力部分使用合成容量元数据，普通保存读取隔离测试使用实际 4 MiB 历史正文。
- 在**独立测试浏览器配置**打开 `/` 或 `/dist/index.html`，加载 `/tests/review-app.js`。`reviewApp.setup()` 创建带有效 WAV 的重叠音符工程；`transform()` 断言校验/比较/序列化次数；`check()` 核验层叠并返回实际重叠处坐标供鼠标点击。使用页面撤销/重做按钮，逐步比对 `GridToneApp.getState().selected` 与 `check().top`。`liveAudio()` 运行真实源节点调度回归。此完整页面测试会保存合成工程，勿在用户浏览器配置里运行。

旧设计冻结哈希测试的白名单已登记本次用户授权的存储改变；没有替换旧基线哈希来掩盖修改。

## 限制 / NOT_PROVEN

`npm run verify:design` 中 catalog、build、core 通过，后续历史 Python 浏览器脚本因 `ModuleNotFoundError: playwright` 中断；该综合命令不计通过。本轮改用可用的 Playwright CLI 完成上述专项浏览器验证。没有宣称重跑全部旧浏览器/音色套件、600 秒 soak、Safari、真实移动触控、设备听感。

Web API 语义核对：[MDN stop()](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop)、[MDN getAll()](https://developer.mozilla.org/en-US/docs/Web/API/IDBObjectStore/getAll)。

最终单文件：`dist/index.html`，2,950,905 bytes。
SHA-256：`7d14c9f55e25f435a852130c5966ccdc0b7a859a7b0c146a682af18b0e9fd768`。
runtimeDigest：`e529a529687f9fec8bf76e3a1a932407684ef86c4b4207af0dfdaab3aeae984c`。
