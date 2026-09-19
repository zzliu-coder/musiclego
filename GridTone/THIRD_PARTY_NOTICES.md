# 第三方来源与授权

## 2.3 经典音色扩展

- **TR-808**：Michael Fischer 的 1994 实机录音，经 [tidalcycles/sounds-tr808-fischer](https://github.com/tidalcycles/sounds-tr808-fischer) 分发，CC0-1.0。固定提交 `85fbecf1bec32553395625ea659e2a56dfd7c0e1`；仅内置选定的 16 个短采样，原始 PCM 未修改。许可、原说明、逐文件 SHA-256 见 `vendor/expansion/tr808/` 与 `vendor/expansion/sources.json`。
- **AKWF**：Kristoffer Karl Axel Ekstrand / Adventure Kid 的 [AKWF-FREE](https://github.com/KristofferKarlAxelEkstrand/AKWF-FREE)，CC0-1.0。固定提交 `8de90bf94376670947369e69de0af6b9fbd19286`；选用八个单周期波形，去直流后提取最多 64 个 Fourier 泛音，由浏览器 PeriodicWave 播放。原文件和许可见 `vendor/expansion/akwf/`；包络、滤波与预设由乐构编写。
- 本次新增的鼓点、贝斯、伴奏和和弦编排由乐构编写，MIT；风格名称用于说明节奏语汇。没有新增 GMD 摘录，也没有导入 SHLD MIDI 数据集。
- Mini、Juno、DX、303 风格名称仅说明设计灵感；这些原创预设采用现有虚拟模拟、四运算器 FM 与新增单周期引擎，未使用对应商业设备的原厂音色文件，也不代表原机一致性、品牌背书或精确电路仿真。未捆绑 SEQTRAK、D-50、M1 原厂采样或完整 AMY 运行时。

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
