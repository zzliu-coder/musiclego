# 跨页控件与布局打磨验收

日期：2026-09-20。基线：用户已确认的紧凑编排／音符工作台。

## 交付范围

统一了持久选中状态、输入与选择框、长文案换行、侧栏标题与操作分组、弹窗主次操作、库的结果区域、混音通道对齐及窄窗口覆盖层。保留音乐磁贴、音符、键盘、时间轴和混音推子的任务特征。使用 Impeccable 的 polish/craft-floor 检查方法；实际产品的轻拟物设计和已确认布局优先。

本轮只修改呈现、布局和表单反馈。音频引擎、模板内容、音乐命令算法未改。工程原有未提交改动保留；本轮未提交或推送 Git。

## 已覆盖页面

以下编号对应 REDESIGN_PLAN.md 的页面清单。每一项均打开检查；表内截图覆盖对应页面／相关状态，图片保存在 `evidence/cross-page/`。部分早期检查图记录迭代过程，最终复验图另列于下一节。

| 编号 | 页面 | 检查内容／证据 |
|---|---|---|
| 1 | 编排工作台 | 保持已确认结构；`workbench-final.png` |
| 2 | 展开音符编辑器 | 同一全局编辑栏、紧凑工具组，无重复本地编辑栏；`drum-expanded.png` |
| 3 | 节奏与乐句库 | 家族与细类、版本选中、结果网格；`library-rhythms.png` |
| 4 | 混音 | 单一标题、通道标题及推子对齐、主输出紧邻通道；`mix.png`、`packaged-mix.png` |
| 5 | 建议混音准备 | 固定目标、参数分组与主要动作；`mix-prepare.png` |
| 6 | 混音候选 | 方案选择及采用操作；`mix-candidate.png` |
| 7 | 导出 | 格式／范围与说明分组；`export.png` |
| 8 | 我的作品 | 存档列表、管理动作及标题换行；`projects.png` |
| 9 | 恢复点 | 可浏览、作用说明；未执行恢复；`recovery.png` |
| 10 | 作品与设置菜单 | 命令分组、紧凑间距；`workspace-menu.png` |
| 11 | 外观与动效 | 持久状态同一语法；`appearance.png` |
| 12 | 键盘与平台 | 选项与快捷键表；`keymap.png` |
| 13 | 帮助 | 章节导航及作用范围说明；`help.png` |
| 14 | 添加音轨 | 短任务表单与选择状态；`add-track.png` |
| 15 | 小节长度／时间编辑 | 两个子页均检查；`time-length.png`、`time-range.png` |
| 16 | 编排结构工具 | 左对齐的紧凑命令分组；`structure.png` |
| 17 | 发展编排 | 长“组织方式”字段独占一行；`arrange-prepare.png`、`arrange-candidate.png` |
| 18 | 声部一起变化 | 作用目标、参数和方案入口；`ensemble.png` |
| 19 | 音轨属性 | 本轨作用范围、基础平衡；`track-properties.png` |
| 20 | 演奏处理 | 分组、首段对齐及选项；`pipeline.png` |
| 21 | 本轨音色 | 当前音色、更换、资源入口层级；`track-sound.png` |
| 22 | 当前声音参数 | 两列标题／滑杆对齐；`sound-parameters.png` |
| 23 | 声音资源与导入 | 资源来源与导入影响说明；`sound-resources.png` |
| 24 | 鼓组与资源管理 | 资源卡片和操作；`drumkits.png` |
| 25 | 鼓组应用目标 | 目标说明及选择；`drumkit-target.png` |
| 26 | 音色库 | 去重标题、固定目标、库层级；`sound-library.png`、`sound-library-430.png` |
| 27 | 合成音色深入调整 | 分组字段与另存操作；`synth-edit.png` |
| 28 | 视图与输入辅助 | 本地显示选项；`view-input.png`；全局参数另见 `global-groove.png` |
| 29 | 音乐块工具 | 关系、生成、内容分区；`clip-tools.png` |
| 30 | 和弦进行 | 大屏双区、窄屏列表／详情、完整放置选项；`composer.png`、`composer-430.png` |
| 31 | 旋律生成准备 | 目标、保留音、范围与折叠；`melody-prepare.png`、`creation-430.png` |
| 32 | 旋律候选 | 准备／候选的主次操作；`melody-candidate.png` |
| 33 | 参考和弦复核 | 专用事件表保留桌面列数、窄屏分行；`harmony.png`、`harmony-430.png` |
| 34 | 选中音符工具 | 紧凑命令与作用范围；`note-tools.png` |
| 35 | 精细编辑 | 两列字段；修改前／后试听并列，提交靠右；`precision.png` |
| 36 | 移调与调式适配 | 三种方式的字段切换；`transpose.png` |
| 37 | 鼓组画板 | 展开工具、固定节奏尺；`drum-expanded.png` |
| 38 | 鼓型变化 | 参数、范围与准备操作；`drum-variation.png` |
| 39 | 素材集合与批量 | 收藏／待用导航、选择及放置冲突；`batch-short-conflict.png` |
| 40 | 组合模板 | 卡片和多轨预览；`library-combos.png` |
| 41 | 示例作品 | 新建作用说明；`library-examples.png` |
| 42 | 无结果 | 空状态跨结果区、可清空筛选；`library-empty.png` |
| 43 | 重命名 | 空值就地报错、聚焦输入；`rename-error.png` |

