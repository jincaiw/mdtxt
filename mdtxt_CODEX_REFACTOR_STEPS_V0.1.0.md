# mdtxt 0.1.0 Codex 重构执行步骤

> 适用仓库：现有 `Razee4315/Paperling` 代码仓库或其合法 Fork  
> 产品名称：`mdtxt`  
> 目标版本：`0.1.0`  
> 平台：macOS、Windows、Linux  
> 默认语言：简体中文  
> 执行原则：渐进重构、独立提交、每步可构建、数据安全优先

---

## 一、Codex 总提示词

```text
你正在现有 Paperling 仓库中将产品渐进式重构为 mdtxt 0.1.0。

必须先完整阅读：
1. mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md
2. README、LICENSE、NOTICE、CONTRIBUTING
3. package.json、bun.lock、Cargo.toml、tauri.conf.json
4. App.tsx、CodeEditor.tsx、MarkdownPreview、标签页、文件保存、AI、导出和更新代码
5. 当前测试与 GitHub Actions

严格约束：
- 不重新 git init，不删除 .git，不修改现有 remote，不重写历史，不强推。
- 不一次性推倒重写。
- 不引入 Electron、Swift/AppKit 主工程或内置 Chromium。
- 不复制 MarkEdit 整个仓库。
- 不破坏 Markdown 原文、撤销历史、输入法、光标和保存安全。
- 不把每次按键的全文放入 React 主状态。
- 所有用户文案必须同时提供 zh-CN 和 en-US。
- 产品名称统一为小写 mdtxt，版本统一为 0.1.0。
- mdtxt 不得继续使用 Paperling 的更新 endpoint、公钥、应用标识和数据目录。
- 每次只完成当前步骤，执行测试，输出真实结果；失败不得隐瞒。
```

---

## 二、分支和提交策略

建议工作分支：

```bash
git switch -c refactor/mdtxt-0.1.0
```

不要求一次提交全部内容。推荐提交序列：

```text
chore(audit): capture Paperling baseline
test(baseline): add editor and file safety fixtures
chore(brand): rename product identity to mdtxt 0.1.0
feat(i18n): add zh-CN default and en-US locale
refactor(editor): introduce DocumentSession and editor host
refactor(editor): extract commands and extensions
feat(editor): add Live Beta inline rendering
feat(editor): add complex block widgets
feat(files): harden atomic save and conflict handling
feat(export): align cross-platform export
test(e2e): add bilingual and platform release matrix
chore(release): prepare mdtxt 0.1.0 artifacts
```

每个提交应满足：

- 单一主题；
- 可编译；
- 测试通过；
- 不夹带无关格式化；
- 描述迁移和回滚方式。

---

## 三、步骤 0：仓库审计与基线冻结

### 目标

在修改任何产品行为前，建立可比较基线。

### Codex 操作

1. 输出目录树和模块职责。
2. 标记以下关键路径：
   - 应用启动；
   - 文件打开、保存、另存为；
   - 标签页和会话；
   - CodeMirror 创建与销毁；
   - Source、Split、Reader；
   - AI 请求和密钥；
   - PDF、HTML、DOCX；
   - 更新、签名和发布。
3. 搜索所有用户可见 `Paperling`、旧包名和旧 identifier。
4. 搜索所有硬编码用户文案。
5. 记录依赖、Rust toolchain、Bun 和 Node 兼容版本。
6. 运行当前测试和构建。
7. 建立性能基线。
8. 审计 LICENSE、NOTICE、第三方代码和图片资源。
9. 输出 `docs/audits/baseline-0.1.0.md`。
10. 不修改产品功能。

### 必跑命令

