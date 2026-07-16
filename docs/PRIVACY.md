# mdtxt 隐私说明 / Privacy Notice

mdtxt 默认离线运行，不要求账户，也不包含遥测、分析或广告组件。打开、编辑、
恢复和导出的文档保留在用户选择的本地路径或操作系统应用数据目录中。

AI 功能默认关闭。只有用户明确启用并发起请求后，选中文本、受上限约束的文档
上下文以及用户问题才会发送到用户自己配置的 OpenAI 兼容端点。API 密钥仅保存
在操作系统钥匙串；若钥匙串不可用，密钥只在当前进程内存中保留。mdtxt 不经营
AI 代理服务器，也不会把密钥写入浏览器存储。

mdtxt works offline by default and requires no account. It contains no
telemetry, analytics, or advertising. Documents remain at user-selected local
paths or in the operating system application-data directory used for verified
crash recovery.

AI is disabled by default. Only after explicit opt-in and a user request does
mdtxt send selected text, bounded document context, and the user's prompt to
the OpenAI-compatible endpoint configured by that user. API keys are stored in
the operating system credential store; if it is unavailable, a key is retained
only in process memory for that session. mdtxt operates no AI proxy and never
writes the key to browser storage.
