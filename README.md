# mdtxt

> 一款本地优先、默认简体中文、完整支持英语的跨平台 Markdown 编辑器。

mdtxt 直接打开 Markdown 文件，提供默认 Live、源码、阅读和分栏视图，
并始终保留可随时回退的源码模式。文档默认保存在本地，AI 仅在用户
主动配置服务商后才会发起网络请求。

## 当前状态

`0.4.0` 是下一正式版本。mdtxt 使用独立应用标识
`app.mdtxt.desktop`，可与 Paperling 并存。自动更新在 mdtxt 拥有签名密钥和
更新端点前保持关闭，绝不会访问上游更新通道。

## 功能基础

- 默认 Live、Source、阅读和分栏视图；自适应三栏工作区、专注模式、
  可折叠大纲、标签页与自动保存。
- 原生菜单、命令面板和统一快捷键；macOS 交通灯及 Windows/Linux 系统窗口按钮。
- GFM、任务列表、表格、KaTeX、化学公式、Mermaid、代码高亮与图片预览。
- 命令面板、斜杠命令、格式工具栏、查找替换、智能粘贴与表格编辑。
- 工作区树支持创建、重命名、拖放移动、系统废纸篓、路径复制和系统定位；`[TOC]` 可在 Live、阅读和导出中显示。
- 可选 AI：修改以差异形式呈现，确认后才写入文件；密钥存于系统钥匙串。

## 开发

```bash
bun install --frozen-lockfile
bun run test
bun run build
bun run tauri dev
```

提交前执行完整门禁：

```bash
bun run check:identity
bun run check:i18n
bun run test
bun run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## 发布

v0.4.0 通过 mdtxt 专属仓库提供 macOS Apple Silicon、Windows x64 与 Ubuntu LTS
x64 正式包，并附统一校验和、SPDX SBOM 与第三方许可证清单。当前产物尚未签名/
公证，但作为正式版发布；自动更新保持关闭。详见
[发布流程](docs/RELEASE_PROCESS.md)和[隐私说明](docs/PRIVACY.md)。

## 上游与许可证

mdtxt 基于 Paperling 代码库渐进重构；上游归属保留在 [NOTICE](NOTICE)。本仓库继续
采用 [Apache License 2.0](LICENSE)。
