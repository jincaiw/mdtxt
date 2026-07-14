# mdtxt 0.1.0 实施计划（评估优化定稿）

> 状态：Final v0.2（2026-07-14）
> 适用仓库：当前 Paperling 仓库及其合法 Fork
> 工作分支：`codex/refactor-mdtxt-0.1.0`
> 产品目标：将既有 Paperling 渐进迁移为独立、双语、跨平台的 `mdtxt` 0.1.0。

## 1. 定稿结论

保留原 PRD 的产品范围和技术路线，但将执行顺序收紧为：**安全契约 → 产品身份隔离 → 双语底座 → 文档状态单一事实源 → 编辑器分层 → Live Beta → 复杂块 → 文件安全 → 周边能力 → 发布**。

这是当前代码库唯一低风险的路径。`App.tsx` 仍持有全文 React 状态，`CodeEditor.tsx` 同时承担编辑器创建和业务交互；在这两个问题解决前，不得把实时渲染或 Widget 接入生产默认模式。当前 Tauri 配置仍使用上游更新源与签名公钥，因此身份迁移必须在任何可发布构建之前完成。

本计划替代此前“推荐首次任务”的一次性提示词；步骤 0 已完成，后续按本文件继续。产品需求仍以 [mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md](mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md) 为准。

## 2. 不可突破的约束

- 不重建仓库、不修改 `origin`、不重写历史、不强推。
- 不引入 Electron、内置 Chromium、Swift/AppKit 主工程，也不复制 MarkEdit 仓库。
- Markdown 源文件是唯一事实来源；Live、AI、预览与导出都不得隐式改写原文。
- 不得把每次按键的全文回传到 React 主状态；每标签必须独立持有 CodeMirror `EditorState` 与撤销历史。
- Markdown 结构识别使用 Lezer 语法树；正则只能用于局部文本操作，不能作为 Live 的结构解析核心。
- 所有新增用户可见文字必须同时有 `zh-CN` 与 `en-US`；默认界面为简体中文，语言切换不得重建 `EditorView` 或修改文档正文。
- 对外品牌始终为小写 `mdtxt`、版本始终为 `0.1.0`。不得访问 Paperling 更新地址、公钥、应用标识或数据目录。
- 未配置 mdtxt 更新基础设施时，正式构建必须关闭更新器；不得以 Paperling 更新器作为临时替代。
- 密钥只能在系统钥匙串；发布前不得保留明文 `localStorage` 回退。

## 3. 基线与当前已知阻塞

步骤 0 已以提交 `d46d807` 完成。基线报告位于 [docs/audits/baseline-0.1.0.md](docs/audits/baseline-0.1.0.md)。当前前端、Rust、文档构建和依赖审计均已通过；当前 macOS `tauri build --debug` 的最终 updater 产物因只有上游公钥、没有对应私钥而失败。

这不是环境问题，也不是允许绕过的发布失败：步骤 2 必须移除上游 updater 配置并使未配置更新源的构建可成功完成。

## 4. 阶段、依赖与提交边界

```text
P0 基线（已完成）
 └─ P1 安全契约与夹具
     └─ P2 品牌、标识、更新隔离
         └─ P3 双语基础设施与硬编码门禁
             └─ P4 文档会话与状态迁移
                 └─ P5 编辑器模块拆分
                     └─ P6 Live Beta（基础行内/块级语法）
                         └─ P7 复杂块 Widgets（逐项）
                             └─ P8 文件安全、冲突与恢复
                                 └─ P9 AI、导出、平台收口
                                     └─ P10 发布工程
                                         └─ P11 发布判定
```

每个阶段只允许一个主题提交；如一个阶段包含可独立回滚的行为变化，拆成多个提交。阶段结束前必须可构建、可测试、可回滚。禁止把品牌、依赖大版本升级和编辑器架构修改混入同一提交。

| 阶段 | 主要提交前缀 | 前置条件 | 发布阻塞级别 |
| --- | --- | --- | --- |
| P1 | `test(baseline)` | P0 | P0 |
| P2 | `chore(brand)` | P1 | P0 |
| P3 | `feat(i18n)` | P2 | P0 |
| P4 | `refactor(editor)` | P3、ADR | P0 |
| P5 | `refactor(editor)` | P4 | P1 |
| P6 | `feat(editor)` | P5 | P0 |
| P7 | `feat(editor)` | P6 | P1 |
| P8 | `feat(files)` | P4 | P0 |
| P9 | `feat(ai)` / `feat(export)` | P3、P4、P8 | P0 |
| P10 | `chore(release)` | P2、P3、P8、P9 | P0 |
| P11 | `test(e2e)` | P10 | P0 |

