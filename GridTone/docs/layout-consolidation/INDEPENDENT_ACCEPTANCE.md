# 独立布局验收

验收人：子代理 layout_acceptance。日期：2026-09-19。

## 结论

本轮发现的 P1 布局问题已由主代理修复，关键路径复验通过：侧栏开启时编排工具重叠、模板库试听被卷走、和弦库采用按钮不可见。当前没有已知未修复 P1。不能将此结论扩展为全部 43 页、全部业务分支已实测通过。

最终窄屏使用 Chrome DevTools 可见设备工具栏输入 **691×682 CSS 像素**；AX 同时确认宽高。截图在适合窗口缩放下观察。宽窗为原生 Chrome；精确 1440×900 的最终尺寸指标由主线程证据承担，本子代理没有独立 DOM 测量结果。没有将截图物理像素等同 CSS 像素。

使用原生 Chrome 独立新标签 `http://127.0.0.1:8001/`，未触碰用户 `localhost:8001` 项目。只做导航、搜索、候选准备；没有采用方案、改音符、导入、删除或授权录音。关闭前已确认设备工具栏 Value=0，关闭 DevTools，关闭自己的隔离标签，Chrome 回到原来的 New Tab。

## 证据口径

- **UI PASS**：实际打开并观察所列检查点；不代表该页每个业务按钮都执行。
- **SOURCE PASS / UI NOT_PROVEN**：当前源码具备所列实现，最终视觉或业务行为未独立实测。
- **NOT_PROVEN**：该断言未完成独立验收。
- UI 证据为本任务 CUA 工具流中的 AX 与截图，未额外保存本轮截图文件。主线程的 430 项测试与构建哈希属于主线程证据，未冒称独立执行。

## 已发现并推动修复

|问题|复验结果|
|---|---|
|编排合并工具条在侧栏打开后互相覆盖，目标名称逐字竖排|UI PASS：最新宽窗属性侧栏打开，目标正常换行且动作分组无覆盖；691 窄屏也没有该重叠|
|组合库试听按钮位于详情滚动内容底部，首屏不可见|UI PASS：691×682 详情的试听、拿到编排、指定小节、新建作品全部可见|
|composer 仅 sticky 不足以让下方采用按钮首屏出现|UI PASS：691×682 列表和详情均固定显示试听方案、停止、放入 4 小节|
|窄屏模板分类抽屉内部缺返回入口|UI PASS：抽屉内返回结果可见且获得焦点；退出后焦点回分类与收藏|
|模板详情返回列表丢失焦点|UI PASS：返回结果后 AX 焦点回到夜间口袋卡片|
|演奏处理 select 撑压标签为竖排、流程图先于参数|SOURCE PASS：pipeline 参数前置、流程与写入折叠；field-row select 布局修正。最终视觉 NOT_PROVEN|
|品牌与项目仍有多个入口、全曲 Swing 在局部视图工具中|品牌合并 UI PASS；全曲 Swing 迁移 SOURCE PASS|

## 43 页覆盖账本

源码路径相对 GridTone；只对本轮具体断言给出结论。

