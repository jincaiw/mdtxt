# mdtxt 0.1.0 实施计划（评估优化定稿）

> 状态：**Final v1.0，证据更新至 2026-07-18**（A3 已再次确认为唯一 UI 基线；P6 macOS 简体拼音门禁已通过，Windows/Linux 仍按平台保持未验证；P8 文件安全并行实施中；本版为后续执行唯一计划）
> 适用仓库：当前工作树及 mdtxt 专属远端
> 工作分支：`codex/refactor-mdtxt-0.1.0`
> 目标：将既有 Paperling 渐进迁移为独立、双语、跨平台的 `mdtxt` 0.1.0。

## 1. 定稿结论

本计划保留 PRD 的功能范围与技术路线，但以已经落地的工作为基线重新编排：

```text
已完成：P0 基线 → P1 安全契约 → P2 身份隔离 → P3 双语底座
已完成：P4 文档会话单一事实源
进行中：P6 Live Beta（最小、可逆、默认关闭）与 P8 文件安全（不改变正文所有权）
并行基础设施：P10a 三平台构建与证据采集基座（不改变产品行为、不产出 GA 包）
后续：P6 的 Beta 证据闭环 → P7 Widgets；P8 在 P7 期间继续完成恢复与文件系统证据
      P7 + P8 均验收 → P9 AI/导出/平台 → P10b 发布工程收口 → P11 发布判定
```

唯一可接受的主路径仍是：**先消除 React 与 CodeMirror 的双全文状态，再拆分编辑器，再引入 Live 与 Widgets**。不得以“模型已建立”代替状态迁移完成；`DocumentSession`、版本令牌、按标签模式、版本化保存和展示投影均已落地，`App.tsx` 不再保存活动全文或 tab 正文副本。P5 不得重新引入该桥接状态。

本文件替代此前的执行提示与 v0.2 计划。产品需求、验收场景和 Definition of Done 仍以 [mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md](mdtxt_PRODUCT_REQUIREMENTS_V0.1.0_FINAL.md) 为准；当两者冲突时，以 PRD 的安全与验收要求为准。

本次复评后的执行原则是：**代码落地、自动化通过、当前平台人工证据和三平台发布资格是四个不同状态**。任何一个阶段都不得把前两项写成“已验收”，也不得把 macOS 证据外推为 Windows/Linux 已通过。每个子关卡均须在对应追踪文档中列出未覆盖项、负责人环境和回滚点。

计划中的“完成”只表示该子关卡的代码与自动化闭环；“阶段验收”则要求本节指定的人工或原生证据；“某平台可分发”还要求该平台所有相关矩阵单元已记录为通过或有明确的 beta 限制。未覆盖平台只能写作“未验证”，不能由 CI 编译成功、macOS 观察结果或浏览器测试替代。

本次定稿关闭的是**实施决策**，不是产品发布：本文件不授权提前启动 P7、P9、P10b 或 P11，也不把 Live Beta 改为默认。下一次计划变更只允许由以下三种事实触发：某个 P6/P8 门禁已获得可复查的目标平台证据、获得 mdtxt 专属远程/目标环境的授权、或 PRD 本身发生版本化变更；其余情况只更新对应证据表，不重排阶段。

## 2. 已验证基线与阶段状态