## 5. 各阶段实施与退出条件

### P1：安全契约与测试夹具

目标是让后续重构的真实回归能够失败，而不是仅增加快照或覆盖率。

1. 增加无敏感数据的 Markdown fixtures：GFM、中文混排、未知语法和 HTML、图片引用、表格、公式、Mermaid。
2. 使用确定性生成器提供 1 MiB 与 10 MiB 文档，不提交巨型二进制或个人文件。
3. 在 Rust 命令层锁定 UTF-8、BOM、LF/CRLF、尾随换行的读写行为；在引入格式元数据后把“无修改字节级 round-trip”升级为强制断言。
4. 为自动保存、外部变更、恢复、标签撤销隔离、受控的中文 IME 组合事件补齐单元/组件测试；无法稳定自动化的原生 IME 部分进入手工清单，不能伪造 E2E 成功。
5. 增加版本一致性与用户可见硬编码扫描的测试框架。硬编码门禁从 P3 开始严格启用，以避免把存量问题误报成新增回归。

退出条件：fixture 覆盖所有目标语法；测试能拦截全文替换、格式丢失、标签状态串扰和外部变更回归；测试时间被记录且适合 CI。

### P2：品牌、应用身份与更新隔离

先提交 `docs/adr/0001-mdtxt-product-identity.md`，记录名称、版本、`app.mdtxt.desktop`、开发/测试/正式标识、数据目录、一次性旧数据迁移、回滚与 updater 策略。

随后只做身份迁移：`package.json`、Cargo、Tauri、窗口、安装包、文件关联、CI artifact、诊断及用户可见品牌。保留 `LICENSE`、`NOTICE` 和上游署名。删除 Paperling updater endpoint 与公钥；在尚无 mdtxt 签名源时关闭 updater 和 updater artifact，确保当前平台 debug 包可构建。

退出条件：版本位置一致为 0.1.0；mdtxt 与 Paperling 可并存；正式包不访问上游更新源；版本一致性测试和当前平台 debug 包通过。

### P3：双语基础设施与文本门禁

不为替换库而替换库。先将现有 `LocaleContext` 演进为类型化的语义键与双资源表；只有现有实现无法满足参数、复数、日期数字格式或键完整性时，再引入 `i18next`。默认 locale 改为 `zh-CN`，语言选择迁移到 mdtxt 独立存储键，并保持对旧选择的幂等迁移。

迁移顺序：启动/欢迎页 → 设置和语言切换 → 菜单/标题栏/命令面板 → Toast 与错误 → 文件、搜索和大纲 → 编辑器 → AI、导出、更新 → 帮助与教程。语言切换只重配置本地化扩展和 React 文案，不能销毁 EditorView。

退出条件：两种语言键集合、变量和复数规则一致；首次启动中文；英文即时切换；新增硬编码门禁开启；主路径不存在英文回退泄漏。

### P4：DocumentSession 与状态单一事实源

先提交 `docs/adr/0002-document-session.md`，比较“保留全文 React state”“集中 store”“每标签 EditorState”的选择、迁移步骤和回滚方式。

建立独立 `DocumentSession`：稳定 `id`、`path`、每标签 `EditorState`、`version/savedVersion`、磁盘修订、格式元数据、视图模式及 recovery 标识。窗口只保留一个活动 `EditorView`，切换标签时以 `view.setState` 交换状态。React 仅接收文档摘要、dirty/version 和 UI 状态；保存、预览、AI、导出都携带 `documentId + version`，丢弃过期异步结果。

退出条件：Source/Split/Reader 行为等价；标签撤销完全隔离；不再有按键级全文 React 循环；模式切换、保存及外部变更测试通过。

### P5：编辑器模块拆分（无新增 Live 能力）

将 `CodeEditor.tsx` 收缩为挂载容器，目标目录为 `src/editor/{core,commands,extensions,interactions,bridge,tests}`。按低风险顺序提取 EditorHost、Controller、基础 extension、快捷键/命令、查找替换、smart paste、表格、wikilink、AI merge、滚动同步和 locale reconfiguration。每次提取保持行为不变。