## 截图复验中的修正

- 修复通用表单双列样式影响和弦事件表的问题；专用音乐几何保留。
- 窄屏列表的名称、元信息、预览、描述各有明确网格位置，描述不再重叠；列表行不继承大卡片最小高度。
- 持久选中的 task-choice 在悬停时保持选中状态。
- 合成参数两列采用一致顶部间距；长组织方式、弹奏方式、放置方式单独占行。
- 展开音符编辑器复用全局编辑操作，去掉重复操作栏。
- 窄屏生成／和弦工具使用完整高度，主体可滚动，底部动作始终可达。
- 联查“先开音轨侧栏→进入音色库”发现覆盖顺序冲突，已修复。DOM命中检查确认库处于最前，8px上下留白，返回后侧栏保持。
- 库上下定位由CSS变量统一接收工作区边界；去掉抵消响应式的内联top/bottom。
- 移调和精细编辑的试听按钮相邻，提交按钮靠右，预览与采用有清楚分隔。

最终复验代表图：`library-rhythms.png`、`library-list-430.png`、`library-detail-430.png`、`sound-library-430.png`、`composer.png`、`composer-430.png`、`creation-430.png`、`structure.png`、`arrange-prepare.png`、`sound-parameters.png`、`note-tools.png`、`precision.png`、`transpose.png`、`packaged-mix.png`。

窗口设置覆盖1440×900、1100×620、430×800及用户实际窗口。浏览器已有缩放会影响CSS有效视口，文件名中的430表示测试窗口设置，不声称所有图片均为430 CSS px。覆盖层最终一次实测有效高度727px，库顶7.997px、底719.276px，命中位于库内部。结束时已撤销临时尺寸覆盖。

## 验证结果

| 检查 | 结果 |
|---|---|
| 全套 `npm test` | PASS：475/475，0失败、0跳过；新增10项跨页回归契约 |
| `npm run verify:design:source` | PASS：overrides=[]、literalErrors=[] |
| `git diff --check` | PASS |
| `npm run build` | PASS：独立HTML 2,947,664字节 |
| 打包版浏览器打开 | PASS：`/dist/index.html`；混音5个推子、1个混音任务标题 |
| 浏览器错误日志 | PASS：检查返回空数组 |
| 当前作品保持 | PASS：检查前后 `JSON.stringify(GridToneApp.getProject())` 完全相等，均31,601字符；结束时再比较仍相等 |
| 独立子代理验收 | PASS：代码与465项当时既有测试；第一轮发现的CSS冲突修复后复查通过。最后新增10项与窄屏层级修正由主代理实测和测试覆盖 |
| 空名称错误 | PASS：实际清空输入提交后出现就地错误与输入焦点；未改作品名称 |
| 批量放置冲突 | PASS：选择已占用鼓轨后显示冲突，试听与确认禁用；取消后原稿不变 |
| 模态键盘边界 | PASS：参考和弦弹窗Tab在模态控件内循环，包含summary/textarea选择器 |

构建SHA-256：`5c50cc45e798093ebe65fbd5598eae17a6f1c01f516b399883b49ed15e0d91c6`。

## 限制与未执行项目

- 页面打开和视觉验收覆盖上述清单；这不等于穷尽所有数据组合、全部窗口尺寸及所有33个历史状态排列。
- 本轮没有为验收触发麦克风授权、外部音源下载、真实文件导入、作品删除或恢复、采用生成结果、执行批量写入。相关外部／破坏性行为记为 NOT_PROVEN，原自动测试覆盖保留。
- 本轮没有新增声音或改动音频算法；听感、外部设备和跨浏览器兼容性未重新全面测评。
- 打包版以本机HTTP打开完成冒烟检查；离线file://模式未在本轮重测。
- 已保留更新后的本机工作台供用户继续使用，未推送GitHub。
