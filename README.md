# dsh-preset-manager

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）Web 的设置里查看和管理 Agent 预设（模式）。

> 原型阶段：只在 dsh `0.2.1-alpha.3` 源码版本上验证过，依赖的 `configEditor`、`agentPresets` 都是尚未稳定的接口。

## 功能

设置 → **预设管理**（Preset manager）页面：

- 每个模式一张卡片：本地化的名称和描述、默认 / 内置 / 自定义标记、已修改项数、正在使用它的会话数、已启用插件数
- 展开后按分组（基础能力、规划模式、上下文压缩、子代理与工作流……）列出插件，显示插件自己的中文名称、说明和图标，逐行开关
- 修改过的插件标为「已修改」，可以单独还原；整个模式也可以一键恢复内置配置
- 搜索插件或模式，或者只看改动过的插件
- 用某个模式直接新建会话，或把它设为新会话的默认模式
- 复制任意模式作为自定义模式：根据名称自动生成 ID，并实时校验格式和重复；自定义模式可以修改名称、描述，也可以删除
- 删除和恢复内置都会先在页面内二次确认；删除时会提示还有多少个打开的会话在用
- 保存时只锁住正在修改的那一行，完成后在卡片上提示；失败原因显示在对应的卡片里

修改写入当前 profile 的 `cordis.patch.yml`。正在运行的会话保持原有配置，之后新建的会话使用新配置。界面支持中文和英文，跟随 dsh 的语言设置。

## 工作方式

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主端插件，提供 `POST /api/preset-manager`，动作包括 `list`、`read`、`toggle`、`resetRow`、`reset`、`create`、`update`、`remove`、`setDefault`。修改内置预设时，通过 `configEditor.edit()` 在 profile 里写入该预设行的覆盖；插件的显示信息来自 `pluginInventory.list()` |
| `container.js` | 自定义预设容器，配置里保存 `presets` 列表，并对每一项调用 `agentPresets.register()` |
| `client.js` | Web 端设置页 |
| `cordis.patch.yml` | 插入上面两个宿主端插件行 |

## 安装

```bash
dsh plugin --profile web add /path/to/dsh-preset-manager
```

然后启动 `dsh web`，打开 设置 → 预设管理。

## 已知限制

- 覆盖内置预设时会复制完整的插件列表，内置预设之后的更新不会自动合并
- 「在用会话数」只统计当前已打开的会话；删除自定义模式后，用过它的会话重启时无法恢复
- 带 `!!js` 条件的行（例如 `tool-bash`）不能在界面里开关，只能改 YAML
- 写操作只依赖 dsh 自带的登录校验，没有额外权限确认