退出条件：无循环依赖；主组件明显缩小；各模块有针对性测试；P4 的状态边界未被绕回 React。

### P6：Live Beta（最小可逆实现）

只实现标题、强调、删除线、行内代码、链接、引用、列表、分隔线和任务列表。基于 Lezer、`StateField`、`ViewPlugin` 和 `Decoration`；光标所在节点显示源码，非活动节点仅隐藏可证明安全的标记。解析或渲染失败时保留源码。Live 初始只以 Beta 入口提供，不能取代 Source 默认回退路径。

退出条件：Source/Live/Split 正文严格一致；中文 IME、选择区、撤销/重做无 P0；1 MiB 基准达标并记录方法；没有正则主解析或整篇重算。

### P7：复杂块 Widgets（逐项发布）

按图片、代码块、Frontmatter、表格、数学、Mermaid、脚注、Callout 顺序，每项单独提交和验收。每个 Widget 必须视口惰性渲染、可取消、可缓存、有错误回退、不阻塞输入、不改变未知语法，且异步结果按 `documentId + version` 防止过期写回。

退出条件：每一项均有 fixture、降级源码路径和性能记录；未完成项保持源码，不以半成品 widget 代替内容。

### P8：文件安全、冲突与恢复

将格式元数据落实到读写协议：编码/BOM/EOL/尾随换行、期望磁盘修订和哈希。保存使用同目录原子替换、fsync、权限保持及失败清理；写入前检测外部变更并提供比较、重载、保留本地、另存为四种明确路径。恢复采用带校验和、有限保留期的独立副本，覆盖崩溃、路径迁移、符号链接边界、长路径/UNC 和文件锁。

退出条件：无静默覆盖；无修改文件能 byte round-trip；冲突与恢复均有测试和可见恢复路径。任一静默丢失或无备份恢复失败均为发布 P0。

### P9：AI、导出与平台收口

AI 可完全关闭，密钥只使用系统钥匙串；移除明文 localStorage 回退。区分界面、文档和输出语言；请求可取消，差异逐项接受，不自动写盘。导出 HTML/PDF/DOCX 使用版本化快照，失败不影响正文；Linux 0.1.0 可用系统打印到 PDF。所有 export 文件写入 Rust 控制路径，收紧前端广泛文件系统权限。

退出条件：AI 关闭与密钥失败安全；导出格式通过 fixture 验证；平台错误双语化；无调试桥、测试密钥或宽松 CSP 进入正式包。

### P10：发布工程

建立 macOS Apple Silicon、Windows x64、Ubuntu LTS x64 的 CI 矩阵；是否追加 macOS Intel/Linux ARM64 以明确产品决策为准。准备 mdtxt 图标、签名/公证策略、Linux AppImage/DEB、SHA256SUMS、SBOM、第三方许可证、隐私说明和双语 Release Notes。仅在签名密钥与 mdtxt endpoint 均已配置且验证后启用 updater；否则保持关闭。

退出条件：当前平台包和 CI 矩阵真实产出；artifact、版本、标识、文件关联一致；发布预检无上游品牌、endpoint 或密钥泄漏。

### P11：最终回归与发布判定

在打 `v0.1.0` 前执行双语核心 E2E、三平台安装/卸载、与 Paperling 并存、文件关联、中英文 IME、10 MiB Source、受限 Live、round-trip、外部冲突、崩溃恢复、自动保存、AI 关闭、HTML/PDF/DOCX、正式 CSP、版本一致性、LICENSE/NOTICE 和 release preflight。

任何平台未执行的项目必须明确标记“未验证”，不得写为通过；P0 未关闭不得打 tag。

## 6. 每阶段统一验证与记录

每阶段最低执行并记录真实输出：

```bash
bun install --frozen-lockfile
bun run check:i18n
bun run test
bun run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

涉及 Tauri 配置、Rust、资源、打包或平台能力时，额外执行：

```bash
bun run tauri build --debug
```

发布阶段还执行 `bun run release:check`、依赖审计和目标平台安装验证。每个阶段的交付记录必须包含：修改范围、ADR（如有）、测试与构建结果、性能/兼容性影响、已知问题、回滚提交和下一阶段前置条件。

## 7. 本计划的近期执行界限

下一步只执行 P1，不提前改品牌、引入 i18n 库或重构 EditorHost。P1 完成并通过门禁后，再开始 P2 的 ADR；P2 未完成前，不生成可发布安装包或启用 updater。
