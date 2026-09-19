# 第三方来源与授权

乐构原创代码、电子鼓、虚拟模拟/FM实现、图标与原创音乐材料依根目录MIT LICENSE提供。第三方材料分别遵守各自许可。

## AMY：参数曲线移植，MIT

作者：Brian Whitman、Daniel PW Ellis。
固定来源：`shorepine/amy`，提交 `c645a0d58402fd450819617959826be1eca162aa`，`amy/juno.py`。

本版移植了少量attack、decay、release、cutoff、resonance、LFO数值映射，毫秒转换为秒，并按音频采样率加边界。完整MIT许可与修改说明位于 `vendor/amy-curves/`。

未捆绑完整AMY C/WASM运行时、Juno/DX出厂预设、硬件PCM，也不宣称硬件仿真精度。29个Studio预设为本项目编写。

## Groove MIDI Dataset：CC BY 4.0

原始数据集：Groove MIDI Dataset，Google LLC，2019。
官方来源：https://magenta.withgoogle.com/datasets/groove
许可：https://creativecommons.org/licenses/by/4.0/

三份原始MIDI通过公开镜像 `zharry29/drums-with-llm` 固定提交 `476adbc938a600eaca26bbb02648e6127b5eca64` 中的groove目录获取。原始字节、Git blob SHA-1、SHA-256、文件名和加工回执保留在 `vendor/gmd/`。镜像代码与模型不随本包提供。

加工：以小节截取，PPQ转换为960，保留起音和力度，映射为八种鼓件角色，裁切范围末尾，未重放CC4踩镲控制。不同角色/变体分别署名，组合派生还保留其使用的每个截取来源。引入的原始MIDI总计4906字节；没有包含原数据集伴随音频。

衍生模板的CC BY 4.0来源不因本项目MIT许可而改变。组合的原创部分MIT；组合内真人鼓节奏衍生部分仍须保留CC BY署名。导出或分享素材包、含派生音符的作品时应保留随附说明。

## 可选VSCO 2 Community Edition：CC0

作者：Sam Gossner / Versilian Studios、Simon Dalzell / Ivy Audio；采样剪辑Elan Hickler / Soundemote。
既有下载映射固定于 `sgossner/VSCO-2-CE` 的 `6dd651d55dde97fd4028699be9d4481f26917891`。来源链接与CC0说明保留在 `src/audio/sample-banks.js`。

本轮没有将VSCO采样改成默认声音，也未重新验证外部获取。现有导入、轻量WAV和作品内嵌路径继续保留。

## 其他

系统字体仅按名称引用，包内没有字体文件。不含Yamaha SEQTRAK或teenage engineering K.O. II的原厂采样、商标资产、出厂预设或固件。不含商业合成器授权受限的预设包。

本次证据目录的WAV由本程序实际渲染。含GMD衍生节奏的演示同时带CC BY署名，其余原创演示MIT。实测声学数据不代表原始真实乐器录音或真人音乐听评。

用户自行导入的录音和样本应具有对应使用权；分享包含录音的作品前检查这些资源许可。
