# mdtxt 0.1.0 实施计划（评估优化定稿）

> 状态：**Final v0.3**（2026-07-15）
> 适用仓库：当前 Paperling 仓库及其合法 Fork
> 工作分支：`codex/refactor-mdtxt-0.1.0`
> 目标：将既有 Paperling 渐进迁移为独立、双语、跨平台的 `mdtxt` 0.1.0。

## 1. 定稿结论

本计划保留 PRD 的功能范围与技术路线，但以已经落地的工作为基线重新编排：

```text
已完成：P0 基线 → P1 安全契约 → P2 身份隔离 → P3 双语底座
正在完成：P4 文档会话单一事实源
后续：P5 编辑器分层 → P6 Live Beta → P7 Widgets → P8 文件安全
      → P9 AI/导出/平台 → P10 发布工程 → P11 发布判定
```

唯一可接受的主路径仍是：**先消除 React 与 CodeMirror 的双全文状态，再拆分编辑器，再引入 Live 与 Widgets**。不得以“模型已建立”代替状态迁移完成；当前 `DocumentSession`、版本令牌与按标签模式已存在，但 `App.tsx` 仍保留活动全文 React 状态，因此 P4 尚未退出。

本文件替代此前的执行提示与 v0.2 计划。产品需求、验收场景和 Definition of Done 仍以 [mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md](mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md) 为准；当两者冲突时，以 PRD 的安全与验收要求为准。

## 2. 已验证基线与阶段状态

| 阶段 | 状态 | 已交付的证据 | 下一道门槛 |
| --- | --- | --- | --- |
| P0 基线冻结 | 完成 | `d46d807`、`docs/audits/baseline-0.1.0.md` | 保持基线可复跑 |
| P1 安全契约 | 完成 | `ca32c04`，fixture、回归与预检基础 | 后续功能必须补对应 fixture |
| P2 产品身份 | 完成 | `122071b` 至 `9495dd6`，mdtxt 标识、品牌隔离、updater 关闭 | 发布前再次扫描泄漏 |
| P3 双语底座 | 完成 | `96a9931`，默认中文、双语键、硬编码门禁 | 新增文字必须双语 |
| P4 文档会话 | 进行中 | ADR、纯模型、版本防护、每标签模式与会话控制器 | 每标签 `EditorState`，并清除按键级全文 React 主状态 |
| P5–P11 | 未开始 | 不提前实现 | 严格按依赖进入 |

截至本次定稿，最低本地门禁已通过：`bun run release:check`、前端测试与构建、`cargo fmt --check`、Clippy 和 Rust 测试。后续每一个阶段都必须重新执行与该阶段相称的门禁，不能借用历史通过结果。

## 3. 不可突破的约束

- 不重建仓库、不修改 `origin`、不重写历史、不强推；每项行为变化可独立回滚。
- Markdown 源文件是唯一内容事实来源；Live、AI、预览与导出均不得隐式改写原文。
- 每个标签独立保存 `EditorState`（含选择和 undo history）；窗口只维护一个活动 `EditorView`，标签切换用 `view.setState`。
- React 只保存会话摘要和 UI 状态；不得让每次按键的完整正文成为 React 持续主状态或反向驱动编辑器。
- 保存、预览、AI、导出和异步 Widget 必须携带 `documentId + version + requestId`；过期结果必须丢弃。
- Live 的结构识别基于 Lezer；正则仅可做局部文本处理。解析或渲染失败必须显示源码。
- 所有新增用户可见文本同时提供 `zh-CN`、`en-US`；默认中文；切换语言不得重建 EditorView 或改变正文。
- 对外名称永远为 `mdtxt`，版本永远为 `0.1.0`；未配置专属签名源时 updater 必须关闭。
- 密钥只可留在系统钥匙串；正式构建不得带测试密钥、调试桥或宽松 CSP。

## 4. 依赖、提交与决策规则

```text
P0 ✓ → P1 ✓ → P2 ✓ → P3 ✓ → P4
                              ├─ P5 → P6 → P7
                              └─ P8 ──────────┐
P7 + P8 + P3 + P4 ────────────┴→ P9 → P10 → P11
```

1. 一次提交只解决一个可回滚主题；品牌、依赖大版本升级、状态迁移和 Live 行为不得混在同一提交。
2. 每个阶段入口先补失败测试或 fixture，再实现，再做全量回归；没有证据不得改变阶段状态。
3. P4 完成前，禁止默认启用 Live、引入复杂 Widget，或把现有 `CodeEditor` 拆分伪装为状态迁移完成。
4. P8 可在 P5/P6 之外并行设计，但凡涉及活动编辑器、保存状态或冲突 UI 的代码变更，必须等 P4 完成。
5. 未完成项保留 Source 降级路径；未在真实目标平台验证的项目必须标记为“未验证”。

## 5. 阶段实施与退出条件

### P4：DocumentSession 与状态单一事实源（当前阶段）

目标不是再增加模型字段，而是将正文、选择与撤销历史真正交给会话。