```bash
bun install --frozen-lockfile
bun run test
bun run build
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

### 退出条件

- 基线报告完成；
- 当前失败项有真实记录；
- 未引入功能变化。

---

## 四、步骤 1：补齐安全回归测试

### 目标

在重构前锁定不能破坏的行为。

### 必须新增

- Markdown 无修改字节级 round-trip；
- BOM、LF、CRLF、尾随换行；
- 未知 Markdown 和 HTML 保留；
- 标签切换撤销历史隔离；
- 外部文件冲突；
- 自动保存；
- 崩溃恢复数据；
- 中文组合输入可自动化部分；
- 大文件 fixture；
- 图片、表格、公式、Mermaid fixture；
- 版本一致性测试框架；
- 用户可见硬编码扫描框架。

### 退出条件

- 测试能在重构错误时失败；
- fixture 不包含敏感数据；
- 测试执行时间可接受。

---

## 五、步骤 2：品牌与应用身份迁移

### 目标

将上游应用身份独立迁移为 mdtxt 0.1.0。

### 先提交 ADR

创建：

```text
docs/adr/0001-mdtxt-product-identity.md
```

ADR 必须记录：

- 正式名称和大小写；
- 版本规则；
- npm、Cargo、Tauri 名称；
- `app.mdtxt.desktop`；
- dev/test/release 标识；
- 数据目录隔离；
- 更新 endpoint 暂未配置时的行为；
- 旧数据迁移策略；
- 回滚方式。

### 修改范围

- `package.json`：name/version；
- `Cargo.toml`：package/lib/version；
- `tauri.conf.json`：productName/version/identifier；
- 窗口标题；
- 关于页面；
- 文件关联；
- 安装包元数据；
- Linux desktop 文件；
- CI Artifact 名；
- Release 脚本；
- 日志和诊断产品名；
- 应用内用户可见品牌；
- 图标占位资源。

### 特别要求

- 删除或禁用 Paperling 自动更新 endpoint 和公钥；
- 未配置 mdtxt 更新源时关闭自动更新；
- 不修改 LICENSE 中的上游版权；
- 不删除 NOTICE；
- 不盲目替换迁移代码中的旧名称；
- 安装 mdtxt 不覆盖 Paperling；
- 增加版本一致性测试。

### 退出条件

- 所有版本位置均为 0.1.0；
- 用户界面无旧品牌；
- mdtxt 和 Paperling 可并存；
- 正式包不会访问上游更新源；
- 品牌提交不包含编辑器架构改动。

---

## 六、步骤 3：国际化基础设施

### 目标

默认中文，完整支持英文，后续 UI 重构不再产生硬编码文案。

### 推荐实现

- `i18next`；
- `react-i18next`；
- `zh-CN`；
- `en-US`；
- TypeScript 键约束；
- Rust 错误代码映射；
- `Intl` 日期、时间、数字和复数格式。

### 迁移顺序

1. 应用启动和欢迎页；
2. 设置和语言切换；
3. 标题栏与菜单；
4. 命令面板；
5. 错误和 Toast；
6. 文件树、大纲、搜索；
7. 编辑器工具；
8. AI；
9. 导出与更新；
10. 帮助和教程。

### 退出条件

- 首次启动为中文；
- 可即时切换英文；
- 语言选择持久化；
- 切换语言不重建 EditorView；
- 中英文键集合一致；
- 主流程无硬编码用户文案。

---

## 七、步骤 4：建立 DocumentSession

### 目标

消除 CodeMirror 与 React 双主状态风险。

### 实现内容

建立：

```ts
interface DocumentSession {
  id: string;
  path: string | null;
  editorState: EditorState;
  version: number;
  savedVersion: number;
  diskRevision?: {
    modifiedMs: number;
    size: number;
    hash?: string;
  };
  format: {
    encoding: string;
    bom: boolean;
    lineEnding: "lf" | "crlf";
    trailingNewline: boolean;
  };
  mode: "live" | "source" | "split" | "reader";
  recoveryId?: string;
}
```

### 规则

- 一个窗口一个活动 EditorView；
- 每标签保存独立 EditorState；
- 标签切换使用 `view.setState`；
- React 不接收每次按键全文；
- 保存、预览、AI 携带 document ID 和 version；
- 过期异步结果丢弃；
- Source 和 Live 通过 Compartment 切换；
- 不清空撤销历史。

### 退出条件

- 现有 Source/Split/Reader 功能等价；
- 多标签撤销隔离；
- 输入和标签切换无全文 React 循环；
- 保存与外部冲突测试通过。

---

## 八、步骤 5：拆分编辑器架构

### 目标

将 `CodeEditor.tsx` 收缩为挂载和 UI 容器。

### 建议目录

```text
src/editor-core/
├── core/
├── commands/
├── extensions/
├── renderers/
├── interactions/
├── bridge/
└── tests/
```

### 依次拆分

1. EditorHost；
2. EditorController；
3. 基础 extensions；
4. commands；
5. keybindings；
6. find/replace；
7. smart paste；
8. table；
9. wikilink；
10. AI merge；
11. scroll sync；
12. locale reconfiguration。

### 退出条件

- 现有功能无变化；
- CodeEditor 主文件明显缩小；
- 无循环依赖；
- 每个模块有测试；
- 不在此步新增 Live 复杂渲染。

---

## 九、步骤 6：Live Beta 最小实现

### 第一批语法

- 标题；
- 粗体；
- 斜体；
- 删除线；
- 行内代码；
- 链接；
- 引用；
- 列表；
- 分隔线；
- 任务列表。

### 技术要求

- Lezer Syntax Tree；
- Decoration；
- ViewPlugin；
- StateField；
- 当前节点显示 Markdown 标记；
- 非当前节点隐藏可安全隐藏的标记；
- 无法安全渲染时显示源码；
- 语言切换只重配本地化属性；
- 不使用正则作为结构解析核心。

### 退出条件

- Live 标记为 Beta；
- Source 可随时回退；
- 模式切换正文完全一致；
- 中文 IME 无 P0；
- 撤销重做稳定；
- 1 MB 性能达到门槛。

---

## 十、步骤 7：复杂块 Widget

按风险从低到高实现：

1. 图片；
2. 代码块；
3. Frontmatter；
4. 表格；
5. 数学；
6. Mermaid；
7. 脚注；
8. Callout。

每个 Widget 必须：

- 可取消；
- 按视口渲染；
- 使用缓存；
- 有错误回退；
- 不阻塞输入；
- 支持撤销；
- 不修改未知语法；
- 过期结果不写回。

不要在一个提交中同时完成所有复杂块。

---

## 十一、步骤 8：文件安全与恢复

### 完成

- 原子保存；
- 文件权限保持；
- 外部冲突三选项；
- 自动保存防抖；
- 会话恢复；
- 校验和；
- 恢复副本；
- 路径穿越和符号链接边界；
- UNC、长路径、文件锁；
- macOS 和 Linux 权限差异。

### 发布阻塞

任何静默覆盖、丢失未保存内容或恢复失败无备份均为 P0。

---

## 十二、步骤 9：AI、导出与平台能力

### AI

- 可完全关闭；
- 密钥只在系统钥匙串；
- UI 语言、文档语言和输出语言分离；
- 差异审阅可逐项接受；
- 请求可取消；
- 不自动写盘。

### 导出

- HTML；
- PDF；
- DOCX；
- Linux V0.1.0 允许系统打印到 PDF；
- 不引入 Chromium；
- 正文不随 UI 语言翻译；
- 导出失败不影响正文。

---

## 十三、步骤 10：三平台发布工程

### CI 矩阵

- macOS Apple Silicon；
- Windows x64；
- Ubuntu LTS x64。

按产品决策增加：

- macOS Intel；
- Linux ARM64。

### 正式发布前

- 最终 mdtxt 图标；
- macOS 签名和 notarization；
- Windows 代码签名；
- Linux AppImage、DEB，RPM 可选；
- 更新签名和 mdtxt endpoint；
- SHA256SUMS；
- 双语 Release Notes；
- SBOM；
- 第三方许可证；
- 隐私说明；
- 已知问题。

未配置正式更新基础设施时，发布 0.1.0 可关闭自动更新，但不得使用上游更新地址。

---

## 十四、步骤 11：最终回归与发布判定

必须通过：

- 双语核心 E2E；
- 三平台安装和卸载；
- mdtxt/Paperling 并存；
- 文件关联；
- 中英文 IME；
- 10 MB Source；
- 受限 Live；
- round-trip；
- 外部冲突；
- 崩溃恢复；
- 自动保存；
- AI 关闭模式；
- PDF/HTML；
- 正式包无调试 MCP Bridge；
- 正式 CSP；
- 版本一致性；
- 许可证和 NOTICE。

发布标签：

```text
v0.1.0
```

---

## 十五、每轮 Codex 固定输出

```text
1. 当前步骤和目标
2. 明确不在本轮完成的范围
3. 阅读的关键文件
4. 设计决策或 ADR
5. 修改文件清单
6. 测试命令和真实结果
7. 构建命令和真实结果
8. 性能、数据和兼容性影响
9. 已知问题
10. 回滚方式
11. 下一步建议
```

不得用“应该可用”“理论上通过”代替真实测试。

---

## 十六、推荐首次交给 Codex 的任务

```text
请严格按照 mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md 和
mdtxt_CODEX_REFACTOR_STEPS_V0.1.0.md 执行“步骤 0：仓库审计与基线冻结”。

本轮禁止修改用户可见功能，禁止品牌替换，禁止编辑器重构。

请完成：
1. 阅读仓库核心代码和构建配置；
2. 输出模块、状态流、保存流、更新流；
3. 搜索旧品牌、版本、identifier、更新 endpoint 和硬编码用户文案；
4. 运行现有测试与构建；
5. 记录失败项和性能基线；
6. 创建 docs/audits/baseline-0.1.0.md；
7. 按固定格式汇报。

完成步骤 0 后停止，不要自动进入下一阶段。
```
