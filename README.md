# dsh-preset-manager

在 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）Web 的设置里查看和管理 Agent 预设（模式）。

> 原型阶段：只在 dsh `0.2.1-alpha.3` 源码版本上验证过，依赖的 `configEditor`、`agentPresets` 都是尚未稳定的接口。

## 功能

设置 → **Preset manager** 页面：

- 列出所有预设，显示来源（内置 / 已覆盖 / 自定义 / 其他 bundle）、默认标记和诊断信息
- 展开插件列表，查看每一行的声明状态和实际挂载状态，并逐行开关
- 查看预设的 YAML
- 把被修改过的内置预设恢复为内置定义
- 从现有预设复制出自定义预设，也可以删除自定义预设

修改写入当前 profile 的 `cordis.patch.yml`。正在运行的会话保持原有配置，之后新建的会话使用新配置。

## 工作方式

| 文件 | 作用 |
|---|---|
| `index.js` | 宿主端插件，提供 `POST /api/preset-manager`（`list` / `read` / `toggle` / `reset` / `create` / `remove`）。修改内置预设时，通过 `configEditor.edit()` 在 profile 里写入该预设行的覆盖 |
| `container.js` | 自定义预设容器，配置里保存 `presets` 列表，并对每一项调用 `agentPresets.register()` |
| `client.js` | Web 端设置页 |
| `cordis.patch.yml` | 插入上面两个宿主端插件行 |

## 安装

```bash
dsh plugin --profile web add /path/to/dsh-preset-manager
```

然后启动 `dsh web`，打开 设置 → Preset manager。

## 已知限制

- 覆盖内置预设时会复制完整的插件列表，内置预设之后的更新不会自动合并
- 删除仍被会话使用的自定义预设后，该会话重启时无法恢复
- 带 `!!js` 条件的行（例如 `tool-bash`）不能在界面里开关，只能改 YAML
- 写操作只依赖 dsh 自带的登录校验，没有额外确认
- 内置预设显示的是 id，没有本地化名称