|#|界面|独立结果与证据|
|---|---|---|
|01|编排|UI PASS：宽窗五轨与紧凑头部；侧栏打开后复验无动作覆盖；691 头部两行、目标与结构动作分行。`views/shell.js`、`styles/workspace.css`。|
|02|单轨钢琴卷帘|SOURCE PASS：唯一 editbar、工具名称时间选区、视图操作组；UI NOT_PROVEN：最终 expanded 1440 画布≥600px未测。`views/editor.js`。|
|03|节奏与乐句库|UI PASS：宽窗 77 项、分页、三列卡片；精确结果区≥520px NOT_PROVEN。`views/studio-library.js`。|
|04|混音|UI 已打开五通道并观察完整推子；最终折叠效果与窄总输出 SOURCE PASS / 最终 UI NOT_PROVEN。`views/mix.js`、`styles/mix.css`。|
|05|混音准备|UI PASS：目标与固定准备方案可见；未执行改稿。`views/creation.js`、`ui/tool-panel.js`。|
|06|混音候选|UI PASS：准备结果、原版比较与固定采用按钮可见；最终比较表改版仅 SOURCE PASS。实际采用撤销 NOT_PROVEN。|
|07|导出|UI 打开并确认三格式与范围；逐格式说明最终排版 SOURCE PASS。未实际导出文件。`app.js`。|
|08|我的作品|UI PASS：空列表、新建/导入/副本入口、维护默认折叠，展开出现恢复/重试/丢弃/下载。`app.js`。|
|09|恢复点|UI PASS：空状态说明、最近10点与30秒信息；非空恢复业务 NOT_PROVEN。`app.js`。|
|10|作品与设置|UI PASS：品牌项目合为一个入口、锚定菜单、Escape 返回入口焦点。`views/shell.js`、`ui/focus.js`。|
|11|外观|UI PASS：两个皮肤预览、减少动态和透明开关可见；未切换用户设置。`app.js`。|
|12|键盘|UI PASS：九项快捷操作、平台/IME说明；实际逐键操作 NOT_PROVEN。`app.js`。|
|13|帮助|SOURCE PASS：帮助按章节重组；UI NOT_PROVEN。`app.js`。|
|14|新增音轨|源码保留五角色入口；最终 UI NOT_PROVEN。`app.js`。|
|15|时间工具|UI PASS：作品长度/全轨时间段两 tab 实际切换，字段分离、清空与删除警告可见；未执行时间删除。`app.js`、`ui/focus.js`。|
|16|编排结构工具|SOURCE PASS：入口保留并整合到编排命令区域；完整展开 UI NOT_PROVEN。`app.js`。|
|17|发展片段|SOURCE PASS：共享候选固定头/滚动正文/操作区；独立业务分支 UI NOT_PROVEN。`views/creation.js`。|
|18|组合伴奏|SOURCE PASS：共享候选布局；独立业务分支 UI NOT_PROVEN。`views/creation.js`。|
|19|音轨属性|UI PASS：最新宽窗与691，名称/声部两列、作用于整轨、音量声像、轨内音乐块折叠。`views/inspector.js`。|
|20|本轨演奏|旧版竖排问题实测发现；最新参数优先/流程折叠与 select 宽度 SOURCE PASS，最终 UI NOT_PROVEN。`views/pipeline.js`、`styles/tool-panel.css`。|
|21|本轨声音|UI 已打开确认整轨作用域与选择/试听入口；最终并排布局 SOURCE PASS / UI NOT_PROVEN。`views/inspector.js`。|
|22|声音参数|UI PASS：声音性格/效果两列、六滑杆、固定试听与完成；没有修改值。`views/sound.js`、`ui/focus.js`。|
|23|声音资源|SOURCE PASS：两列资源布局与目标；录音/采样非空 UI NOT_PROVEN。`views/sound.js`、`styles/dialogs.css`。|
|24|鼓组资源列表|SOURCE PASS：鼓件摘要替代重复描述、选择后指定整轨；UI NOT_PROVEN。`views/catalog.js`。|
|25|鼓组应用目标|源码保留目标与新轨分支；UI NOT_PROVEN，未采用鼓组。`views/catalog.js`。|
|26|音色库|SOURCE PASS：按当前材料计算有效分类，鼓/旋律分域；最终 UI NOT_PROVEN。`views/studio-library.js`。|
|27|合成器编辑|SOURCE PASS：包络相关两列布局；实际修改/保持独立音色 UI NOT_PROVEN。`views/sound.js`。|
|28|视图与输入|SOURCE PASS：局部视图工具与全曲 Swing 分离；UI NOT_PROVEN。`views/inspector.js`、`app.js`。|
|29|音乐块生成与关系|UI PASS：691 选中和弦音乐块→生成/变化→独立/关联关系、和弦生成、回答句、结尾入口可读。`views/inspector.js`。|
|30|和弦进行|UI PASS：宽窗观察36进行；最新691两列列表、详情预览、固定试听/停止/放入。焦点问题见下。`views/composer.js`、`ui/tool-panel.js`。|
|31|旋律参数|SOURCE PASS：共享候选准备布局；最终 UI NOT_PROVEN。`views/creation.js`。|
|32|旋律候选|SOURCE PASS：共享固定试听采用与只读预览；独立候选业务 UI NOT_PROVEN。`views/creation.js`。|
|33|和弦标注|SOURCE PASS：宽五列/窄两列声明与原字段；UI NOT_PROVEN。`styles/dialogs.css`、`views/creation.js`。|
|34|音符工具|SOURCE PASS：音高/时间/力度分组；UI NOT_PROVEN。`views/inspector.js`。|
|35|精确编辑|共享 modal 固定 footer 源码保留；UI NOT_PROVEN。`app.js`、`ui/focus.js`。|
|36|移调|SOURCE PASS：按模式仅显示半音/目标主音/调式有效字段；实际切换 UI NOT_PROVEN。`ui/focus.js`、`app.js`。|
|37|鼓格编辑|SOURCE PASS：编辑器工具布局整合；八行/十六行滚动最终 UI NOT_PROVEN。`views/editor.js`。|
|38|鼓变化|SOURCE PASS：共享候选准备/采用布局；UI NOT_PROVEN。`views/creation.js`。|
|39|资源管理|源码入口与空态保留；非空、导入失败 UI NOT_PROVEN。`views/catalog.js`。|
|40|组合模板|UI PASS：宽六家族三版本；最新691列表两列、详情固定四动作、返回和分类焦点。`views/studio-library.js`。|
|41|示例作品|UI PASS：五张独立作品卡，各一版本、独立新建入口；没有新建覆盖。`views/studio-library.js`。|
|42|模板空搜索|UI PASS：输入无匹配词后清空筛选可见；搜索焦点保持。窄屏空搜索未单独重复。|
|43|重命名|原对话与确认取消路径源码保留；长中文输入与实际重命名 UI NOT_PROVEN。`app.js`。|

