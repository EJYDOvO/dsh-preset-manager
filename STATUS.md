# Status

当前源码：**dsh-preset-manager 0.1.0-test.2**，兼容已验证的 DSH 0.2.1-rc.2 / rc.3；独立原生 Bundle，不写入 Character Core/Extras。上游来源与 MIT 许可证见 UPSTREAM.md。

已修复多层 Group 合并丢失用户新增行、unresolved 引用误标 addable；新增保守的原生 Schema 表单与 JSON 回退。Host 依赖/Scope/Config 校验、Owner 授权、CAS 和失败补偿保持。

已验证：107 项单元回归通过，1 项上游 Windows 文件符号链接测试保留原平台跳过；实际打包产物通过两进程 Host、Profile 替换与恢复、Skills 分配/版本、上游合并基线、装配失败回退、原生 Worker 真实工具调用及冷恢复。Character 跨仓库隔离测试另验证 Manager 为实际内置 Worker 配置 Plugins/Skills，白名单、一级深度、独立 Session 和 Host 身份授权不变。

Web GUI 已在 DSH 原生「设置 → Preset 管理」用合成数据实际点击搜索、配置表单/JSON、错误提示、添加、排序、启停、移除与 Skills 分配/启停及刷新。Desktop RPC 协议通过，桌面写操作及 HMR 视觉效果未验证；资源 200 不算 GUI 验收。测试未连接真实 QQ、未使用用户记忆或生产凭据。

已受控部署 Character test.17（运行代码 5c23b75）+ 管理器 test.2（运行代码 34db4a1）。新 Host 健康，13 个 Preset 无失败、七个 Worker 默认只有 Persona、QQ 单连接。当前 Owner API、Schema 和版本化资源可用，未登录与跨来源请求拒绝；这些运行 API 检查不等于真实 GUI 写操作验收。保留旧 Profile 与 297 文件一致性快照；Memory、绑定、路由、Schedule 和官方 DSH 文件校验一致。没有发送真实 QQ 测试消息，未在当前实例演练回滚。本提交未查到远端 Actions run，不能把本地结果视为远端 CI 已验证。回滚需恢复匹配包、锁文件、Profile patch 和完整 `.dsh-preset-manager/`，保留 Session/Memory；Character test.16 会重新启用其旧 Worker Boundary。

rc.3 已用新安装目录完成全量单元、两进程原生 Host/配置恢复及 Character Worker 跨仓库验收。当前实例继续使用同一 test.2 运行包，Owner API、Schema 和原生资源正常。Desktop 设置入口和 Worker 列表已只读实测，桌面写操作及视觉 HMR 仍未验证。测试/维护脚本的宿主选择适配不需要覆盖插件包。