| 子关卡 | 工作范围 | 强制验收 |
| --- | --- | --- |
| P4a ✓ 会话契约 | ADR、纯 `DocumentSession`、版本/保存/外部变更/模式模型 | 纯模型测试覆盖脏恢复、过期结果、外部内容与每标签模式 |
| P4b ✓ 会话控制器 | 已建立 framework-independent controller/store；React 订阅摘要；打开、激活、关闭、修改、保存与外部更新经统一会话 API | 控制器测试覆盖摘要隔离、激活、关闭、保存、外部更新与过期结果；App 不再维护独立 session Map |
| P4c EditorState 所有权 | 每标签保存 CodeMirror `EditorState`；单一 `EditorView` 在切换时回存/`setState`；正文、选择、undo 不经 React 往返 | 两标签交替编辑的选择、undo/redo 完全隔离；语言和模式切换不重建 View |
| P4d 迁移收口 | 删除 `App.tsx` 中活动全文主状态、`docSwapId` 式全文替换及与之竞争的 tab 内容副本；预览/保存/AI 读取版本化快照 | 输入路径没有按键级全文 React 更新；Source/Split/Reader、自动保存、外部变化、AI 审阅回归通过 |

退出条件：P4a–P4d 全部通过，且代码审查能明确证明 React 仅接收 `DocumentSessionSummary` 与 UI 状态。任何一个标签的正文、选择或历史仍由 React 作为主状态即不退出 P4。

### P5：编辑器模块拆分（无新增 Live 能力）

在 P4 完成后，将 `CodeEditor.tsx` 收缩为挂载容器。按低风险顺序提取 `editor/core`（host/controller）、`commands`、`extensions`、`interactions`、`bridge` 与针对性 tests；依次迁移基础 extension、命令/快捷键、查找替换、smart paste、表格、wikilink、AI merge、滚动同步和 locale reconfiguration。

退出条件：无循环依赖；`CodeEditor` 仅管理容器；已有 Source/Split/Reader 行为等价；模块测试覆盖迁出的协议；不得重新引入 React 全文状态。

### P6：Live Beta（最小、可逆、非默认）

仅实现标题、强调、删除线、行内代码、链接、引用、列表、分隔线和任务列表。使用 Lezer、`StateField`、`ViewPlugin` 和 `Decoration`；焦点节点显示源码，非焦点节点仅隐藏已证明安全的标记。每项均需 Source fallback。

退出条件：Source/Live/Split 正文逐字一致；IME、选择、undo/redo 无 P0；1 MiB 基准和方法入库；没有正则主解析、整篇重算或默认启用 Live。

### P7：复杂块 Widgets（逐项发布）

严格按图片、代码块、Frontmatter、表格、数学、Mermaid、脚注、Callout 推进；一个类型一个可回滚提交。每项具备 fixture、视口惰性渲染、取消、缓存、错误源码降级和版本令牌。

退出条件：每项独立性能记录与失败回退；未知语法保持原样；异步结果不阻塞输入、不写回过期文档。

### P8：文件安全、冲突与恢复

落地读写格式元数据（编码、BOM、EOL、尾随换行、磁盘修订/哈希）。Rust 保存采用同目录原子替换、fsync、权限保持和失败清理；写入前检测外部变更，提供比较、重载、保留本地、另存为；恢复副本带校验与有限保留期。

退出条件：未修改文件 byte round-trip；无静默覆盖；冲突和恢复有自动化与可见路径；符号链接边界、长路径/UNC 和文件锁有平台记录。任一数据丢失问题均为 P0。

### P9：AI、导出与平台收口

AI 可完全关闭；密钥只经系统钥匙串；请求可取消且差异逐项接受。HTML/PDF/DOCX 使用版本化快照，输出由 Rust 控制路径写入，失败不影响正文。区分界面语言、文档语言与输出语言；平台错误双语化并收紧权限/CSP。

退出条件：AI 关闭和密钥失败安全；导出 fixture 通过；无 localStorage 密钥回退、调试桥、测试密钥或宽松 CSP。

### P10：发布工程

建立 macOS Apple Silicon、Windows x64、Ubuntu LTS x64 的真实 CI 产物；明确 Intel/ARM64 是否纳入。完成图标、签名/公证策略、AppImage/DEB、SHA256SUMS、SBOM、第三方许可证、隐私说明与双语 release notes。仅在 mdtxt endpoint 和签名密钥均真实验证后启用 updater。

退出条件：目标产物、版本、标识和文件关联一致；预检不存在上游品牌、endpoint 或密钥泄漏；所有未签名平台明确为 beta，不能标 GA。

### P11：最终回归与发布判定

打 `v0.1.0` 前执行双语 E2E、三平台安装/卸载及与 Paperling 并存、中文/英文 IME、10 MiB Source 与受限 Live、round-trip、外部冲突、崩溃恢复、自动保存、AI 关闭、HTML/PDF/DOCX、正式 CSP、许可证/NOTICE 和发布预检。

退出条件：PRD 第 25–29 节及 P0 发布阻塞项全部关闭；任何缺失的平台验证明确记录，且不以 GA 名义发布。

## 6. 每阶段统一验证与记录

每阶段至少执行并记录真实输出：

```bash
bun install --frozen-lockfile
bun run release:check
bun run test
bun run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

涉及 Tauri 配置、Rust、资源、打包或平台能力时，另执行：

```bash
bun run tauri build --debug
```

每个阶段的记录必须包含：修改范围、对应 ADR/fixture、命令和结果、性能/兼容影响、已知问题、回滚提交与下一阶段入口条件。发布阶段额外执行依赖审计、目标平台安装验证与 `bun run release:check`。

## 7. 当前执行边界

下一项工作固定为 **P4c：每标签 EditorState 与单一 EditorView**。先为标签切换、选择与 undo 隔离补测试，再将活动 View 的 state 回存/`setState` 到会话；不在此提交拆分其余编辑器模块或实现 Live。P4d 删除 React 全文主状态后，才进入 P5。
