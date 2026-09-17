# 乐构 1.5 实现说明

> 历史记录：本文描述 1.5。当前 1.6 实现合同、功能清单和验收记录见 `docs/implementation/CONTRACTS.md`、`RELEASE_NOTES.md` 与 `acceptance.json`。

在原 GridTone 工程与 `codex/gridtone-studio` 分支持续修改，无新建完整副本。现有音频引擎、撤销、工程格式、离线发布机制继续使用。

## 本次改动

- 品牌“乐构”；主要 UI 改为轻磨砂键帽、清白/暖白背景及协调的声音角色色。
- 编排与乐句两种视图，独立高度，切换保持当前内容与播放时钟；混音、音色库、处理与弹层统一控件。
- `motion.js` 集中处理拿起/落点/落定、面板状态及播放光照，不参与音频调度。
- 指针事务增加原位与目标轮廓、即时无效原因、落点验证缓存；提交一次进历史，取消完全回滚。
- 用户及系统减少动态设置同时生效。窄屏有独立布局，隐藏的高级工具仍可通过更多工具到达。
- 旧默认色按角色迁移、自定义色保留。没有改旧作品音符或音量。旧存储/API 名称继续保留。

## 验证

见 `RELEASE_VERIFICATION.json`、`design-qa.md` 和 `design/legou/`。完整规则在 `DESIGN_SYSTEM.md`。

## 开发

编辑 `src/`，执行 `npm run build` 更新源码入口、单文件 `dist/index.html`、`乐构.html` 与兼容入口 `声格.html`。服务使用 `node scripts/server.mjs`。测试使用 `node --test tests/*.test.mjs tests/*.test.cjs`。浏览器回归文件由现有本地浏览器 DevTools 执行，需要真实点击解锁 AudioContext。

不引入运行时 npm 依赖。视觉规则为最后加载的 `legou.css`；现有基础及专用页面样式保留以复用成熟布局。
