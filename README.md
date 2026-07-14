# mdtxt

> 一款本地优先、默认简体中文、完整支持英语的跨平台 Markdown 编辑器。

mdtxt 直接打开 Markdown 文件，提供源码、阅读和分栏视图；后续版本将以单编辑区
Live Beta 为核心，同时保留可随时回退的源码模式。文档默认保存在本地，AI 仅在用户
主动配置服务商后才会发起网络请求。

## 当前状态

`0.1.0` 正在按阶段重构。mdtxt 使用独立应用标识 `app.mdtxt.desktop`，可与
Paperling 并存。自动更新在 mdtxt 拥有签名密钥和更新端点前保持关闭，绝不会访问
上游更新通道。

## 功能基础

- 编辑、阅读和分栏视图；标签页、自动保存、文件浏览器与大纲。
- GFM、任务列表、表格、KaTeX、化学公式、Mermaid、代码高亮与图片预览。
- 命令面板、斜杠命令、格式工具栏、查找替换、智能粘贴与表格编辑。
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

在 mdtxt 的公开发布仓库、签名密钥和更新端点确定前，不提供安装包下载链接或
自动更新。发布阶段将提供 Windows、macOS 与 Linux 工件、校验和、双语发行说明和
完整安装文档。

## 上游与许可证

mdtxt 基于 Paperling 代码库渐进重构；上游归属保留在 [NOTICE](NOTICE)。本仓库继续
采用 [Apache License 2.0](LICENSE)。
