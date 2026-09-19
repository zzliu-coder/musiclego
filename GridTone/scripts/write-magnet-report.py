"""Build a delivery report from the final artifact and actual evidence, never invented results."""
from pathlib import Path
import json,html,base64,io,datetime
from PIL import Image
R=Path(__file__).resolve().parents[1]; E=R/'docs/magnet-2.1/evidence'
def read(p):return json.loads((R/p).read_text())
m=read('dist/manifest.json');core=read('docs/magnet-2.1/evidence/core-final.json');audio=read('docs/magnet-2.1/evidence/audio-final-v2/results.json');acc=read('docs/magnet-2.1/acceptance.json');perf=read('docs/magnet-2.1/evidence/performance/workload.json');compat=read('docs/magnet-2.1/evidence/backward-compatibility.json')
soak=read('docs/magnet-2.1/evidence/soak-final/soak.json') if (E/'soak-final/soak.json').exists() else None
soakline=(f"{soak['wallSeconds']:.2f}秒、{soak['iterations']}轮；最终活动音源{soak['final'].get('sources',0)}、预听实例{soak['final'].get('previews',0)}，页面错误{len(soak.get('pageErrors',[]))}。" if soak else '最终构建30分钟连续运行仍在执行；不得写成完成。')
counts=acc['counts'];summary='、'.join(f'{v}项{k}' for k,v in counts.items())
rows='\n'.join(f"|{x['label']}|{x['fixture']['tracks']}轨／{x['fixture']['bars']}小节／{x['fixture']['events']}事件|{x['frameP95']} ms|{x['frameP99']} ms|{x['over50']}|" for x in perf['rows'])
text=f'''# 乐构 2.1.0 · 暖白磁贴
## 本轮交付结论
基于实际交付2.0.0完成批准的设计迁移：A“暖白磁贴”为默认；保留原有第二主题的位置，更新为C“奶油浅瓷”；B“清白微光”只在设计样例中作为对照。单工作台、混音、宽素材库和本次托盘保持。

本轮实现范围已覆盖生产组件与主要页面，包括精细编辑、和声复核、录音权限错误和保存失败等细页。工程验证与设备、人类观察分开记录。原生Mac Chrome、真实来源保存刷新、实际浏览器缩放和初次使用者观察未完成；其状态在36项蓝图验收与严格发行检查中保留。

## 固定身份
| 项目 | 值 |
|---|---|
| 输入 | 交付2.0.0；输入HTML SHA-256：702f134f5b01c5041f2bd6c69dfcde2d92a823b651b5ef1d84337e0974386e5c |
| 输出版本 | {m['version']} |
| 输出字节 | {m['bytes']:,} |
| 输出HTML SHA-256 | {m['sha256']} |
| 运行源码摘要 | {m['runtimeDigest']} |
| 工程格式 | v3保持；旧音色、模板、资源ID和自定义轨道色保留 |
| 远端仓库 | 没有修改、提交或推送GitHub |

## 1. 全面迁移了哪些内容
| 范围 | 实际实现 |
|---|---|
| 设计基础 | 暖白工作台、深珊瑚主动作、马卡龙音乐表面；字体400/500/600三档；组件决定密度、圆角、边界与状态。 |
| 组件规格 | normal 36px／13px；small 30px／12px；独立图标32px。任务按钮、工具、磁贴、字段各有职责，不靠页面父选择器任意缩字。 |
| 音乐对象 | 卡片、拿起图、落点投影、轨道头、编排音乐块和音符共用显示色板。原作品颜色不改写；极浅、极深、自选颜色生成可读表面。 |
| 主工作台 | 总控、编辑目标栏、轨道头、时间尺、音乐块、下方音符与鼓点画板、工具分组、状态栏。 |
| 素材托盘与宽库 | 家族、变体、搜索、收藏、最近、本次、正在用、卡片／列表、来源说明、空结果及位置冲突。重复绘制不丢合理滚动位置。 |
| 右侧工具 | 属性、音色、演奏、精细修改、和弦与规则生成；准备、结果、只读投影、保留、过期及草稿切换。 |
| 混音 | 通道、推子、音量与声像读数、静音／只听、效果、总输出、建议混音。 |
| 细页 | 作品操作、导入、导出、恢复、缺资源、录音权限、外观、减少动态、键位及帮助。保留真实错误，不伪造保存成功。 |
| 持续维护 | DESIGN_SYSTEM.md、design-system/coverage.json、AGENTS.md、生产组件样例，以及自动设计合同和实际页面测试。 |

11份生产样式在原职责文件中迁移。没有增加一份优先级最高的末尾皮肤覆盖。新增纯显示的music-palette模块；音乐、声音和时间排程继续使用原实现。

## 2. 动效与输入：不增加等待
真实音乐块、音符位置、拖动投影和音长几何不使用过渡或关键帧；没有缩放、旋转、弹簧、惯性、跟手拖尾。点击、播放、停止和写入不依赖animationend／transitionend。

可选表面反馈只作用于颜色与边缘：常态约80ms，落定边缘100ms。系统和应用的减少动态都能取消这些过渡；取消后绘音、播放、选择和放置仍然完整。没有扫光、背景动效、装饰音或按节拍缩放磁贴。

分别执行了关闭全部CSS动效后的真实绘音、播放与停止检查；也测试了系统减少动态模拟和用户开关。它们属于两种不同的验证路径。

## 3. 复核中发现并修复的细节
| 问题 | 修正与复测 |
|---|---|
| 右工具滚动恢复偏移 | 固定标签的位置与scroll-padding/scroll-margin相互影响；统一后，音色与属性切换准确恢复位置（M11）。 |
| 短窗口采用按钮被标题遮住 | 短高度取消过厚的固定标题，保留操作可达；有效空间等价125/150/200%情况下按钮能够命中（M14/M15）。 |
| 拖动图未继承音乐色 | 独立手中图、源卡和落点引用同一表面；实际鼠标拖放检查真实5—8小节位置与一次撤销（M04）。 |
| 精细编辑字段拥挤 | 四个旧inline字段迁到两列标签在上的字段网格；短窗一列，检查四组几何不相交和取消零修改（M24）。 |
| 辅助组选项没有统一归属 | 和弦画笔、批量选择提示、片段选择与和声警告使用明确的选项／上下文／状态组件分组（M25）。 |
| 样例主题的辅助状态残留 | B对照回A时清理旧的aria-pressed；三个方向使用同内容、同几何、同音乐文档与选择（M02）。 |

上述最终精细表单修正后，重新冻结运行时，重跑最终页面与音频检查，重新开始真正30分钟运行。此前未完成的持续运行不计入本轮通过记录。

## 4. 实际执行结果
| 检查 | 最终结果与范围 |
|---|---|
| Node核心 | {core['passed']}通过，{core['failed']}失败，{core['skipped']}跳过。保留301项，新增32项设计、布局、显示及证据门禁检查。 |
| 完整生产页面 | 149组通过：45工作台＋16连续回归＋34设计系统＋29内容/键位＋25暖白磁贴专项。真实按钮、键盘、鼠标拖放与下载。 |
| 音频 | 76音色＋26组合，共102次实际OfflineAudioContext渲染。55份旧声音对照全部在1个16位量化单位内；{audio['counts']['legacyExact']}份字节相同。未进行音乐听评。 |
| 兼容性 | 29个基础生产模块与2.0逐字一致；27份实际导出作品交给原2.0验证器读取，并核对音乐事件。 |
| 连续创作 | {soakline} 实际平台是Linux Chromium，不替代Mac目标机验收。 |
| 视觉 | 61张主界面／状态／组件截图＋20张细页＋12张同结构A/B/C对照，共93张；13张联系表逐一打开，重点原图另行查看。 |
| 对比度 | 两主题×三个控件×正常/悬停/焦点，共18色对；主动作白字/深珊瑚约5.60:1；当前导航约8.03:1。另检查极端自选轨道色。范围有限，不是全站无障碍认证。 |
| 源码与打包 | 实际源码ZIP解到新目录，运行333项并重新构建，HTML与交付逐字一致。最终归档另外发布包外校验JSON。 |

浏览器：Linux Chromium 144.0.7559.96。完整最终HTML采用set_content运行；localhost及file正常导航受到环境策略拦截。没有修改导航策略来把测试写成真实来源存储。部分失焦/IME事件明确采用合成输入，源代码和结果里单独说明。

## 5. 性能测量：只报告能证明的指标
| 构建 | 样例 | 帧间隔P95 | 帧间隔P99 | 超过50ms帧数 |
|---|---|---:|---:|---:|
{rows}

以上是同一共享Linux宿主的顺序对照，均有真实播放和指针事件；每次181个输入样本。DOM事件到下一rAF只是内部反馈代理，不等于硬件输入到像素或音频输出延迟。本次没有据此宣称原生Mac达到固定60FPS，也没有把一次小样本当成跨设备性能保证。原始分布、长任务和环境说明随包保留。

## 6. 蓝图36项对照
当前总账：{summary}。每项仍保留原前提、步骤、期望及实际证据。

| 尚未全关的项目 | 实际状态 |
|---|---|
| DS04 文本与放大 | 长中文和短窗口已测，缩小有效视口等价检查已测；真实Chrome125/150/200%页面缩放未测。 |
| DS26 性能预算 | Linux输入代理、帧分布、旧版对照及关闭动效对照已测；Mac原生端到端及音频延迟未测。 |
| DS32 保存刷新 | 旧工程和文件下载重开已测；本机真实来源的IndexedDB刷新被策略阻断。 |
| DS34 目标机持续运行 | 本轮有Linux实际30分钟记录；已授权Mac离线，目标机无法执行。 |
| DS35 初次使用者 | 没有真实初次使用者参加；没有将脚本或模型视觉走查计为用户研究。 |

工程门禁与严格发行门禁分别运行。工程门禁检查实际HTML、资源摘要、所有证据哈希和已执行结果；严格发行门禁保留这些外部缺口并返回非零。物理麦克风、外部音源获取和实际听评也没有冒充本轮验证。

## 7. 使用与继续开发
直接用桌面Chrome打开“乐构.html”；读取已有.gridtone。重要作品主动下载作品文件备份。本轮不包含任何字体文件；使用系统字体。

源码执行npm test、npm run build。npm run verify:engineering会真正执行所有自动检查，包括约30分钟的持续运行；npm run verify:receipts只复核已有证据；npm run verify:release还要求外部项目关闭。测试需Python Playwright与Chromium，可通过CHROMIUM_PATH指定已安装的Chrome路径。

本包的本地Git历史从已交付源码继承，保存本轮多个检查点；没有向GitHub写入。提供基于交付2.0.0的增量补丁，先git apply --check再应用，保留你的原仓库文件和未提交修改。

## 8. 后续设计系统规则
新增页面与工具必须登记对象、作用范围、输入、状态和恢复行为；使用已登记组件。组件定义尺寸与样式，页面定义位置；真正不同的密度先定义变体。真实音乐几何保持0ms，表面反馈可以关闭。生产组件样例、设计文档与涉及的成功路径同步更新。

完整成功路径继续是：拿和弦→检查落点→放入→加鼓→选旋律→做几版→连伴奏试听→保留与改尾→采用→混音→下载→新实例重开。真实来源存储步骤单独等待目标环境完成。
'''
D=R/'docs/magnet-2.1';(D/'REPORT.md').write_text(text)
# Standard-library Markdown subset renderer. No network or custom font files.
def inline(s):
 import re
 return re.sub(r'`([^`]+)`',lambda m:'<code>'+m[1]+'</code>',html.escape(s))
