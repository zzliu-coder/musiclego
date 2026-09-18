# 第三方来源与授权

乐构代码、原创合成器实现、图标与本项目编写的练习内容随根目录 MIT LICENSE 提供。它不把任何外部音源的授权改成MIT。

## 可选 VSCO 2 Community Edition

作品：VS Chamber Orchestra: Community Edition。录制：Sam Gossner（Versilian Studios）与 Simon Dalzell（Ivy Audio）；采样剪辑：Elan Hickler / Soundemote。来源采用固定提交 `6dd651d55dde97fd4028699be9d4481f26917891` 的公开库。

上游许可证：CC0 1.0 Universal。

- 许可证：https://github.com/sgossner/VSCO-2-CE/blob/6dd651d55dde97fd4028699be9d4481f26917891/LICENSE
- 作者说明：https://github.com/sgossner/VSCO-2-CE/blob/6dd651d55dde97fd4028699be9d4481f26917891/Readme.txt
- 官网：https://versilian-studios.com/vsco-community/
- CC0文本：https://creativecommons.org/publicdomain/zero/1.0/legalcode

本版仅随代码提供下载目录和映射，不捆绑原始VSCO音频。用户明确载入后，程序把对应声音转换为24kHz单声道WAV，最长6秒，统一乐器增益并作末端淡出；保留单力度多根音，未复制全部原库。元信息保留作者、许可证和来源。

早期测试使用原创“敲杯”合成 WAV 作为可控夹具。1.7 收尾另行实际获取了 6 套 VSCO 音源，经生产下载器转换、内嵌保存，并在阻断外网后重开渲染。源码验收目录 `docs/closure-v2/evidence/real-banks/` 包含这些转换后的 CC0 测试包及来源、许可和 SHA-256 回执；它们没有自动加入应用的内置音色。自动检查与实际音乐审听分别记录。

## 没有捆绑的内容

本包不包含Apple字体、图标字体、Liquid Glass原生代码、Pianobook音源、Surge XT代码、Salamander音频或任何VST。Apple设计讲解、音乐教材及开源目录作为研究参考，见docs/SOURCES.md。

用户自行导入的录音、样本和素材需拥有相应使用权。工程可能内嵌音频；在分发工程前应确认这些音频可以随工程分享。
