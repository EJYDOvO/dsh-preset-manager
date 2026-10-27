# Preset Manager

DSH 的独立 Preset / Plugins / Skills 管理插件，基于 MIT 开源 [dsh-modes 0.9.1](https://github.com/xiaohai-78/dsh-modes) 的 Fork。源码、内嵌 GUI、测试和集成脚本均在本目录，独立于 Character Core/Extras。[上游版本与差异](UPSTREAM.md)。

## 功能

- 保留 Modes 的模式卡片、能力开关、Prompt、工具描述、Skills 版本与导入、自定义 Preset，以及三方更新合并。
- 「设置 → Preset 管理 → 插件」选择 Preset，自动加载目录；先分为**已添加 / 未添加**，再分为 **DSH 官方 / 额外安装**。搜索同时过滤四组。已添加保留全部 Row（包括停用、条件行、失败行及同模块多行），配置、移除、启停和同组排序沿用原生保存接口。Schema 表单与 JSON 回退保留。
- 保存通过原生临时 Preset 装配验证 Schema、服务依赖与 Scope；失败不写配置。并发和旧页面保存通过修订指纹防止覆盖。
- 「技能」使用同样的双区、双来源布局，合并原生可访问 Skills、手动分配、停用与版本固定记录。缺少 Skill Tool 不等于文件不存在；缺失文件、名称冲突和调用限制分别提示。原生 Skill 只关闭，不伪装成删除文件；版本、内容编辑与导入保留。批量开关只影响已添加项。
- 官方与 Character Bundle 的源定义只读；编辑只写当前 Profile 的 Override，自定义 Preset 由 Modes 容器管理。Worker 作为普通 Preset，使用真实 ID，不增加 Boundary，不改 Character 的 Spawn 白名单。

不提供插件安装器或市场，不启动 QQ/Agent。已在 Host 启用、但未在任何 Preset 使用的模块保守标记为 Host，不直接重复加入 Preset。其他候选需实际装配验证。**装配会执行已安装代码的生命周期，不构成恶意插件沙箱。**

来源依据 Host 包解析、安装层及真实文件位置；第三方/本地归为额外安装，无法确认的条目标明「来源未确认」，不靠 `dsh-` 名称认定官方。目录扫描不导入未选中的第三方代码；手动检查或确认保存才使用原生 Loader。配置存在、条件启用和实际装配是独立状态。

## 安装与启停

需要 DSH **0.2.1-rc.2 / rc.3** 的当前开发接口，推荐 Node 24。使用原生 Profile 安装本地目录或打包产物：

```powershell
dsh plugin --profile <profile> add <absolute-path-to-extra/preset-manager>
```

该包自带 Bundle，含 Host 管理插件与自定义 Preset 容器。安装依赖、选择 Bundle 和重启是不同操作；在原生 Plugins 页确认 `dsh-preset-manager` 已选择，再打开设置。无需在 Character Core/Extras 复制声明，普通 Agent 项目同样可用。

**与原版 dsh-modes 二选一**，不能同时启用。已有 Modes 数据不自动搬迁：先停用原版、备份 Profile，再审核自定义 Preset、模块名和状态目录后迁入；本版没有自动迁移脚本。

GUI 使用原生 `settings.section`、React/主题和 Connection RPC，不是外置网页。API 只接受连接的 Owner，浏览器不能用参数声明可信身份。Web/Desktop 共用协议；Web 已完成合成数据的真实页面操作验收；Desktop 只读入口已验证，写操作及 HMR 仍未验证。

## 状态、更新与恢复

Profile 的 `cordis.patch.yml` 保存 Override 与容器；`.dsh-preset-manager/` 保存合并基线、Prompt/工具/Skills 历史与分配。复用原子写入、配置锁和原生失败回滚，损坏状态会报告而不会清空。一个 Profile 只允许一个 Host 写入。

- Bundle 更新后递归合并多层 Group 的未改字段，保留用户新增、配置、移除和组内顺序，冲突由 Owner 核对。
- 组合变化只影响新 Session，旧 Session 保留原修订；原有 Live Prompt/Skills 策略仍按 Modes 机制生效。
- 更新前备份 Profile 和状态目录，保留旧包、锁文件；失败时恢复匹配包/配置，不覆盖 Session 或 Memory。
- 停用 GUI 不改 Character、QQ、Memory。卸载前处理自定义 Preset；基础 Preset 中本插件添加的行保留卸载条件，避免残留缺失模块。
- 原有自更新维护功能保留，但只指向本 Fork，自动检查默认关闭，本地源安装不检查。当前没有 npm 发布版本，不应使用原版 Modes 更新命令覆盖本 Fork。

## 测试与限制

```powershell
npm test
$env:DSH_INSTALL_ROOT='<installed DSH directory>'
powershell -NoProfile -File scripts/run-host.ps1
```

单元测试不需要 DSH。原生测试用全新 Profile、合成模型/Skills，经两个进程验证配置、权限拒绝、依赖/Scope 失败、并发、真实 Spawn 与冷恢复；不读真实 QQ、记忆或凭据。临时文件全部在忽略的 `.local/`。

当前源码 **0.1.0-test.2**；部署状态和验收边界见 [STATUS](STATUS.md)。已验证原生 Host 的配置、Profile 替换与重启、Skill 分配/版本、合并基线、失败回退和 Worker 实际工具执行。Web 在 DSH 原生设置中实际点击验收搜索、配置表单、错误提示、添加/排序/停用/移除、Skill 分配与启停；不是用资源加载成功替代 GUI。Desktop RPC 协议通过，实际桌面窗口及 HMR 视觉效果仍未验证。Windows 上游有一项文件符号链接测试默认跳过，跨平台 CI 保留。

动态 Provider 激活后才能由原生 Registry 枚举；不会为了发现 Skills 自动执行未引用 Provider，也不扫描整个磁盘。无元信息的导出显示为候选，名称不证明其是插件；没有 Config 的模块无 Schema，仍需装配验证。

[接口和回滚说明](INTEGRATION.md) · [原版英文文档](README.upstream.md) · [原版中文文档](README.upstream.zh.md)