## 补充分支（全部明确留痕）

|分支|验收状态|
|---|---|
|贝斯/伴奏生成器、节奏保留、锚点、结尾、回答句|共享结构源码已检查；逐分支音乐结果 NOT_PROVEN|
|单击落点、原生拖放、Escape 取消|源码作用域保留；本轮拖放端到端 NOT_PROVEN|
|批量串行/并行、目标重排、冲突返回|NOT_PROVEN|
|冻结候选、过期候选、非目标保持、单次撤销|本轮独立 UI NOT_PROVEN；不得用主线程单测冒充交互验收|
|全曲 Swing|迁移全局入口 SOURCE PASS；实际音频 NOT_PROVEN|
|音符/音乐块/空白右键菜单|源码路由保留；UI NOT_PROVEN|
|新作品/覆盖/删除/清空危险确认|只读检查保留；实际执行 NOT_PROVEN|
|录音权限/录音中/停止/取消|NOT_PROVEN，未触发权限|
|导入进度/错误/目标|NOT_PROVEN，未导入用户文件|
|可选资源下载/许可证/失败|NOT_PROVEN，未触发网络下载|
|保存失败/导出失败/过期提示|维护入口 UI PASS；故障注入 NOT_PROVEN|
|非空声音资源/缺失 ID|NOT_PROVEN|
|旧路由与兼容入口|源码保留，未删除；逐旧路由 UI NOT_PROVEN|

## 剩余事项

1. **P2 / composer 焦点已修复，最终 UI NOT_PROVEN**：修复前 691 下点击进行进入详情，AX focused element 回到 HTML body。主代理随后修复；独立读取最新 `src/views/composer.js:45-46` 确认 `focusNavigation` 在详情返回按钮可见时聚焦该按钮，否则聚焦选中卡片；select/browse 均调用。尝试重新打开隔离页复验时，CUA 返回 `The user changed Google Chrome.app`，重新观察确认用户已在使用其他页面，故未抢占用户浏览器。源码修复通过，最终焦点交互未复验。模板库对应行为已实际通过。
2. 精确 1440×900 画布高度、模板结果区高度，以及所有页面横向溢出数值，本子代理 **NOT_PROVEN**。
3. 音频是否好听、录音/导入/下载/导出产物与各编辑采用撤销语义，未由本轮布局浏览器验收覆盖。

验收遵循用户“所有界面单独检查”的覆盖账本要求；账本全面列项，实际浏览器证据覆盖关键路径，未测项不以共享 CSS 推定通过。
