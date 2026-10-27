# Status

当前源码与本机部署：**dsh-preset-manager 0.1.0-test.3**，Character Core **test.17**、Memory Inspector **test.3**，运行于 DSH **0.2.1-rc.3**。独立原生 Bundle，不写入 Character Core/Extras。上游来源与 MIT 许可证见 UPSTREAM.md。本轮新界面的原生验收使用 rc.3，未重复认证 rc.2。

Plugins / Skills 统一为「已添加、未添加 → DSH 官方、额外安装」，进入即扫描，支持搜索/刷新。配置存在、关闭、条件、失败和原生装配状态分别展示；同模块多 Row、Group、CAS、Schema/JSON、Skills 版本/编辑/导入保留。原生继承、手动分配和实际策略项一并显示；全局停用不再被误当作未添加。未知来源明确标注，不以包名前缀冒充官方。

验证：112 项单元通过，1 项原有 Windows 符号链接测试保留平台跳过。最终打包产物通过 rc.3 两进程 Host、Profile 替换/合并、Skills 分配/版本/全局停用、CAS、Scope/Schema 拒绝与失败回退；Character 跨仓库原生测试通过十个 Worker 的工具/Skills 配置、Spawn 白名单/一级深度与冷恢复。

真实 Web GUI 使用合成数据实际完成搜索、配置表单/JSON、错误提示、启停、排序、移除/重新添加、Skill 分配/关闭和刷新。Desktop 原生 RPC 已验证；新 UI 的桌面点击写操作、视觉 HMR及慢网络实机验收未完成，不能以资源 200 替代。测试不使用真实 QQ 或记忆。

部署：仅升级 Manager/Inspector 两包，14 个其他直接依赖的代码保持，Profile patch、Bundle 装配、QQ 补丁和 Worker 权限不变。已保留一致性快照及可恢复的旧 Profile，13 个 Preset 健康、QQ 单连接。维护健康校验对纯文本 401 的误判已修正，实际失败切换曾恢复旧 Profile并验证健康。未迁移记忆、未发送 QQ 测试消息。

回滚恢复旧包/锁文件和匹配 Profile，保留完整 .dsh-preset-manager/；不覆盖之后产生的 Session/Memory。无需数据 Schema 迁移。详细本机路径、维护证据、日志和截图仅保留在忽略目录；本地通过不等于远端 CI 或真实手机收件通过。