| 阶段 | 状态 | 已交付的证据 | 下一道门槛 |
| --- | --- | --- | --- |
| P0 基线冻结 | 完成 | `d46d807`、`docs/audits/baseline-0.1.0.md` | 保持基线可复跑 |
| P1 安全契约 | 完成 | `ca32c04`，fixture、回归与预检基础 | 后续功能必须补对应 fixture |
| P2 产品身份 | 完成 | `122071b` 至 `9495dd6`，mdtxt 标识、品牌隔离、updater 关闭；发布/测试工作流、Issue 模板已移除上游用户入口，`release:check` 会构建并扫描文档站产物 | 发布前再次扫描泄漏与真实包标识 |
| P3 双语底座 | 完成 | `96a9931`，默认中文、双语键、硬编码门禁 | 新增文字必须双语 |
| P4 文档会话 | 完成 | `8a087ec`、`a8c782c`、`36a2ac4` 至 `c748e70`；控制器、每标签 `EditorState`、版本化保存、展示投影与 metadata-only tabs；浏览器双标签/Reader/Source 回归无控制台告警 | P5 仅拆分编辑器模块，不改变会话边界 |
| P5 编辑器模块拆分 | 完成 | `d68ec3d` 至 `c162371`；presentation、viewport、document session、completion、AI review、preferences、overlays、paste、host 与 controller 分层；`CodeEditor.tsx` 收缩为 30 行挂载容器；全量 38 测试文件/296 测试、构建与发布预检通过 | P6 以该稳定 host 为唯一接入点 |
| P6 Live Beta | 进行中，未验收 | 最小、可逆的 Lezer/Decoration/Compartment 路径与受限 Live 已落地；`007843b` 的当前 Debug bundle 已通过 macOS 简体拼音组合/候选/提交、选择/剪贴板、撤销重做、模式/标签切换；同提交的 Ubuntu 原生冒烟通过 1 MiB 输入与 10 MiB Source/受限 Live 测量 | 补齐 Windows Microsoft Pinyin、Linux IBus/Fcitx5 及 Windows 原生性能证据；不得把 macOS/Ubuntu 结果外推为其他平台，显式 Beta 开关也不等于退出 |
| P7 复杂 Widgets | 未开始 | 不提前实现 | 依赖 P6 退出与焦点/降级协议 |
| P8 文件安全、冲突与恢复 | 进行中，未验收 | `20017a3` 起；原子替换、修订与哈希防护、可见冲突入口、校验恢复、失败注入、恢复键跨启动隔离及会话恢复顺序/活动标签/光标行的自动化协议均已落地；macOS 已有隔离 Debug 两标签 AC-007 原生恢复证据；以 `docs/audits/p8-file-safety-tracking.md` 为唯一证据表 | 完成 Windows/Linux 恢复与文件系统矩阵，并对每个 post-rename 不确定性提供可见告警；macOS Debug 证据不外推为其他平台或发布包通过 |
| P10a 平台证据基座 | 三平台 Debug 构建基座完成，目标平台功能证据未完成；不计入发布工程完成 | `019c86e` 建立手动三平台 Debug 包和 SHA-256 清单采集，`edf96d7` 对齐 CI 目标；独立远端 `jincaiw/mdtxt` 已建立；A3 对齐提交 `99cc34b` 的 [Platform Evidence Build #29481051915](https://github.com/jincaiw/mdtxt/actions/runs/29481051915) 在 macOS ARM64、Windows x64 与 Ubuntu 24.04 全部通过，下载后的 DMG/MSI/NSIS/DEB/AppImage 哈希与清单一致；`523793e` 的 [CI #29481353041](https://github.com/jincaiw/mdtxt/actions/runs/29481353041) 还通过了 Windows/Ubuntu 原生 WebView 四模式工作区冒烟 | 继续完成三平台安装、IME、恢复和 P6/P8 功能矩阵；不得将包构建或非交互原生冒烟宣称为平台功能通过 |
| P9、P10b、P11 | 未开始 | 不提前实现产品整合或正式发布 | 依赖 P7、P8 的验收结果 |

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
                              ├─ P5 → P6 → P7 ─┐
                              └─ P8 ─────────────┼→ P9 → P10b → P11
P3 + P4 ─────────────────────────────────────────┘
P2 ─────────────────────────→ P10a（构建/证据基座） ───┘
```

执行顺序不是“谁先写完谁先宣告完成”，而是下列两条泳道在汇合点前各自闭环：

| 泳道 | 当前最小闭环 | 不可跨越的汇合门槛 |
| --- | --- | --- |
| A：P6 Live Beta | 输入与焦点矩阵 → 受限 Live 性能实测 → 可访问性与三平台证据 | 未退出 P6，不开始 P7 的隐藏标记或 Widget 行为 |
| B：P8 文件安全 | 保存结果 `mtime + hash` 闭环 → 冲突选择 → 恢复与失败注入 → 文件系统证据 | P8 未验收，不允许把 Live 改为默认，也不进入 P9/P10 发布资格判断 |
| C：P10a 平台证据基座 | Windows x64、Ubuntu LTS x64 的构建/安装/启动采集入口 → 复用 P6/P8 手工矩阵 | 只提供可复跑环境和原始证据；不得提前启用 updater、签名或将 CI 编译当成功能验收 |

1. 一次提交只解决一个可回滚主题；品牌、依赖大版本升级、状态迁移和 Live 行为不得混在同一提交。
2. 每个阶段入口先补失败测试或 fixture，再实现，再做全量回归；没有证据不得改变阶段状态。
3. P4 完成前，禁止默认启用 Live、引入复杂 Widget，或把现有 `CodeEditor` 拆分伪装为状态迁移完成。
4. P8 可在 P5/P6 之外并行设计，但凡涉及活动编辑器、保存状态或冲突 UI 的代码变更，必须等 P4 完成；P8 的原子保存、冲突和恢复验收是 Live 设为默认的硬前置。
5. 未完成项保留 Source 降级路径；未在真实目标平台验证的项目必须标记为“未验证”。
6. 保存结果必须由 Rust 返回实际落盘后的修订、内容哈希及（如适用）`durabilityWarning`；前端仅在 `documentId + version` 仍匹配时更新会话的 dirty、mtime、hash 与恢复状态。不得用请求前的值推测保存成功；替换已发生但目录同步未获确认时，必须保留成功结果并向用户显示耐久性告警，不能伪造“保存失败”或“仍未保存”。
7. P6/P8 的平台验证先记录当前 macOS 实测，再通过 Windows、Ubuntu LTS 的 CI/人工矩阵补齐；环境缺失是发布阻塞，不是“推定通过”的理由。

## 5. 阶段实施与退出条件

### P4：DocumentSession 与状态单一事实源（已完成）

目标不是再增加模型字段，而是将正文、选择与撤销历史真正交给会话。

| 子关卡 | 工作范围 | 强制验收 |
| --- | --- | --- |
| P4a ✓ 会话契约 | ADR、纯 `DocumentSession`、版本/保存/外部变更/模式模型 | 纯模型测试覆盖脏恢复、过期结果、外部内容与每标签模式 |
| P4b ✓ 会话控制器 | 已建立 framework-independent controller/store；React 订阅摘要；打开、激活、关闭、修改、保存与外部更新经统一会话 API | 控制器测试覆盖摘要隔离、激活、关闭、保存、外部更新与过期结果；App 不再维护独立 session Map |
| P4c ✓ EditorState 所有权 | 每标签保存 CodeMirror `EditorState`；单一 `EditorView` 在切换时回存/`setState`；移除 `docSwapId` 历史重置 | 存储与浏览器验证覆盖两标签文本/历史隔离；语言和模式切换不重建 View |
| P4d ✓ 迁移收口 | 已按下列 P4d-1 至 P4d-4 的顺序消除活动全文状态、`docSwapId` 式全文替换及 tab 内容副本；预览/保存/AI 读取版本化快照 | 输入路径没有按键级全文 React 更新；Source/Split/Reader、自动保存、外部变化、AI 审阅回归通过 |

退出条件：P4a–P4d 全部通过，且代码审查能明确证明 React 仅接收 `DocumentSessionSummary` 与 UI 状态。任何一个标签的正文、选择或历史仍由 React 作为主状态即不退出 P4。

P4d 必须拆为下列可独立回滚的提交，不得合并跳过：

| 子项 | 范围 | 通过标准 |
| --- | --- | --- |
| P4d-1 ✓ 版本化写入 | 显式保存、另存为、活动自动保存由 `documentId + version` 快照写入，回调仅接受同版本结果 | 旧保存完成不能覆盖新编辑；已由 `8a087ec`、`a8c782c` 覆盖 |
| P4d-2 ✓ 后台会话操作 | 非活动标签自动保存、外部变化、关闭标签/窗口与恢复从控制器按需读取，不读取 tab 正文 | 脏标签、磁盘更新和窗口关闭不会使用陈旧 React 副本 |
| P4d-3 ✓ 展示投影 | 预览、大纲、统计、AI、导出只消费节流的版本化展示快照；该快照不能反向驱动编辑器 | 每次按键不触发全文 React 主状态；异步结果以版本拒绝过期写入 |
| P4d-4 ✓ 删除遗留副本 | `TabState` 仅保留元数据，移除 `content`、`originalContent`、`liveRef` 等正文主状态桥接 | 静态审查和回归证明 React 中无正文、选择或 history 的主副本 |

### P5：编辑器模块拆分（无新增 Live 能力，已完成）

在 P4 完成后，将 `CodeEditor.tsx` 收缩为挂载容器。按低风险顺序提取 `editor/core`（host/controller）、`commands`、`extensions`、`interactions`、`bridge` 与针对性 tests；依次迁移基础 extension、命令/快捷键、查找替换、smart paste、表格、wikilink、AI merge、滚动同步和 locale reconfiguration。每次只迁移一类协议，并保持 Source/Split/Reader 行为不变。

退出条件：无循环依赖；`CodeEditor` 仅管理容器；已有 Source/Split/Reader 行为等价；模块测试覆盖迁出的协议；不得重新引入 React 全文状态。

### P6：Live Beta（最小、可逆、非默认，进行中）

已完成的前置基线与最小实现不得被误记为 Beta 验收：round-trip fixture、中文 IME 手工清单、1 MiB/10 MiB 解析基准方法已经入库；首批结构识别使用 Lezer `syntaxTree`，以 `StateField<DecorationSet>`、transaction mapping 和 changed-range 局部更新添加**只样式化**装饰。该策略刻意不隐藏源码标记，因而在焦点、选择与 IME 期间始终保留可编辑原文；解析或装饰失败天然回退为 Source。

P6 剩余工作按以下顺序执行，任一项失败即保持 Beta 关闭或回退 Source：

| 子关卡 | 范围 | 强制验收 |
| --- | --- | --- |
| P6a ✓ 基线与最小安全展示 | 标题、强调、删除线、行内代码、链接、引用、列表、分隔线、任务列表；不做 `Decoration.replace` | fixture 逐字保持、Lezer 结构测试、1 MiB/10 MiB 基准命令可复跑 |
| P6b ✓ Beta 入口与会话契约 | 默认关闭的持久化设置；仅显式启用后显示 Live；禁用或旧会话恢复时退回 Source；同一 `EditorView` 通过 Compartment 切换 | 组件/会话测试证明入口隐藏、启用/禁用、每标签模式恢复与 host/undo history 不重建 |
| P6c 焦点与输入安全 | 已有统一 `EditFocusResolver` 处理主光标、多选区、composition range、鼠标和查找命中；保持源码可编辑，补齐真实原生 WebView 验证 | 中文 IME、选择、复制粘贴、undo/redo、模式/标签切换手工矩阵无 P0；每个平台未验证项如实记录 |
| P6d 受限 Live 与性能 | 以字节数、行数、最长行和复杂节点量判定；初始阈值 5 MiB 或 100000 行，经基准调整；只保留低成本装饰并显示降级原因 | 1 MiB 输入 P95 与 10 MiB Source/受限 Live 打开目标有真实测量；不能静默改正文或永久改默认模式 |
| P6e Beta 收口 | 补齐模式切换、可访问性、双语文本、需求追踪和 native-WebView 证据 | `bun run test`、`bun run build`、`bun run release:check` 及适用 Rust 门禁通过；追踪表将“未验证”与“通过”分开记录 |

退出条件：Source/Live/Split 正文逐字一致；基础内联和块级语法、模式切换、undo/redo 与 round-trip 自动化通过；中文输入法无 P0；1 MiB 输入指标及 10 MiB 受限 Live/Source 实测已记录；可随时退回 Source；没有正则主解析、整篇重算、默认启用 Live 或未记录的平台假阳性。P6 退出只允许发布 **Live Beta**，绝不等同于 Live 默认资格。某一目标平台只有在其 IME、基础选择/剪贴板、模式/标签切换和大文件降级记录齐全后，才可随该平台 beta 包分发；三平台都通过仍是 Live 默认与 GA 的硬前置。

### P7：复杂块 Widgets（逐项发布）

严格按图片、代码块、Frontmatter、表格、数学、Mermaid、脚注、Callout 推进；一个类型一个可回滚提交。每项具备 fixture、视口惰性渲染、取消、缓存、错误源码降级和版本令牌。表格先完成源码兼容与命令操作，数学/Mermaid 必须在受限渲染器中执行，不能将不受信任内容交给页面脚本。

退出条件：每项独立性能记录与失败回退；未知语法保持原样；异步结果不阻塞输入、不写回过期文档。

### P8：文件安全、冲突与恢复

P8 必须按下列小关卡推进，避免把 Rust 写入安全、前端会话状态和跨平台文件系统行为混为一个不可回滚变更：

| 子关卡 | 范围 | 强制验收 |
| --- | --- | --- |
| P8a ✓ 保存结果契约 | `read_file` 返回原始字节哈希；`save_file` 接收预期修订/哈希，并返回实际落盘的 `{ modified, hash, durabilityWarning? }`；显式保存、自动保存、后台保存、关闭保存与另存为统一消费该结果 | 同 mtime 内容变化、过期版本、过期哈希和保存后 hash 更新均由 Rust/会话/hook 回归覆盖；失败保存不清 dirty 或恢复副本，post-rename 耐久性不确定性必须可见 |
| P8b ✓ 外部变化与冲突 | 脏文档不推进已知磁盘修订；提供比较、重载磁盘、保留本地、另存为，覆盖活动和后台标签入口 | 每一种选择均可见且非破坏；旧磁盘字节和本地缓冲区不会被静默覆盖；取消保持可编辑状态 |
| P8c ✓ 代码与 macOS Debug 证据，未完成跨平台验收 | 副本层的校验、有限保留、启动发现、恢复为新未保存标签、丢弃和失败提示；会话层的多标签、活动标签与大致选择/滚动位置恢复；最新恢复批次隔离旧批次 | 自动化及 macOS 隔离 Debug AC-007 两标签恢复已通过；Windows 与 Ubuntu LTS 仍必须分别证明终止/重启后恢复顺序、活动标签和大致位置，损坏副本被拒绝且恢复绝不覆盖原路径 |
| P8d 耐久性与平台矩阵 | 写、同步、重命名、目录同步失败注入；符号链接、长路径、UNC、锁和替换语义 | **替换前**失败必须证明原文件字节与编辑缓冲可存活；**替换后**目录同步失败必须保留新内容、清理临时文件并报告 `durabilityWarning`；macOS、Windows、Ubuntu LTS 逐项记录，平台特例有明确降级文案 |

落地读写格式元数据（编码、BOM、EOL、尾随换行、磁盘修订/哈希）。Rust 保存采用同目录原子替换、fsync、权限保持和失败清理；写入前检测外部变更，提供比较、重载、保留本地、另存为；恢复副本带校验与有限保留期。P8a 完成不代表 P8 退出；只有 P8a–P8d 全部有证据才可关闭数据安全发布阻塞。

退出条件：未修改文件 byte round-trip；无静默覆盖；冲突和恢复有自动化与可见路径；符号链接边界、长路径/UNC 和文件锁有平台记录；替换后耐久性不确定性不会被伪装为失败或静默成功。任一数据丢失问题均为 P0。

### P9：AI、导出与平台收口

AI 可完全关闭；密钥只经系统钥匙串；请求可取消且差异逐项接受。HTML/PDF/DOCX 使用版本化快照，输出由 Rust 控制路径写入，失败不影响正文。区分界面语言、文档语言与输出语言；平台错误双语化并收紧权限/CSP。

退出条件：AI 关闭和密钥失败安全；导出 fixture 通过；无 localStorage 密钥回退、调试桥、测试密钥或宽松 CSP。

### P10a：平台构建与证据基座（可从当前阶段并行，非发布资格）

该子阶段只解决“能在真实目标环境重复采集证据”，不改变产品功能、不启用更新器、不制作 GA 声明。工作流已提供 Windows x64、Ubuntu 24.04 x64 与 macOS 14 ARM64 的 Debug 包和 SHA-256 清单；独立远端 `jincaiw/mdtxt` 已可触发并归档这些工件。下一步是在该远端/ref 或人工目标环境实际执行安装/启动，并将 P6 的 IME/性能矩阵和 P8 的恢复/文件系统矩阵作为同一证据包的必填附件。当前 `origin` 仍是上游 Paperling，不能触发或引用其发布结果作为 mdtxt 证据。Docker 交叉编译、CI 编译成功或非目标发行版容器均不得替代此记录。

退出条件：每个目标平台都能从干净环境产生可识别的 Debug/测试包，并能记录 OS、文件系统、WebView、包标识、原始命令输出和失败原因；此退出条件**不**表示 P6、P8 或任一用户流程通过。

### P10b：发布工程

在 P10a 已建立的真实环境上形成 macOS Apple Silicon、Windows x64、Ubuntu LTS x64 的 CI 产物；明确 Intel/ARM64 是否纳入。完成图标、签名/公证策略、AppImage/DEB、SHA256SUMS、SBOM、第三方许可证、隐私说明与双语 release notes。仅在 mdtxt endpoint 和签名密钥均真实验证后启用 updater。CI 矩阵、锁文件冻结和基础构建检查作为持续门禁维护。

退出条件：目标产物、版本、标识和文件关联一致；预检不存在上游品牌、endpoint 或密钥泄漏；所有未签名平台明确为 beta，不能标 GA。

### P11：最终回归与发布判定

打 `v0.1.0` 前执行双语 E2E、三平台安装/卸载及与 Paperling 并存、中文 IME、10 MiB Source 与受限 Live、round-trip、外部冲突、崩溃恢复、自动保存、AI 关闭、HTML/PDF/DOCX、正式 CSP、许可证/NOTICE 和发布预检。

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

每个阶段的记录必须包含：修改范围、对应 ADR/fixture、命令和结果、性能/兼容影响、已知问题、回滚提交与下一阶段入口条件。阶段验收时再附一份不可复用的“证据包”：提交 SHA、构建包标识、机器/OS/WebView、测试数据与步骤、原始输出/截图位置、实际结果、未覆盖项和回滚点。发布阶段额外执行依赖审计、目标平台安装验证与 `bun run release:check`。

每个阶段还必须更新一份需求追踪记录：列出覆盖的 PRD 编号、自动化证据、真实平台证据和未覆盖原因。P6、P7、P8、P9、P11 至少分别追踪 `FR-EDIT`/`FR-MD`、复杂 Markdown 条目、`FR-FILE`、`FR-AI`/`FR-EXPORT`/安全条目，以及 AC-001 至 AC-010 与 Definition of Done；未覆盖的 P1/P2 项不得被误记为 P0 已验收。

## 7. 当前执行边界

当前执行采用三泳道：**P6c/P6d：原生输入与受限 Live 性能证据**、**P8c/P8d：恢复及耐久性平台验证**，以及 **P10a：目标平台构建与证据采集基座**。P6a/P6b 只证明最小装饰能够安全挂载且入口被可靠隔离，**不证明** IME、选择、撤销、大文件、平台或默认 Live 已通过；P8a/P8b 已建立哈希闭环与完整冲突体验，P8c 已证明 macOS 隔离 Debug AC-007 两标签恢复，但尚未证明 Windows/Linux 恢复或跨平台文件系统耐久性。

执行约束如下：

1. 保持 Source 为默认模式；Live 入口只在用户明确开启 Beta 后出现，关闭开关和旧持久化值都必须回退 Source。
2. P6c 验收前不得添加隐藏源码标记、复杂 Widget 或独立 renderer 焦点逻辑；任何焦点/IME 回归均停止扩展并回退到只样式化模式。
3. P6d 必须先交付可测的降级判定和用户可见状态，再处理复杂节点；10 MiB 的“完整 Live”不作为当前承诺。
4. P8a/P8b 已完成；P8c 已有 AC-007 会话级恢复实现、失败测试和 macOS 隔离 Debug 两标签原生证据，下一步是 Windows/Linux 记录；P8d 的目标平台替换、目录同步、符号链接、长路径、UNC 与锁矩阵可与 P8c 并行采集。目录同步在替换后失败时只允许“成功 + 耐久性告警”的真实语义。P8 修改不得恢复 React 全文副本或绕过 `DocumentSessionController`。
5. P6c 以真实 IME、选择、剪贴板、undo/redo、标签切换矩阵为先；P6d 的 CodeMirror 状态基线可独立重复，但只有在 P6c 无 P0 后记录的 1 MiB/10 MiB 原生 WebView 测量才能满足退出条件。P7 不得提前开始；P7 启动后仍不得把任何 Widget 焦点逻辑绕过 P6 的保守源码策略。
6. 每完成一个子关卡，更新对应的 `docs/audits/p6-live-beta-tracking.md` 或 `docs/audits/p8-file-safety-tracking.md`，记录提交、命令、机器/平台、未覆盖原因和回滚点；申请阶段验收时按第 6 节提交完整证据包，而非仅更新状态文字。
7. P10a 仅维护环境与原始证据索引（`docs/audits/p10a-platform-evidence.md`）；当目标平台不可用时记录阻塞原因、最后尝试时间和替代方案，不得以容器、交叉编译或其他 OS 的结果填充 P6/P8 通过单元格。

## 8. 定稿后的最小执行包与暂停条件

以下队列按“可由当前环境推进”与“必须等待外部输入”分开，避免为了维持进度而扩大功能范围：

| 优先级 | 仅在前置条件满足后执行 | 产出与验收记录 | 暂停条件 |
| --- | --- | --- | --- |
| 1 | 获得 macOS、Windows x64、Ubuntu LTS x64 任一真实桌面环境 | P6 IME/选择/剪贴板/撤销/模式切换和 1 MiB、10 MiB 原生 WebView 测量，写入 `docs/audits/p6-live-beta-tracking.md` | 任一可复现输入丢失、候选窗错位或光标跳动即标 P0、停止扩展 Live |
| 2 | 获得 Windows 或 Ubuntu LTS 真实桌面与对应文件系统 | P8 AC-007 两标签恢复、符号链接、长路径、锁、替换/目录同步记录，写入 P8 追踪表和文件系统矩阵 | 任一静默覆盖、恢复覆盖原路径或原文件损坏即标 P0、停止发布相关工作 |
| 3 | 已获得 mdtxt 专属远程/ref；等待可交付的目标平台人工证据 | 维护 P10a Debug 包、清单、安装启动日志和对应矩阵链接 | 上游 Paperling remote、交叉编译或容器结果不得替代；没有人工证据则功能矩阵保持 Pending |
| 4 | P6、P8 都已按三平台门禁验收 | 才可启动 P7；每个 Widget 类型独立提交、fixture、性能与源码回退 | 任一焦点、输入或数据安全回归即回到 Source/上一可回滚提交 |

在优先级 1–3 未获得新环境或授权前，实施工作应停在证据采集边界：只允许修复已经复现的 P0/P1 缺陷、补充不改变产品行为的测试/文档，禁止以推测性功能开发替代验收。P7、P9、P10b、P11 均不在当前可执行队列中。
