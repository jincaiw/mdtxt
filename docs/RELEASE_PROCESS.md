# mdtxt 发布流程

## v0.1.0 预发布原则

产品所有者已授权在 `jincaiw/mdtxt` 发布 v0.1.0 公开预发布包。不得复用上游
项目的发布仓库、签名密钥、安装包 URL、域名或更新清单。由于当前没有
mdtxt 专属代码签名、公证和更新签名材料，GitHub Release 必须保持
`prerelease=true`，不得标记为 GA，应用内 updater 继续关闭。
macOS 包使用 `signingIdentity="-"` 对整个 `.app` 做临时签名，使 Apple
Silicon 可执行文件和资源封套保持完整；这不等同 Developer ID 签名或公证。

## 发布前检查

1. 固定工具链：Bun 1.3.14、Node 24.18 与 Rust 1.96。
2. 执行 `bun run release:check`，确认产品标识、中文文案与配置均通过。
3. 执行 `bun run test`、`bun run build`、`cargo test --manifest-path src-tauri/Cargo.toml`。
4. 执行 `bun run tauri build --debug --no-bundle`，确认桌面程序可构建。
   macOS 生产候选还必须通过 `codesign --verify --deep --strict mdtxt.app`。
5. 执行 `bun run --cwd docs build`，检查静态站点不含旧品牌、旧域名或上游下载链接。
6. 等待三平台 CI 原生冒烟通过；确认恢复、产品标识、版本和包清单一致。
7. 推送带注释的 `v0.1.0` 标签；Release 工作流生成安装包、Portable、
   `SHA256SUMS`、SPDX SBOM 与 `THIRD_PARTY_LICENSES.txt`。
8. 下载全部资产并重新计算 SHA-256；确认 GitHub Release 仍为 draft/prerelease
   后再公开预发布。

## 未来正式发布

只有补齐三平台签名/公证、真实安装卸载、中文 IME 和 P11 全矩阵后，才允许
把预发布提升为 GA。启用更新器还必须另行验证 mdtxt 自有 HTTPS endpoint 与
签名密钥。v0.1.0 不创建 winget/Scoop 清单，也不生成 updater JSON。
