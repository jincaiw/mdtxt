# mdtxt 发布流程

## v0.1.0 预发布原则

mdtxt v0.1.0 不配置公开下载地址、自动更新端点或包管理器分发。构建产物
仅可在获授权的内部测试渠道中分发；不要复用上游项目的发布仓库、签名密钥、
安装包 URL、域名或更新清单。

## 发布前检查

1. 固定工具链：Bun 1.3.14、Node 24.18 与 Rust 1.96。
2. 执行 `bun run release:check`，确认产品标识、中文文案与配置均通过。
3. 执行 `bun run test`、`bun run build`、`cargo test --manifest-path src-tauri/Cargo.toml`。
4. 执行 `bun run tauri build --debug --no-bundle`，确认桌面程序可构建。
5. 执行 `bun run --cwd docs build`，检查静态站点不含旧品牌、旧域名或上游下载链接。

## 未来公开发布

在产品所有者明确批准渠道、发布仓库、签名策略和安装包托管位置之前，不得创建
公开标签、更新清单、winget/Scoop 清单或下载按钮。批准后，先补齐可复现的发布
工件与验收记录，再将文档中的“预发布”状态改为实际的发布信息。