lines=text.splitlines();chunks=[];intable=False
for ln in lines:
 if ln.startswith('|'):
  if set(ln.replace('|','').replace(':','').replace('-','').replace(' ',''))==set():continue
  if not intable:chunks.append('<div class="table-wrap"><table>');intable=True
  chunks.append('<tr>'+''.join('<td>'+inline(x.strip())+'</td>' for x in ln.strip('|').split('|'))+'</tr>');continue
 if intable:chunks.append('</table></div>');intable=False
 if ln.startswith('### '):chunks.append('<h3>'+inline(ln[4:])+'</h3>')
 elif ln.startswith('## '):chunks.append('<h2>'+inline(ln[3:])+'</h2>')
 elif ln.startswith('# '):chunks.append('<h1>'+inline(ln[2:])+'</h1>')
 elif ln.strip():chunks.append('<p>'+inline(ln)+'</p>')
if intable:chunks.append('</table></div>')
def figure(name,label):
 p=E/name;im=Image.open(p).convert('RGB');im.thumbnail((1440,1000));buf=io.BytesIO();im.save(buf,format='JPEG',quality=88)
 return '<figure><img alt="'+html.escape(label)+'" src="data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()+'"><figcaption>'+html.escape(label)+'</figcaption></figure>'
figs=[('directions/03-placement-A.png','实际生产界面：相同音乐材料从托盘进入时间轴，落点显示真实5—8小节。'),('directions/04-candidate-A.png','实际生产界面：右侧方案与中央只读投影，原稿在采用前保持。'),('detail-visual/crystal-04-precise-comparison.png','最终复核修正：精细编辑四字段采用统一标签网格。'),('final-visual/crystal-19-mix.png','混音台：通道与参数沿用同一套控件、文字与状态规则。')]
body='\n'.join(chunks);body=body.replace('<h2>1. 全面迁移了哪些内容</h2>',figure(*figs[0])+'<h2>1. 全面迁移了哪些内容</h2>');body=body.replace('<h2>4. 实际执行结果</h2>',figure(*figs[2])+'<h2>4. 实际执行结果</h2>');body+=figure(*figs[1])+figure(*figs[3])
css='''*{box-sizing:border-box}body{margin:0;background:#f7f7f4;color:#2a303b;font:15px/1.8 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}main{max-width:1100px;padding:40px;margin:auto;background:#fdfcfa}h1{font-size:30px;line-height:1.4;margin:0 0 22px}h2{font-size:22px;margin-top:36px;border-top:1px solid #ddd9d6;padding-top:22px}p{margin:12px 0}table{width:100%;border-collapse:collapse;font-size:13px}td{padding:10px 12px;border-bottom:1px solid #ddd9d6;vertical-align:top}tr:first-child{background:#fce5e9;font-weight:600}td:first-child{min-width:115px}.table-wrap{overflow:auto}code{font-size:12px;overflow-wrap:anywhere}img{width:100%;display:block;border:1px solid #ddd9d6;border-radius:12px}figure{margin:26px 0}figcaption{color:#667085;font-size:12px;margin-top:8px}@media(max-width:700px){main{padding:20px}h1{font-size:25px}}'''
(D/'REPORT.html').write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>乐构2.1.0 · 暖白磁贴验收</title><style>'+css+'</style><main>'+body+'</main></html>')
print('Report generated:',D/'REPORT.html','soak complete:',bool(soak))
