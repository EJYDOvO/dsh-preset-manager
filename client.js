window.__ModuleLoader__.load({
  id: 'dsh-modes',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-modes'
    const ROUTE = '/api/dsh-modes'
    const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
    /** Copy keys the official Agent presets page registers for the four shipped presets. */
    const BUILT_IN_COPY = { standard: 'Standard', ptc: 'Ptc', minimal: 'Minimal', cordis: 'Cordis' }
    const NOTICE_MS = 4000
    const PROMPT_MAX_CHARS = 20000
    const TOOL_MAX_CHARS = 20000
    const DRAFT_PREFIX = 'dsh-modes:draft:'
    /** Error-map key for the create form, which belongs to no preset card yet. */
    const CREATE_ERROR = '\0create'
    const PERSONA_MODULE = '@deepseek-ai/dsh-persona'
    /** The prompt registry's reference syntax; the Host repeats this check before saving. */
    const VARIABLE_GROUP = /^\{\{([^{}]*)\}\}/
    const VARIABLE_NAME = /^[a-z][a-z0-9_]*$/

    const ZH = {
      nav: '模式管理',
      title: '模式管理',
      intro: '模式决定 Agent 能做什么、怎么说话。改动只影响之后新建的会话；开启了即时生效的模式，保存的提示词会立刻用到正在运行的会话。',
      refresh: '刷新',
      newPreset: '新建模式',
      loading: '加载中…',
      noMatch: '没有匹配的插件',
      'badge.default': '默认',
      'badge.custom': '自定义',
      'badge.external': '来自其他插件',
      'badge.broken': '无法使用',
      'action.try': '用它新建会话',
      'action.setDefault': '设为默认',
      'action.duplicate': '复制',
      'action.yaml': '查看配置（YAML）',
      'action.hideYaml': '收起配置',
      'action.copy': '复制内容',
      'action.copied': '已复制',
      'action.reset': '恢复内置',
      'action.rename': '编辑信息',
      'action.remove': '删除',
      'action.save': '保存',
      'action.cancel': '取消',
      'action.create': '创建',
      'action.restoreRow': '还原',
      'action.expand': '展开插件',
      'action.collapse': '收起插件',
      'row.changed': '已修改',
      'row.groupOff': '所在分组已关闭',
      'row.noId': '没有 id，不能单独开关',
      'group.core': '基础能力',
      'group.planning': '规划模式',
      'group.compaction': '上下文压缩',
      'group.delegation': '子代理与工作流',
      'group.persistent-shell': '持久终端',
      'create.title': '新建模式',
      'create.name': '名称',
      'create.namePlaceholder': '例如：只读调研',
      'create.id': 'ID',
      'create.idHint': '小写字母、数字或连字符，创建后不能修改',
      'create.idTaken': '这个 ID 已被使用',
      'create.idInvalid': 'ID 只能包含小写字母、数字或连字符',
      'create.description': '描述（可选）',
      'create.from': '以此为基础',
      'rename.title': '编辑模式信息',
      'confirm.remove': '删除「{name}」？',
      'confirm.reset': '把「{name}」恢复为内置配置？你的 {n} 处修改会被丢弃。',
      'confirm.inUse': '有 {n} 个打开的会话正在使用它，这些会话重启后将无法恢复。',
      'notice.saved': '已保存 · 之后新建的会话生效',
      'notice.created': '已创建 · 可以在下面调整它能做什么',
      'notice.default': '已设为新会话的默认模式',
      'notice.reset': '已恢复内置配置',
      'notice.updated': '已更新',
      'err.conditional-row': '这一项按运行平台自动开关，请在 YAML 中修改。',
      'err.is-default': '这是新会话的默认模式，请先把别的模式设为默认。',
      'err.exists': '这个 ID 已被使用。',
      'err.invalid-id': 'ID 只能包含小写字母、数字或连字符。',
      'err.broken': '这个模式当前无法使用，不能设为默认。',
      'err.network': '无法连接到 DSH 服务，请刷新页面后重试。',
      'err.prompt-unknown-variable': '提示词里的 {reference} 不是可用变量。可用变量：{variables}。',
      'err.prompt-malformed': '提示词里的 {reference} 格式不对：变量要写成完整的双花括号形式，名称用小写字母开头，例如 {{model}}。',
      'err.prompt-too-long': '提示词太长了，上限是 {max} 个字符。',
      'prompt.title': '系统提示词',
      'prompt.partial': '这段文字位于系统提示词的开头，后面还会追加工具说明、工作区规则等内容。',
      'prompt.complete': '这个模式只把这段文字作为完整的系统提示词，不会再追加工具说明等内容。',
      'prompt.none': '这个模式还没有人设提示词，保存后会在最前面添加一行。',
      'prompt.variables': '可用变量（点击插入）',
      'prompt.chars': '{n} 个字符',
      'prompt.preview': '预览完整系统提示词',
      'prompt.hidePreview': '收起预览',
      'prompt.previewNote': '根据已保存的配置生成，不含每一步注入的运行时上下文；{{变量}} 在会话中会替换成实际值。',
      'prompt.previewDirty': '预览已包含尚未保存的修改。',
      'prompt.restore': '恢复内置提示词',
      'prompt.shortcut': '⌘/Ctrl + Enter 保存 · Esc 收起并保留草稿',
      'notice.promptSaved': '提示词已保存 · 之后新建的会话生效',
      'notice.promptRestored': '已恢复内置提示词',
      'create.start': '起步方式',
      'create.copyName': '{name} 副本',
      'template.on': '{n} 个插件',
      'template.develop.name': '开发',
      'template.develop.desc': '和标准模式一样的完整工具：终端、文件读写、子代理、网页等。',
      'template.develop.suggest': '开发助手',
      'template.write.name': '写作',
      'template.write.desc': '能读写文件，没有终端；自带一段写作助手提示词。',
      'template.write.suggest': '写作助手',
      'template.chat.name': '聊天',
      'template.chat.desc': '只聊天和搜索网页，不碰文件和终端；回答简洁。',
      'template.chat.suggest': '聊天伙伴',
      'template.research.name': '只读调研',
      'template.research.desc': '能读代码、搜索和上网，但不能修改文件或运行命令。',
      'template.research.suggest': '只读调研',
      'template.copy.name': '复制现有模式',
      'template.copy.desc': '从任意模式复制完整配置，包括提示词。',
      'row.essential': '核心',
      'row.details': '详情',
      'row.hideDetails': '收起详情',
      'confirm.personaOff': '关闭「{title}」后，这个模式的提示词不会生效，模型只会看到 DSH 默认的身份说明。',
      'confirm.personaOffOk': '仍然关闭',
      'warn.personaOff': '身份行已关闭，这个模式的提示词没有生效。',
      'action.enablePersona': '重新启用',
      'badge.draft': '提示词草稿未保存',
      'detail.id': '行 id',
      'detail.module': '模块',
      'detail.group': '所在分组',
      'detail.builtIn': '内置状态',
      'detail.current': '当前设置',
      'detail.live': '实际加载',
      'detail.change': '修改情况',
      'detail.config': '配置',
      'detail.none': '（无）',
      'detail.noBuiltIn': '没有内置版本（自定义模式）',
      'state.on': '启用',
      'state.off': '关闭',
      'state.conditional': '按条件：{condition}',
      'live.on': '已加载',
      'live.off': '未加载',
      'live.unknown': '未知',
      'change.changed': '已修改（与内置不同）',
      'change.same': '与内置相同',
      'prompt.draftRestored': '已恢复上次未保存的草稿。',
      'prompt.draftStale': '这份草稿基于旧版本，保存时会提示冲突。',
      'prompt.discardDraft': '放弃草稿',
      'prompt.discard': '放弃修改',
      'prompt.import': '导入',
      'prompt.export': '导出',
      'prompt.imported': '已导入到编辑器，尚未保存。',
      'prompt.exported': '已导出为文件。',
      'prompt.importTooLarge': '文件太大，上限是 {max} 个字符。',
      'prompt.importFailed': '导入失败：{detail}',
      'prompt.conflictTitle': '保存被拒绝：这段提示词在你编辑期间被别处修改了。',
      'prompt.conflictLatest': '最新内容：',
      'prompt.loadLatest': '载入最新内容（放弃我的修改）',
      'prompt.overwrite': '用我的版本覆盖',
      'prompt.off': '身份行已关闭，这段提示词不会生效。',
      'badge.live': '即时生效',
      'action.sync': '同步内置更新',
      'sync.title': '把内置模式的最新变化合并进来，你的修改会保留。',
      'sync.origin': '这个模式基于「{name}」，会合并「{name}」内置版本的变化。',
      'sync.added': '新增 {n} 个插件：{names}',
      'sync.removed': '移除 {n} 个内置模式已删除的插件：{names}',
      'sync.updated': '{n} 个插件有官方更新：{names}',
      'sync.kept': '保留你的 {n} 处修改',
      'sync.conflicts': '{n} 项设置你和官方都改过，保留你的设置',
      'sync.confirm': '同步',
      'notice.synced': '已同步内置更新',
      'notice.savedSynced': '已保存，并同步了内置模式的更新',
      'err.up-to-date': '已经包含最新的内置配置。',
      'repair.title': '有 {n} 个插件无法加载，这个模式现在不能用：',
      'repair.hint': '关闭后这个模式就能正常使用；之后把对应插件装好，可以在插件列表里再打开。原因的完整内容见宿主日志。',
      'action.repair': '关闭这些插件',
      'notice.repaired': '已关闭无法加载的插件',
      'err.nothing-to-repair': '没有需要关闭的插件。',
      'row.failed': '加载失败',
      'row.platform': '自动',
      'row.platformNow': '自动（当前{state}）',
      'row.forceOn': '开',
      'row.forceOff': '关',
      'row.forced': '已固定，不再自动切换',
      'row.platformHint': '这一项原本按运行环境（例如操作系统）自动开关；固定为开或关后，就不再自动切换。',
      'err.no-condition': '找不到这个插件原本的自动开关条件。',
      'confirm.saved': '另有 {n} 个已保存的会话是用这个模式创建的，删除后再打开这些会话会失败。',
      'confirm.checking': '正在统计使用这个模式的会话…',
      'confirm.savedPartial': '另有至少 {n} 个已保存的会话使用这个模式（会话较多，没有全部统计完），删除后再打开这些会话会失败。',
      'prompt.advanced': '高级设置：结尾提示词、完整提示词、运行时上下文',
      'prompt.suffix': '结尾提示词',
      'prompt.suffixHint': '追加在工具说明、工作区规则等内容之后。留空会去掉这个模式原有的结尾。',
      'prompt.suffixIgnored': '已选择只用开头这段作为完整提示词，结尾提示词不会生效。',
      'prompt.completeLabel': '只用开头这段作为完整的系统提示词，不追加工具说明等内容',
      'prompt.runtimeLabel': '附带运行时上下文：当前时间、工作目录、权限等',
      'prompt.flagsNote': '这两项只对之后新建的会话生效，预览也不会反映它们的变化。',
      'prompt.liveLabel': '即时生效',
      'prompt.liveHint': '保存提示词后，正在运行的会话从下一步起就用新提示词。模型会收到一条新的系统提示，可能多消耗一些输入令牌。卸载本插件前请先关闭。',
      'prompt.toolLabel': '允许在对话里修改提示词',
      'prompt.toolHint': '模型可以调用 mode_prompt 工具读取或修改这个模式的提示词，每次保存前都会请你批准。卸载本插件前请先关闭。',
      'notice.liveOn': '已开启即时生效 · 对之后新建的会话生效',
      'notice.liveOff': '已关闭即时生效',
      'notice.toolOn': '已允许在对话里修改提示词 · 对之后新建的会话生效',
      'notice.toolOff': '已关闭对话里修改提示词',
      'notice.promptSavedLive': '提示词已保存 · 正在运行的会话从下一步起生效',
      'prompt.history': '历史版本',
      'prompt.hideHistory': '收起历史版本',
      'prompt.historyEmpty': '还没有历史版本。每次保存提示词都会自动记录，最多保留 30 个。',
      'prompt.historyLoad': '载入到编辑器',
      'prompt.historyCurrent': '与当前版本相同',
      'prompt.historyLoaded': '已载入历史版本，尚未保存。',
      'source.page': '设置页',
      'source.chat': '对话中',
      'source.restore': '恢复内置',
      'source.initial': '最初版本',
      'source.external': '在其他地方修改',
      stateError: '无法读取插件的状态文件：{detail}',
      'own.live.title': '身份（即时生效）',
      'own.live.desc': '由模式管理插件提供：每一步都读取这个模式最新保存的提示词。',
      'own.tool.title': '对话里修改提示词',
      'own.tool.desc': '由模式管理插件提供：mode_prompt 工具，保存前需要你批准。',
      'tab.capabilities': '能力',
      'tab.prompt': '提示词',
      'tab.plugins': '全部插件',
      'section.act': '能做的事',
      'section.work': '工作方式',
      'section.context': '上下文',
      'cap.intro': '打开一项能力会把它恢复成内置模式里的样子；关闭会关掉它包含的所有插件。',
      'cap.terminal.name': '运行命令',
      'cap.terminal.desc': '在终端里执行命令、运行脚本，并管理后台任务。',
      'cap.files.name': '文件',
      'cap.files.desc': '读取和搜索工作区里的文件。',
      'cap.web.name': '网页',
      'cap.web.desc': '搜索网页并读取页面内容。',
      'cap.delegation.name': '子代理与工作流',
      'cap.delegation.desc': '把任务交给子代理处理，或编写脚本编排多步工具操作。',
      'cap.extend.name': '扩展自身',
      'cap.extend.desc': '在插件市场里查找、安装和管理 DSH 插件，查询编写插件所需的接口。',
      'cap.planning.name': '计划模式',
      'cap.planning.desc': '先制定计划，经你审阅后再动手执行。',
      'cap.todo.name': '待办清单',
      'cap.todo.desc': '用待办清单跟踪多步骤任务的进度。',
      'cap.goals.name': '会话目标',
      'cap.goals.desc': '设置和跟踪当前会话的目标，也可以用 /goal 命令管理。',
      'cap.skills.name': '技能',
      'cap.skills.desc': '发现并按需加载本地的技能说明。',
      'cap.ask.name': '向你提问',
      'cap.ask.desc': '需要补充信息或做选择时向你提问。',
      'cap.present.name': '交付文件',
      'cap.present.desc': '把工作区里的文件标记为这一轮的交付内容。',
      'cap.schedule.name': '定时提醒',
      'cap.schedule.desc': '设置稍后提醒，到时间继续当前会话的任务。',
      'cap.instructions.name': '工作区指令',
      'cap.instructions.desc': '读取 AGENTS.md、CLAUDE.md 等文件里的项目规则。',
      'cap.time.name': '时间感知',
      'cap.time.desc': '每一步告诉模型当前时间、时区和距上一条消息过了多久。',
      'cap.compaction.name': '上下文压缩',
      'cap.compaction.desc': '对话太长时自动总结历史，并精简过长的工具输出；也可以用 /compact 命令手动压缩。',
      'cap.writes': '允许修改文件',
      'cap.writesDesc': '关闭后只能读取和搜索文件，不能创建、写入或编辑。',
      'cap.partial': '部分开启',
      'cap.partialHint': '这项能力里的插件只开了一部分，可以在「全部插件」里查看；打开开关会恢复成内置模式里的样子。',
      'cap.none': '这个模式没有可以在这里调整的能力，可以在「全部插件」里查看。',
      'cap.other': '另有 {n} 个插件不属于上面的能力。',
      'cap.showPlugins': '查看全部插件',
      'chip.label': '这个模式能做的事',
      'chip.terminal': '运行命令',
      'chip.files': '读写文件',
      'chip.filesReadOnly': '只读文件',
      'chip.web': '网页',
      'chip.delegation': '子代理',
      'chip.extend': '扩展自身',
      'meta.plugins': '{on}/{total} 个插件已启用',
      'meta.usage': '{n} 个会话在用',
      'meta.changed': '已改 {n} 项',
      'meta.live': '提示词即时生效',
      'meta.promptTool': '可在对话里改提示词',
      'action.more': '更多操作',
      'banner.sync': '内置模式有更新，同步后会保留你的修改。',
      'banner.draft': '这个模式有未保存的提示词草稿。',
      'action.openDraft': '继续编辑',
      'plugins.search': '搜索插件',
      'plugins.onlyChanged': '只看改动',
      'plugins.intro': '这里列出模式里的每一个插件，适合需要逐个调整的情况。',
      'prompt.behaviorTitle': '在对话中',
      'prompt.behaviorHint': '这两个开关立即保存，不需要点「保存」；它们对之后新建的会话生效。',
      'toast.line': '{name}：{text}',
      'action.dismiss': '关闭提示',
      'notice.removed': '已删除',
      'prompt.restoreConfirm': '把提示词恢复为内置版本？当前提示词会保留在历史版本里。',
      'prompt.restoreDirty': '编辑器里未保存的修改会被丢弃。',
      'view.modes': '模式',
      'view.tools': '工具描述',
      'meta.toolEdits': '{n} 项工具说明已改',
      'confirm.resetTools': '另有 {n} 项工具说明的修改也会恢复为内置原文。',
      'tools.intro': '改写发给模型的工具说明。工具的内置定义不会被修改，随时可以恢复原文。已改过说明的模式，保存后的修改在下一步对话就会生效；模式第一次被改写时，要新建会话才会生效。代码模式（PTC）暂不支持。',
      'tools.modes': '应用到这些模式',
      'tools.selectAll': '全选',
      'tools.selectNone': '全不选',
      'tools.modeEdited': '已改 {n} 项',
      'tools.modePtc': 'PTC 模式暂不支持',
      'tools.modeReadOnly': '来自其他插件，不能编辑',
      'tools.modeError': '读取工具失败：{error}',
      'tools.search': '搜索工具名或说明',
      'tools.loading': '正在读取各模式的工具…',
      'tools.empty': '没有匹配的工具',
      'tools.noModes': '没有可编辑的模式',
      'tools.scopeAll': '没有勾选模式，列表显示所有可编辑模式的工具。',
      'tools.edited': '已改 {n}/{total} 个模式',
      'tools.outdated': '内置说明已更新',
      'tools.draft': '未保存',
      'tools.text': '说明文字',
      'tools.chars': '{n} / {max} 字',
      'tools.differ': '所选模式目前使用的说明不同，这里显示的是「{name}」的。',
      'tools.builtIn': '内置原文',
      'tools.builtInFor': '{modes}',
      'tools.perMode': '各模式状态',
      'tools.stateEdited': '已修改',
      'tools.stateBuiltIn': '内置',
      'tools.stateOutdated': '已修改 · 内置已更新',
      'tools.restoreOne': '恢复原文',
      'tools.previous': '更早的版本',
      'tools.use': '使用',
      'tools.save': '保存到 {n} 个模式',
      'tools.saveAll': '保存全部（{tools} 个工具 × {modes} 个模式）',
      'tools.discard': '放弃修改',
      'tools.discardAll': '放弃全部修改',
      'tools.restoreSelected': '恢复这个工具的原文（所选模式）',
      'tools.restoreModes': '恢复所选模式的全部原文…',
      'tools.restoreAll': '恢复所有模式的全部原文…',
      'tools.dirty': '有 {n} 个工具的修改尚未保存',
      'tools.confirmTool': '把「{tool}」在 {n} 个模式里恢复为内置原文？',
      'tools.confirmModes': '把所选 {modes} 个模式里已改的 {n} 条说明恢复为内置原文？',
      'tools.confirmAll': '把所有模式里已改的 {n} 条说明恢复为内置原文？',
      'tools.nothingToRestore': '没有已改的说明',
      'tools.summary': '已保存 {saved} 条 · 恢复 {restored} 条 · 无变化 {unchanged} 条',
      'tools.summaryFailed': '有 {n} 条没有完成',
      'tools.failureLine': '{mode} · {tool}：{reason}',
      'tools.status.conflict': '已被别处修改，刷新后再试',
      'tools.status.ptc': 'PTC 模式暂不支持',
      'tools.status.not-editable': '这个模式不能编辑',
      'tools.status.unknown-tool': '这个模式没有这个工具',
      'tools.status.unknown-preset': '没有这个模式',
      'tools.status.invalid': '内容无效',
      'tools.status.error': '保存失败：{error}',
      'err.tool-text-empty': '说明不能为空；要还原请使用「恢复原文」',
      'err.tool-text-too-long': '说明不能超过 {max} 字',
      'err.tool-name-invalid': '工具名无效',
      'stateError.tools': '工具说明文件无法读取：{detail}',
    }
    const EN = {
      nav: 'Modes',
      title: 'Modes',
      intro: 'A mode decides what the agent can do and how it talks. Changes apply to sessions created afterwards; in a mode with live prompts, a saved prompt reaches running sessions right away.',
      refresh: 'Refresh',
      newPreset: 'New mode',
      loading: 'Loading…',
      noMatch: 'No matching plugins',
      'badge.default': 'Default',
      'badge.custom': 'Custom',
      'badge.external': 'From another plugin',
      'badge.broken': 'Unavailable',
      'action.try': 'New session with it',
      'action.setDefault': 'Make default',
      'action.duplicate': 'Duplicate',
      'action.yaml': 'View configuration (YAML)',
      'action.hideYaml': 'Hide configuration',
      'action.copy': 'Copy',
      'action.copied': 'Copied',
      'action.reset': 'Restore built-in',
      'action.rename': 'Edit details',
      'action.remove': 'Delete',
      'action.save': 'Save',
      'action.cancel': 'Cancel',
      'action.create': 'Create',
      'action.restoreRow': 'Restore',
      'action.expand': 'Show plugins',
      'action.collapse': 'Hide plugins',
      'row.changed': 'Changed',
      'row.groupOff': 'Its group is off',
      'row.noId': 'No id; cannot be switched alone',
      'group.core': 'Core',
      'group.planning': 'Plan mode',
      'group.compaction': 'Context compaction',
      'group.delegation': 'Subagents and workflows',
      'group.persistent-shell': 'Persistent terminal',
      'create.title': 'New mode',
      'create.name': 'Name',
      'create.namePlaceholder': 'e.g. Read-only research',
      'create.id': 'ID',
      'create.idHint': 'Lowercase letters, digits, or hyphens; fixed after creation',
      'create.idTaken': 'This ID is already used',
      'create.idInvalid': 'Use lowercase letters, digits, or hyphens',
      'create.description': 'Description (optional)',
      'create.from': 'Based on',
      'rename.title': 'Edit mode details',
      'confirm.remove': 'Delete "{name}"?',
      'confirm.reset': 'Restore "{name}" to its built-in configuration? Your {n} changes will be discarded.',
      'confirm.inUse': '{n} open sessions use it; they cannot be restored after a restart.',
      'notice.saved': 'Saved · applies to new sessions',
      'notice.created': 'Created · adjust what it can do below',
      'notice.default': 'Now the default for new sessions',
      'notice.reset': 'Built-in configuration restored',
      'notice.updated': 'Updated',
      'err.conditional-row': 'This plugin is switched by platform; edit it in YAML.',
      'err.is-default': 'This is the default for new sessions; make another mode the default first.',
      'err.exists': 'This ID is already used.',
      'err.invalid-id': 'Use lowercase letters, digits, or hyphens for the ID.',
      'err.broken': 'This mode cannot run right now, so it cannot be the default.',
      'err.network': 'Cannot reach the DSH service; reload the page and try again.',
      'err.prompt-unknown-variable': '{reference} is not an available variable. Available variables: {variables}.',
      'err.prompt-malformed': '{reference} is malformed: write a variable as a complete double-brace reference whose name starts with a lowercase letter, such as {{model}}.',
      'err.prompt-too-long': 'The prompt is too long; the limit is {max} characters.',
      'prompt.title': 'System prompt',
      'prompt.partial': 'This text opens the system prompt; tool guidance, workspace rules, and other sections follow it.',
      'prompt.complete': 'This mode uses only this text as its complete system prompt; nothing else is appended.',
      'prompt.none': 'This mode has no persona prompt yet; saving adds one as its first row.',
      'prompt.variables': 'Variables (click to insert)',
      'prompt.chars': '{n} characters',
      'prompt.preview': 'Preview full system prompt',
      'prompt.hidePreview': 'Hide preview',
      'prompt.previewNote': 'Built from the saved configuration, without the runtime context added at each step; {{variables}} become real values in a session.',
      'prompt.previewDirty': 'The preview includes unsaved edits.',
      'prompt.restore': 'Restore built-in prompt',
      'prompt.shortcut': '⌘/Ctrl + Enter saves · Esc closes and keeps the draft',
      'notice.promptSaved': 'Prompt saved · applies to new sessions',
      'notice.promptRestored': 'Built-in prompt restored',
      'create.start': 'Start from',
      'create.copyName': '{name} copy',
      'template.on': '{n} plugins',
      'template.develop.name': 'Develop',
      'template.develop.desc': 'The full Standard toolset: terminal, files, subagents, web, and more.',
      'template.develop.suggest': 'Developer',
      'template.write.name': 'Write',
      'template.write.desc': 'Reads and writes files with no terminal, plus a writing-assistant prompt.',
      'template.write.suggest': 'Writer',
      'template.chat.name': 'Chat',
      'template.chat.desc': 'Conversation and web search only, without files or terminal; answers stay short.',
      'template.chat.suggest': 'Chat partner',
      'template.research.name': 'Read-only research',
      'template.research.desc': 'Reads code, searches, and browses, but cannot change files or run commands.',
      'template.research.suggest': 'Read-only research',
      'template.copy.name': 'Copy a mode',
      'template.copy.desc': 'Copy any mode\'s full configuration, prompt included.',
      'row.essential': 'Core',
      'row.details': 'Details',
      'row.hideDetails': 'Hide details',
      'confirm.personaOff': 'With "{title}" off, this mode\'s prompt no longer applies; the model sees only DSH\'s default identity.',
      'confirm.personaOffOk': 'Turn off anyway',
      'warn.personaOff': 'The persona row is off, so this mode\'s prompt is not applied.',
      'action.enablePersona': 'Turn back on',
      'badge.draft': 'Unsaved prompt draft',
      'detail.id': 'Row id',
      'detail.module': 'Module',
      'detail.group': 'Group',
      'detail.builtIn': 'Built-in state',
      'detail.current': 'Current setting',
      'detail.live': 'Loaded',
      'detail.change': 'Changes',
      'detail.config': 'Configuration',
      'detail.none': '(none)',
      'detail.noBuiltIn': 'No built-in version (custom mode)',
      'state.on': 'On',
      'state.off': 'Off',
      'state.conditional': 'Conditional: {condition}',
      'live.on': 'Loaded',
      'live.off': 'Not loaded',
      'live.unknown': 'Unknown',
      'change.changed': 'Changed from built-in',
      'change.same': 'Same as built-in',
      'prompt.draftRestored': 'Restored your unsaved draft.',
      'prompt.draftStale': 'This draft started from an older version; saving will report a conflict.',
      'prompt.discardDraft': 'Discard draft',
      'prompt.discard': 'Discard changes',
      'prompt.import': 'Import',
      'prompt.export': 'Export',
      'prompt.imported': 'Imported into the editor; not saved yet.',
      'prompt.exported': 'Exported to a file.',
      'prompt.importTooLarge': 'The file is too large; the limit is {max} characters.',
      'prompt.importFailed': 'Import failed: {detail}',
      'prompt.conflictTitle': 'Not saved: this prompt was changed elsewhere while you were editing.',
      'prompt.conflictLatest': 'Latest version:',
      'prompt.loadLatest': 'Load the latest (discard my edits)',
      'prompt.overwrite': 'Overwrite with my version',
      'prompt.off': 'The persona row is off, so this prompt is not applied.',
      'badge.live': 'Live prompt',
      'action.sync': 'Sync built-in update',
      'sync.title': 'Merge the latest built-in changes into this mode; your changes are kept.',
      'sync.origin': 'This mode is based on "{name}" and takes the changes of its built-in version.',
      'sync.added': '{n} new plugins: {names}',
      'sync.removed': '{n} plugins the built-in mode dropped are removed: {names}',
      'sync.updated': '{n} plugins changed upstream: {names}',
      'sync.kept': 'Your {n} changes are kept',
      'sync.conflicts': '{n} settings changed on both sides keep your value',
      'sync.confirm': 'Sync',
      'notice.synced': 'Built-in update merged',
      'notice.savedSynced': 'Saved, and merged the built-in update',
      'err.up-to-date': 'This mode already includes the latest built-in configuration.',
      'repair.title': '{n} plugins cannot load, so this mode cannot run:',
      'repair.hint': 'Turning them off makes the mode usable again; once the plugins are installed, switch them back on in the plugin list. The Host log has the full reasons.',
      'action.repair': 'Turn these plugins off',
      'notice.repaired': 'Turned off the plugins that could not load',
      'err.nothing-to-repair': 'No plugins need to be turned off.',
      'row.failed': 'Failed to load',
      'row.platform': 'Auto',
      'row.platformNow': 'Auto (now {state})',
      'row.forceOn': 'On',
      'row.forceOff': 'Off',
      'row.forced': 'Fixed; no longer switches automatically',
      'row.platformHint': 'This plugin normally switches on or off by environment (for example the operating system); fixed on or off, it stops switching.',
      'err.no-condition': 'The plugin\'s original automatic condition is not known.',
      'confirm.saved': '{n} more saved sessions were created with this mode; they will fail to open after it is deleted.',
      'confirm.checking': 'Counting the sessions that use this mode…',
      'confirm.savedPartial': 'At least {n} more saved sessions use this mode (not every session was counted); they will fail to open after it is deleted.',
      'prompt.advanced': 'Advanced: closing prompt, complete prompt, runtime context',
      'prompt.suffix': 'Closing prompt',
      'prompt.suffixHint': 'Added after tool guidance, workspace rules, and other sections. Leave it empty to drop this mode\'s closing text.',
      'prompt.suffixIgnored': 'The opening text is the complete prompt, so the closing prompt is not used.',
      'prompt.completeLabel': 'Use only the opening text as the complete system prompt, without tool guidance or other sections',
      'prompt.runtimeLabel': 'Include runtime context: current time, working directory, permissions, and more',
      'prompt.flagsNote': 'These two settings apply to sessions created afterwards, and the preview does not reflect them.',
      'prompt.liveLabel': 'Live prompt',
      'prompt.liveHint': 'After a save, running sessions use the new prompt from their next step. The model receives a new system message, which can cost some extra input tokens. Turn it off before uninstalling this plugin.',
      'prompt.toolLabel': 'Allow prompt changes in chat',
      'prompt.toolHint': 'The model can call the mode_prompt tool to read or change this mode\'s prompt, and asks you before every save. Turn it off before uninstalling this plugin.',
      'notice.liveOn': 'Live prompt on · applies to new sessions',
      'notice.liveOff': 'Live prompt off',
      'notice.toolOn': 'Prompt changes in chat allowed · applies to new sessions',
      'notice.toolOff': 'Prompt changes in chat turned off',
      'notice.promptSavedLive': 'Prompt saved · running sessions use it from their next step',
      'prompt.history': 'History',
      'prompt.hideHistory': 'Hide history',
      'prompt.historyEmpty': 'No history yet. Every prompt save is recorded; the latest 30 are kept.',
      'prompt.historyLoad': 'Load into editor',
      'prompt.historyCurrent': 'Same as current',
      'prompt.historyLoaded': 'Loaded a past version; not saved yet.',
      'source.page': 'Settings',
      'source.chat': 'In chat',
      'source.restore': 'Built-in restored',
      'source.initial': 'Original',
      'source.external': 'Changed elsewhere',
      stateError: 'Cannot read the plugin\'s state file: {detail}',
      'own.live.title': 'Persona (live)',
      'own.live.desc': 'From the Modes plugin: reads this mode\'s latest saved prompt at every step.',
      'own.tool.title': 'Prompt changes in chat',
      'own.tool.desc': 'From the Modes plugin: the mode_prompt tool, which asks you before each save.',
      'tab.capabilities': 'Capabilities',
      'tab.prompt': 'Prompt',
      'tab.plugins': 'All plugins',
      'section.act': 'What it can do',
      'section.work': 'How it works',
      'section.context': 'Context',
      'cap.intro': 'Turning a capability on restores it as the built-in mode has it; turning it off switches off every plugin it includes.',
      'cap.terminal.name': 'Run commands',
      'cap.terminal.desc': 'Runs commands and scripts in a terminal and manages background jobs.',
      'cap.files.name': 'Files',
      'cap.files.desc': 'Reads and searches files in the workspace.',
      'cap.web.name': 'Web',
      'cap.web.desc': 'Searches the web and reads pages.',
      'cap.delegation.name': 'Subagents and workflows',
      'cap.delegation.desc': 'Hands tasks to subagents, or writes scripts that orchestrate several tool calls.',
      'cap.extend.name': 'Extend itself',
      'cap.extend.desc': 'Finds plugins in the plugin market, installs and manages them, and looks up the APIs for writing them.',
      'cap.planning.name': 'Plan mode',
      'cap.planning.desc': 'Plans first and starts working after you review the plan.',
      'cap.todo.name': 'To-do list',
      'cap.todo.desc': 'Tracks multi-step tasks with a to-do list.',
      'cap.goals.name': 'Session goals',
      'cap.goals.desc': 'Sets and tracks the session goal; you can also manage it with /goal.',
      'cap.skills.name': 'Skills',
      'cap.skills.desc': 'Finds local skills and loads their instructions when needed.',
      'cap.ask.name': 'Ask you',
      'cap.ask.desc': 'Asks you when it needs information or a choice.',
      'cap.present.name': 'Deliverables',
      'cap.present.desc': 'Marks workspace files as this turn\'s deliverables.',
      'cap.schedule.name': 'Reminders',
      'cap.schedule.desc': 'Sets reminders that bring it back to the session later.',
      'cap.instructions.name': 'Workspace instructions',
      'cap.instructions.desc': 'Reads project rules from AGENTS.md, CLAUDE.md, and similar files.',
      'cap.time.name': 'Time awareness',
      'cap.time.desc': 'Tells the model the current time, time zone, and time since the last message at every step.',
      'cap.compaction.name': 'Context compaction',
      'cap.compaction.desc': 'Summarizes long conversations and trims long tool output; you can also compact with /compact.',
      'cap.writes': 'Allow file changes',
      'cap.writesDesc': 'When off, it can only read and search files, not create, write, or edit them.',
      'cap.partial': 'Partly on',
      'cap.partialHint': 'Only some of this capability\'s plugins are on; see All plugins. Turning it on restores it as the built-in mode has it.',
      'cap.none': 'This mode has no capabilities to adjust here; see All plugins.',
      'cap.other': 'Plugins outside these capabilities: {n}.',
      'cap.showPlugins': 'See all plugins',
      'chip.label': 'What this mode can do',
      'chip.terminal': 'Commands',
      'chip.files': 'Files',
      'chip.filesReadOnly': 'Files (read-only)',
      'chip.web': 'Web',
      'chip.delegation': 'Subagents',
      'chip.extend': 'Extends itself',
      'meta.plugins': '{on}/{total} plugins on',
      'meta.usage': 'Open sessions: {n}',
      'meta.changed': '{n} changed',
      'meta.live': 'Live prompt',
      'meta.promptTool': 'Prompt editable in chat',
      'action.more': 'More actions',
      'banner.sync': 'The built-in mode was updated; syncing keeps your changes.',
      'banner.draft': 'This mode has an unsaved prompt draft.',
      'action.openDraft': 'Keep editing',
      'plugins.search': 'Search plugins',
      'plugins.onlyChanged': 'Changed only',
      'plugins.intro': 'Every plugin in this mode, for when you need to adjust them one by one.',
      'prompt.behaviorTitle': 'In chat',
      'prompt.behaviorHint': 'These switches save at once, without Save; they apply to sessions created afterwards.',
      'toast.line': '{name}: {text}',
      'action.dismiss': 'Dismiss',
      'notice.removed': 'Deleted',
      'prompt.restoreConfirm': 'Restore the built-in prompt? The current prompt stays in the history.',
      'prompt.restoreDirty': 'Unsaved edits in the editor are discarded.',
      'view.modes': 'Modes',
      'view.tools': 'Tool descriptions',
      'meta.toolEdits': 'Tool descriptions edited: {n}',
      'confirm.resetTools': 'Edited tool descriptions ({n}) are restored to their built-in text as well.',
      'tools.intro': 'Rewrite the tool descriptions sent to the model. The built-in tool definitions are never changed, so you can always restore the original text. In a mode that already has edits, a save reaches running sessions on their next step; the first edit of a mode reaches new sessions only. Code mode (PTC) is not supported yet.',
      'tools.modes': 'Apply to these modes',
      'tools.selectAll': 'Select all',
      'tools.selectNone': 'Select none',
      'tools.modeEdited': '{n} edited',
      'tools.modePtc': 'PTC mode is not supported yet',
      'tools.modeReadOnly': 'Declared by another plugin; cannot be edited',
      'tools.modeError': 'Could not read its tools: {error}',
      'tools.search': 'Search tool names or descriptions',
      'tools.loading': 'Reading the tools of every mode…',
      'tools.empty': 'No matching tools',
      'tools.noModes': 'No mode can be edited',
      'tools.scopeAll': 'No mode is ticked, so the list shows the tools of every editable mode.',
      'tools.edited': 'Edited: {n}/{total} modes',
      'tools.outdated': 'Built-in text changed',
      'tools.draft': 'Unsaved',
      'tools.text': 'Description',
      'tools.chars': '{n} / {max} characters',
      'tools.differ': 'The selected modes currently use different texts; this shows the one of "{name}".',
      'tools.builtIn': 'Built-in text',
      'tools.builtInFor': '{modes}',
      'tools.perMode': 'State per mode',
      'tools.stateEdited': 'Edited',
      'tools.stateBuiltIn': 'Built-in',
      'tools.stateOutdated': 'Edited · built-in text changed',
      'tools.restoreOne': 'Restore original',
      'tools.previous': 'Earlier versions',
      'tools.use': 'Use',
      'tools.save': 'Save to ticked modes ({n})',
      'tools.saveAll': 'Save all (tools: {tools}, modes: {modes})',
      'tools.discard': 'Discard changes',
      'tools.discardAll': 'Discard all changes',
      'tools.restoreSelected': 'Restore original (selected modes)',
      'tools.restoreModes': 'Restore everything in the selected modes…',
      'tools.restoreAll': 'Restore everything in all modes…',
      'tools.dirty': 'Unsaved changes: {n}',
      'tools.confirmTool': 'Restore the built-in text of "{tool}" in the chosen modes ({n})?',
      'tools.confirmModes': 'Restore the built-in text of {n} edited descriptions in the ticked modes ({modes})?',
      'tools.confirmAll': 'Restore the built-in text of all edited descriptions ({n}) in every mode?',
      'tools.nothingToRestore': 'No edited descriptions',
      'tools.summary': 'Saved {saved} · restored {restored} · unchanged {unchanged}',
      'tools.summaryFailed': '{n} did not complete',
      'tools.failureLine': '{mode} · {tool}: {reason}',
      'tools.status.conflict': 'Changed elsewhere; refresh and try again',
      'tools.status.ptc': 'PTC mode is not supported yet',
      'tools.status.not-editable': 'This mode cannot be edited',
      'tools.status.unknown-tool': 'This mode has no such tool',
      'tools.status.unknown-preset': 'No such mode',
      'tools.status.invalid': 'Invalid text',
      'tools.status.error': 'Could not save: {error}',
      'err.tool-text-empty': 'The description cannot be empty; use "Restore original" to go back to the built-in text',
      'err.tool-text-too-long': 'The description cannot exceed {max} characters',
      'err.tool-name-invalid': 'Invalid tool name',
      'stateError.tools': 'The tool descriptions file cannot be read: {detail}',
    }

    const CSS = `
.pm { container-type: inline-size; display: flex; flex-direction: column; gap: 14px; max-width: 760px; color: var(--dsw-alias-label-primary); font-size: 13px; }
.pm h3 { margin: 0; font-size: 18px; font-weight: 600; }
.pm-intro { margin: 0; color: var(--dsw-alias-label-tertiary); }
.pm-muted { color: var(--dsw-alias-label-tertiary); }
.pm-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-grow { flex: 1 1 auto; }
.pm-end { justify-content: flex-end; }
.pm-toast { position: sticky; bottom: 12px; z-index: 30; align-self: center; box-sizing: border-box; max-width: 100%; display: flex; gap: 10px; align-items: center; padding: 8px 8px 8px 14px; border-radius: 10px; border: .5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-1); box-shadow: 0 6px 24px rgba(0, 0, 0, .18); color: var(--dsw-alias-state-success-primary); font-size: 12px; line-height: 1.5; }
.pm-toast.is-error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.pm-toast-close { flex: none; width: 24px; height: 24px; border: 0; border-radius: 6px; background: none; color: var(--dsw-alias-label-tertiary); font-size: 16px; line-height: 1; cursor: pointer; }
.pm-toast-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.pm-input { box-sizing: border-box; min-width: 0; font: inherit; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-1); color: inherit; }
.pm-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.pm-search { flex: 1 1 220px; }
.pm-btn { font: inherit; font-size: 12px; padding: 4px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: inherit; cursor: pointer; white-space: nowrap; }
.pm-btn:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
.pm-btn:disabled { opacity: .5; cursor: default; }
.pm-btn:focus-visible, .pm-switch:focus-visible, .pm-head:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.pm-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); }
.pm-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.pm-danger { color: var(--dsw-alias-state-error-primary); }
.pm-link { font: inherit; font-size: 12px; padding: 0; border: 0; background: none; color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.pm-check { display: inline-flex; gap: 6px; align-items: center; color: var(--dsw-alias-label-secondary); cursor: pointer; user-select: none; }
.pm-card { border: .5px solid var(--dsw-alias-settings-card-stroke); border-radius: 12px; background: var(--dsw-alias-settings-card-fill); transition: border-color .16s; }
.pm-card.is-default { border-color: var(--dsw-static-neutral-bluish-400); }
.pm-card.is-broken { border-color: var(--dsw-alias-state-error-primary); }
.pm-card.is-flash { border-color: var(--dsw-alias-state-success-primary); }
.pm-head { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; cursor: pointer; border-radius: 12px; }
.pm-chevron { flex: none; width: 16px; margin-top: 2px; color: var(--dsw-alias-label-tertiary); transition: transform .15s; }
.pm-chevron.is-open { transform: rotate(90deg); }
.pm-headmain { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.pm-name { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pm-name strong { font-size: 14px; }
.pm-code { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.pm-badge { font-size: 11px; line-height: 17px; padding: 0 8px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l3); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.pm-badge.is-accent { border-color: var(--dsw-static-neutral-bluish-400); color: var(--dsw-alias-state-business-primary); }
.pm-badge.is-warn { border-color: var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); }
.pm-badge.is-error { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.pm-desc { color: var(--dsw-alias-label-secondary); line-height: 1.5; }
.pm-notice { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.pm-error { color: var(--dsw-alias-state-error-primary); white-space: pre-wrap; line-height: 1.5; }
.pm-body { border-top: .5px solid var(--dsw-alias-border-l3); padding: 6px 14px 12px 40px; display: flex; flex-direction: column; }
.pm-group { margin: 12px 0 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.pm-rowwrap { border-top: .5px solid var(--dsw-alias-border-l4); }
.pm-group + .pm-rowwrap { border-top: 0; }
.pm-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; }
.pm-icon { flex: none; width: 28px; height: 28px; border-radius: 7px; object-fit: contain; background: var(--dsw-alias-bg-layer-3); display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.pm-rowmain { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pm-rowtitle { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pm-rowdesc { color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pm-switch { position: relative; flex: none; box-sizing: border-box; width: 36px; height: 20px; margin-top: 4px; padding: 2px; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3); cursor: pointer; }
.pm-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.pm-switch:disabled { cursor: default; opacity: .45; }
.pm-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-switch-thumb); transition: transform .12s ease; }
.pm-switch[aria-checked='true'] .pm-thumb { background: var(--dsw-alias-label-primary-foreground); transform: translateX(16px); }
.pm-switch.is-pending .pm-thumb { animation: pm-pulse .8s ease-in-out infinite alternate; }
@keyframes pm-pulse { from { opacity: 1 } to { opacity: .35 } }
.pm-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; padding: 14px; }
.pm-form label { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.pm-form .is-wide { grid-column: 1 / -1; }
.pm-form .pm-bar { grid-column: 1 / -1; justify-content: flex-end; }
.pm-hint { font-size: 11px; color: var(--dsw-alias-label-tertiary); }
.pm-hint.is-error { color: var(--dsw-alias-state-error-primary); }
.pm-confirm { margin: 0 14px 12px 40px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); display: flex; flex-direction: column; gap: 8px; }
.pm-yaml { position: relative; margin: 0 14px 12px 40px; }
.pm-yaml pre { margin: 0; max-height: 360px; overflow: auto; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); font-size: 12px; line-height: 1.5; }
.pm-yaml .pm-btn { position: absolute; top: 8px; right: 8px; background: var(--dsw-alias-bg-layer-2); }
.pm-prompt { margin: 0 14px 12px 40px; display: flex; flex-direction: column; gap: 8px; }
.pm-textarea { width: 100%; min-height: 140px; resize: vertical; font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.6; }
.pm-textarea[aria-invalid='true'] { border-color: var(--dsw-alias-state-error-primary); }
.pm-chip { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.pm-chip:hover { background: var(--dsw-alias-interactive-bg-hover); }
.pm-prompt .pm-yaml { margin: 0; }
.pm-body .pm-prompt { margin: 4px 0 0; padding-left: 0; }
.pm-prompt pre { white-space: pre-wrap; overflow-wrap: anywhere; }
.pm-tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
.pm-tpl { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.pm-tpl:hover { background: var(--dsw-alias-interactive-bg-hover); }
.pm-tpl[aria-checked='true'] { border-color: var(--dsw-static-neutral-bluish-400); background: var(--dsw-alias-bg-module-platform); }
.pm-tpl:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.pm-tpl strong { font-size: 13px; }
.pm-tpl span { font-size: 12px; line-height: 1.45; color: var(--dsw-alias-label-secondary); }
.pm-tpl .pm-hint { color: var(--dsw-alias-label-tertiary); }
.pm-warn { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-state-warn-primary); font-size: 12px; line-height: 1.5; }
.pm-warn .pm-btn { color: var(--dsw-alias-label-primary); }
.pm-inline { margin: 0 0 8px 38px; }
.pm-cardwarn { margin: 0 14px 10px 40px; }
.pm-details { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 12px; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); font-size: 12px; }
.pm-details dt { color: var(--dsw-alias-label-tertiary); }
.pm-details dd { margin: 0; overflow-wrap: anywhere; }
.pm-details pre { margin: 0; max-height: 200px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; }
.pm-conflict { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--dsw-alias-state-warn-primary); }
.pm-conflict pre { margin: 0; max-height: 140px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.pm-file { display: none; }
.pm-seg { flex: none; display: inline-flex; margin-top: 2px; border: 1px solid var(--dsw-alias-border-l3); border-radius: 8px; overflow: hidden; }
.pm-seg button { font: inherit; font-size: 11px; padding: 3px 8px; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; white-space: nowrap; }
.pm-seg button + button { border-left: 1px solid var(--dsw-alias-border-l3); }
.pm-seg button[aria-checked='true'] { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-primary); font-weight: 600; }
.pm-seg button:disabled { cursor: default; opacity: .5; }
.pm-seg button:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
.pm-panel { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); }
.pm-panel ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
.pm-option { display: flex; gap: 8px; align-items: flex-start; color: var(--dsw-alias-label-primary); cursor: pointer; line-height: 1.5; }
.pm-option input { margin-top: 3px; }
.pm-history { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow: auto; }
.pm-history-item { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l4); }
.pm-history-item pre { margin: 0; max-height: 72px; overflow: hidden; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.pm-top { display: flex; align-items: flex-start; border-radius: 12px; }
.pm-top:hover { background: var(--dsw-alias-interactive-bg-hover); }
.pm-top .pm-head { flex: 1 1 auto; min-width: 0; }
.pm-topactions { flex: none; display: flex; gap: 6px; align-items: center; padding: 12px 14px 0 0; }
.pm-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.pm-cchip { font-size: 11px; line-height: 18px; padding: 0 7px; border-radius: 6px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.pm-meta { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.pm-info { color: var(--dsw-alias-label-secondary); }
.pm-tabs { display: flex; gap: 2px; margin: 4px 0 6px; border-bottom: .5px solid var(--dsw-alias-border-l3); }
.pm-tab { position: relative; font: inherit; font-size: 13px; padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; margin-bottom: -.5px; background: none; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.pm-tab:hover { color: var(--dsw-alias-label-primary); }
.pm-tab[aria-selected='true'] { color: var(--dsw-alias-label-primary); font-weight: 600; border-bottom-color: var(--dsw-alias-brand-primary); }
.pm-tab:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
.pm-dot { display: inline-block; width: 6px; height: 6px; margin-left: 5px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary); vertical-align: middle; }
.pm-caps { display: flex; flex-direction: column; gap: 2px; padding-top: 4px; }
.pm-capsection + .pm-capsection { margin-top: 6px; }
.pm-cap { border-top: .5px solid var(--dsw-alias-border-l4); }
.pm-group + .pm-cap { border-top: 0; }
.pm-capline { display: flex; gap: 12px; align-items: flex-start; padding: 9px 0; }
.pm-capsub { margin-left: 18px; padding-top: 0; }
.pm-capline .pm-rowdesc { -webkit-line-clamp: 3; }
.pm-menu { position: relative; }
.pm-menu-list { position: absolute; right: 0; top: calc(100% + 4px); z-index: 20; min-width: 168px; display: flex; flex-direction: column; padding: 4px; border-radius: 10px; border: .5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-1); box-shadow: 0 6px 24px rgba(0, 0, 0, .18); }
.pm-menu-list.is-up { top: auto; bottom: calc(100% + 4px); }
.pm-menu-list button { font: inherit; font-size: 13px; text-align: left; padding: 7px 10px; border: 0; border-radius: 6px; background: none; color: inherit; cursor: pointer; white-space: nowrap; }
.pm-menu-list button:hover:not(:disabled), .pm-menu-list button:focus-visible { background: var(--dsw-alias-interactive-bg-hover); outline: none; }
.pm-menu-list button:disabled { opacity: .5; cursor: default; }
.pm-menu-list .pm-danger { color: var(--dsw-alias-state-error-primary); }
.pm-behavior { display: flex; flex-direction: column; margin-top: 6px; padding-top: 4px; border-top: .5px solid var(--dsw-alias-border-l3); }
.pm-behavior .pm-capline + .pm-capline { border-top: .5px solid var(--dsw-alias-border-l4); }
.pm-views { margin: 0; }
.pm-tools { display: flex; flex-direction: column; gap: 10px; }
.pm-toolrow { border: .5px solid var(--dsw-alias-settings-card-stroke); border-radius: 10px; background: var(--dsw-alias-settings-card-fill); }
.pm-toolrow.is-dirty { border-color: var(--dsw-alias-state-warn-primary); }
.pm-toolhead { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; width: 100%; box-sizing: border-box; padding: 9px 12px; font: inherit; text-align: left; border: 0; border-radius: 10px; background: none; color: inherit; cursor: pointer; }
.pm-toolhead:hover { background: var(--dsw-alias-interactive-bg-hover); }
.pm-toolhead:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }
.pm-toolname { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px; font-weight: 600; }
.pm-toolbody { display: flex; flex-direction: column; gap: 10px; padding: 4px 12px 12px; }
.pm-modelist { display: flex; flex-wrap: wrap; gap: 4px 16px; }
.pm-modelist .pm-option { align-items: center; }
.pm-modelist .pm-option.is-off { color: var(--dsw-alias-label-tertiary); cursor: default; }
.pm-statelist { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.pm-statelist li { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-pre { margin: 0; max-height: 160px; overflow: auto; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; line-height: 1.5; }
.pm-dirtybar { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--dsw-alias-state-warn-primary); background: var(--dsw-alias-bg-layer-2); }
@container (max-width: 520px) {
  .pm-body, .pm-confirm, .pm-yaml, .pm-prompt { margin-left: 0; padding-left: 14px; }
  .pm-inline { margin-left: 0; }
  .pm-cardwarn { margin-left: 14px; }
  .pm-yaml { margin: 0 14px 12px; }
  .pm-form { grid-template-columns: minmax(0, 1fr); }
  .pm-top { flex-wrap: wrap; }
  .pm-topactions { box-sizing: border-box; width: 100%; padding: 0 14px 10px 40px; }
}
`

    class ActionFailure extends Error {
      constructor(code, message, details) {
        super(message)
        this.code = code
        this.details = details
      }
    }

    /**
     * The first reference the prompt registry would refuse to render.
     * @param {string} text - persona prefix template.
     * @param {string[] | undefined} variables - registered names, or undefined when unknown.
     * @returns {{code: string, reference: string, variables?: string[]} | undefined} the refusal.
     */
    function templateProblem(text, variables) {
      let last = 0
      for (let open = text.indexOf('{{'); open >= 0; open = text.indexOf('{{', last)) {
        const group = VARIABLE_GROUP.exec(text.slice(open))
        if (group === null) {
          if (text.indexOf('}}', open + 2) >= 0) return { code: 'prompt-malformed', reference: text.slice(open, open + 16) }
          last = open + 2
          continue
        }
        if (!VARIABLE_NAME.test(group[1])) return { code: 'prompt-malformed', reference: group[0] }
        if (variables !== undefined && !variables.includes(group[1])) return { code: 'prompt-unknown-variable', reference: group[0], variables }
        last = open + group[0].length
      }
      return undefined
    }

    /** Read one preset's saved draft; storage may be unavailable, which reads as no draft. */
    function readDraft(id) {
      try {
        const value = JSON.parse(localStorage.getItem(DRAFT_PREFIX + id) ?? 'null')
        return value !== null && typeof value.text === 'string' && typeof value.base === 'string' ? value : undefined
      } catch {
        return undefined
      }
    }

    /** Persist or clear one preset's draft; without storage the draft lives only in this page. */
    function writeDraft(id, draft) {
      try {
        if (draft === undefined) localStorage.removeItem(DRAFT_PREFIX + id)
        else localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft))
      } catch {
        // Storage disabled or full: the in-page draft map still protects the edit until the page closes.
      }
    }

    async function call(action, payload) {
      let response
      try {
        response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action, ...payload }),
        })
      } catch {
        throw new ActionFailure('network', 'Network error')
      }
      if (!response.ok) throw new ActionFailure(response.status === 404 ? 'network' : 'failed', `HTTP ${response.status}`)
      const body = await response.json()
      if (body.ok !== true) throw new ActionFailure(body.code ?? 'failed', body.error, body.details)
      return body.value
    }

    function slugify(text) {
      return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
    }

    function freeId(base, taken) {
      const root = base === '' ? 'my-mode' : base
      if (!taken.has(root)) return root
      for (let index = 2; ; index++) {
        const candidate = `${root.slice(0, 36)}-${index}`
        if (!taken.has(candidate)) return candidate
      }
    }

    function Chevron({ open }) {
      return h('svg', { className: `pm-chevron${open ? ' is-open' : ''}`, viewBox: '0 0 16 16', 'aria-hidden': true },
        h('path', { d: 'M6 4l4 4-4 4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    function Switch({ checked, disabled, pending, label, onChange }) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label, 'aria-busy': pending || undefined,
        className: `pm-switch${pending ? ' is-pending' : ''}`, disabled: disabled || pending,
        onClick: (event) => { event.stopPropagation(); onChange(!checked) },
      }, h('span', { className: 'pm-thumb' }))
    }

    /** Display text for a row's declared state: on, off, or its `!!js` condition. */
    function stateText(t, declared, condition) {
      return declared === true ? t('state.on') : declared === false ? t('state.off') : t('state.conditional', { condition: condition ?? '' })
    }

    /** Row config as JSON, with `!!js` expressions shown the way YAML spells them. */
    function configText(config) {
      return JSON.stringify(config, (_key, value) => value !== null && typeof value === 'object' && typeof value.__jsExpr === 'string' ? `!!js ${value.__jsExpr}` : value, 2)
    }

    function RowDetails({ ui, row }) {
      const { t } = ui
      const group = row.group === null ? t('group.core') : t(`group.${row.group}`)
      const entries = [
        ['detail.id', row.id ?? '—'],
        ['detail.module', row.module],
        ['detail.group', group.startsWith('group.') ? row.group : group],
        ['detail.builtIn', row.builtIn === undefined ? t('detail.noBuiltIn') : stateText(t, row.builtIn.declared, row.builtIn.condition)],
        ['detail.current', stateText(t, row.declared, row.condition)],
        ['detail.live', row.enabled === undefined ? t('live.unknown') : t(row.enabled ? 'live.on' : 'live.off')],
        ...row.builtIn === undefined ? [] : [['detail.change', t(row.changed ? 'change.changed' : 'change.same')]],
      ]
      return h('dl', { className: 'pm-details pm-inline' },
        ...entries.flatMap(([key, value]) => [h('dt', { key: `${key}:t` }, t(key)), h('dd', { key: `${key}:d` }, value)]),
        h('dt', { key: 'config:t' }, t('detail.config')),
        h('dd', { key: 'config:d' }, row.config === undefined ? t('detail.none') : h('pre', null, configText(row.config))))
    }

    /** Localized title and description for the rows this plugin adds to a mode. */
    const OWN_ROWS = { 'dsh-modes/live-persona': 'live', 'dsh-modes/prompt-tool': 'tool' }

    /**
     * Official names and descriptions of the rows the shipped presets mount (Chinese from each package's locale),
     * shown when the plugin inventory has no localized metadata, as on DSH 0.2.0.
     */
    const ROW_COPY = {
      zh: {
        persona: ['身份与提示词', '这个模式的系统提示词。'],
        'agent-instructions': ['工作区指令加载', '读取 AGENTS.md、CLAUDE.md 等文件，为 AI 提供工作区规则。'],
        'time-context': ['时间感知', '每一步把当前时间、浏览器时区和距上一条消息的时长告诉模型。'],
        'tool-bash': ['Bash 命令工具', '让 AI 执行 Bash 命令，并按配置管理后台运行和权限申请。'],
        'tool-pwsh': ['PowerShell 命令工具', '让 AI 执行 PowerShell 命令。'],
        'tool-fs': ['文件读写工具', '让 AI 读取、创建和编辑工作文件。'],
        'tool-fs-search': ['文件搜索工具', '让 AI 按文件名或文本内容搜索本地文件。'],
        'tool-jobs': ['后台任务工具', '让 AI 查看后台任务、读取输出或停止任务。'],
        'tool-schedule': ['定时提醒工具', '让 AI 创建、查看、修改和删除稍后提醒它继续的任务。'],
        'skill-filesystem': ['本地技能加载', '从本地目录发现和读取技能。'],
        'tool-skill': ['技能加载工具', '让 AI 按需加载技能说明。'],
        'command-goal': ['目标管理命令', '通过用户命令设置和管理当前会话目标。'],
        'tool-goal': ['目标管理工具', '让 AI 设置、查看和更新当前会话目标。'],
        'plan-mode': ['计划模式', '让 AI 先制定计划，并在用户审阅后切换到执行。'],
        'compaction-basic': ['上下文压缩', '在上下文达到阈值时，使用模型总结历史内容。'],
        'command-compact': ['上下文压缩命令', '让用户通过命令主动压缩当前会话上下文。'],
        'tool-result-pruner': ['工具结果精简', '在上下文压力较大时，精简过长的工具输出并保留首尾内容。'],
        'tool-subagent-control': ['子智能体控制工具', '让 AI 向子智能体发送消息或中断其运行。'],
        'tool-subagent-list-agents': ['子智能体列表', '让 AI 列出当前会话的子智能体。'],
        'tool-subagent': ['子智能体委派工具', '让 AI 将任务交给子智能体，并获取运行结果。'],
        'tool-subagent-fork': ['子智能体分叉', '让 AI 以当前对话为起点派出子智能体。'],
        'tool-subagent-codex': ['Codex 子智能体', '让 AI 把任务交给本机的 Codex 命令行。'],
        'tool-subagent-claude-code': ['Claude Code 子智能体', '让 AI 把任务交给本机的 Claude Code 命令行。'],
        'workflow-ptc': ['工作流执行引擎', '使用共享的 PTC 运行时执行工作流编排代码。'],
        'tool-workflow': ['工作流工具', '让 AI 编写并运行 JavaScript 脚本，编排多项工具操作。'],
        'tool-ralph': ['Ralph 迭代工具', '围绕同一目标逐轮运行新的子智能体，并传递上一轮的简要报告。'],
        'tool-ask-user': ['向用户提问工具', '让 AI 在需要补充信息或选择时向用户提问。'],
        'tool-todo': ['待办清单工具', '让 AI 创建和更新任务待办清单。'],
        'tool-web': ['网页搜索与读取工具', '让 AI 搜索网页并读取页面内容。'],
        present: ['文件交付工具', '让 AI 将工作区文件明确标记为本轮交付内容。'],
        'tool-plugin-manager': ['插件管理工具', '让 AI 安装、移除和启停当前运行配置中的插件。'],
        'tool-plugin-market': ['插件市场查询工具', '让 AI 在你配置的插件市场里查找可安装的插件和版本。'],
        'tool-cordis': ['插件 API 查询工具', '让 AI 在开发插件前查询服务端和浏览器端的可用 API。'],
        'tool-presentation': ['工具调用方式', '选择智能体通过原生工具或 PTC 代码来调用工具。'],
        pty: ['持久终端服务', '管理可持续交互的终端会话及其输入、输出和清理。'],
        'terminal-bash': ['持久 Shell 后端', '提供可跨多次调用保留状态的 Shell 终端。'],
        'terminal-pwsh': ['持久 Shell 后端', '提供可跨多次调用保留状态的 Shell 终端。'],
        'persistent-bash': ['持久 Bash 工具', '让 AI 在保留状态的 Bash 会话中连续执行命令。'],
        'persistent-pwsh': ['持久 PowerShell 工具', '让 AI 在保留状态的 PowerShell 会话中连续执行命令。'],
      },
      en: {
        persona: ['Persona and prompt', 'This mode\'s system prompt.'],
        'agent-instructions': ['Workspace instructions', 'Reads AGENTS.md, CLAUDE.md, and similar files for workspace rules.'],
        'time-context': ['Time awareness', 'Tells the model the current time, browser time zone, and time since the last message at every step.'],
        'tool-bash': ['Bash commands', 'Lets the AI run Bash commands, with background runs and permission requests as configured.'],
        'tool-pwsh': ['PowerShell commands', 'Lets the AI run PowerShell commands.'],
        'tool-fs': ['File read and write', 'Lets the AI read, create, and edit work files.'],
        'tool-fs-search': ['File search', 'Lets the AI search local files by name or text.'],
        'tool-jobs': ['Background jobs', 'Lets the AI list background jobs, read their output, or stop them.'],
        'tool-schedule': ['Reminders', 'Lets the AI create, list, edit, and delete reminders that bring it back later.'],
        'skill-filesystem': ['Local skills', 'Finds and reads skills from local folders.'],
        'tool-skill': ['Skill loading', 'Lets the AI load skill instructions when needed.'],
        'command-goal': ['Goal command', 'Lets you set and manage the session goal with a command.'],
        'tool-goal': ['Goal tools', 'Lets the AI set, read, and update the session goal.'],
        'plan-mode': ['Plan mode', 'Lets the AI plan first and execute after you review the plan.'],
        'compaction-basic': ['Context compaction', 'Summarizes the history with the model when the context reaches its threshold.'],
        'command-compact': ['Compact command', 'Lets you compact the session context with a command.'],
        'tool-result-pruner': ['Tool output trimming', 'Trims long tool output under context pressure, keeping its start and end.'],
        'tool-subagent-control': ['Subagent control', 'Lets the AI message or interrupt subagents.'],
        'tool-subagent-list-agents': ['Subagent list', 'Lets the AI list the session\'s subagents.'],
        'tool-subagent': ['Subagents', 'Lets the AI hand tasks to subagents and get their results.'],
        'tool-subagent-fork': ['Subagent fork', 'Lets the AI start a subagent from the current conversation.'],
        'tool-subagent-codex': ['Codex subagent', 'Lets the AI hand tasks to the local Codex CLI.'],
        'tool-subagent-claude-code': ['Claude Code subagent', 'Lets the AI hand tasks to the local Claude Code CLI.'],
        'workflow-ptc': ['Workflow engine', 'Runs workflow orchestration code on the shared PTC runtime.'],
        'tool-workflow': ['Workflows', 'Lets the AI write and run JavaScript that orchestrates several tool calls.'],
        'tool-ralph': ['Ralph loop', 'Runs a fresh subagent round after round toward one goal, passing on each round\'s brief report.'],
        'tool-ask-user': ['Ask the user', 'Lets the AI ask you when it needs information or a choice.'],
        'tool-todo': ['To-do list', 'Lets the AI create and update a task list.'],
        'tool-web': ['Web search and fetch', 'Lets the AI search the web and read pages.'],
        present: ['Deliverables', 'Lets the AI mark workspace files as this turn\'s deliverables.'],
        'tool-plugin-manager': ['Plugin management', 'Lets the AI install, remove, and switch plugins in the running configuration.'],
        'tool-plugin-market': ['Plugin market lookup', 'Lets the AI look up installable plugins and versions in the plugin markets you configured.'],
        'tool-cordis': ['Plugin API lookup', 'Lets the AI look up Host and browser APIs before writing a plugin.'],
        'tool-presentation': ['Tool calling style', 'Chooses whether the agent calls tools natively or through PTC code.'],
        pty: ['Persistent terminal', 'Manages interactive terminal sessions, their input, output, and cleanup.'],
        'terminal-bash': ['Persistent shell backend', 'Provides a shell terminal that keeps its state across calls.'],
        'terminal-pwsh': ['Persistent shell backend', 'Provides a shell terminal that keeps its state across calls.'],
        'persistent-bash': ['Persistent Bash', 'Lets the AI run commands one after another in a Bash session that keeps its state.'],
        'persistent-pwsh': ['Persistent PowerShell', 'Lets the AI run commands one after another in a PowerShell session that keeps its state.'],
      },
    }

    /** A row's display title and description: the inventory's localized metadata, else the copy above, else its id. */
    function rowCopy(ui, row) {
      const own = OWN_ROWS[row.module]
      if (own !== undefined) return { title: ui.t(`own.${own}.title`), description: ui.t(`own.${own}.desc`) }
      const title = ui.text(row.meta?.title)
      const description = ui.text(row.meta?.description)
      const copy = row.id === null ? undefined : ROW_COPY[ui.lang][row.id]
      const localized = title !== undefined && title !== row.module
      return {
        title: localized ? title : copy?.[0] ?? title ?? row.id ?? row.module,
        description: localized ? description : copy?.[1] ?? description,
      }
    }

    /**
     * What a mode can do, grouped the way a user thinks about it. Each capability switches a set of shipped rows;
     * rows a mode does not mount are skipped.
     */
    const CAPABILITIES = [
      { id: 'terminal', section: 'act', rows: ['tool-bash', 'tool-pwsh', 'tool-jobs', 'pty', 'terminal-bash', 'persistent-bash', 'terminal-pwsh', 'persistent-pwsh'] },
      { id: 'files', section: 'act', rows: ['tool-fs', 'tool-fs-search'] },
      { id: 'web', section: 'act', rows: ['tool-web'] },
      { id: 'delegation', section: 'act', rows: ['tool-subagent', 'tool-subagent-fork', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent-codex', 'tool-subagent-claude-code', 'tool-workflow', 'workflow-ptc', 'tool-ralph'] },
      { id: 'extend', section: 'act', rows: ['tool-plugin-manager', 'tool-plugin-market', 'tool-cordis'] },
      { id: 'planning', section: 'work', rows: ['plan-mode'] },
      { id: 'todo', section: 'work', rows: ['tool-todo'] },
      { id: 'goals', section: 'work', rows: ['command-goal', 'tool-goal'] },
      { id: 'skills', section: 'work', rows: ['skill-filesystem', 'tool-skill'] },
      { id: 'ask', section: 'work', rows: ['tool-ask-user'] },
      { id: 'present', section: 'work', rows: ['present'] },
      { id: 'schedule', section: 'work', rows: ['tool-schedule'] },
      { id: 'instructions', section: 'context', rows: ['agent-instructions'] },
      { id: 'time', section: 'context', rows: ['time-context'] },
      { id: 'compaction', section: 'context', rows: ['compaction-basic', 'command-compact', 'tool-result-pruner'] },
    ]
    const CAPABILITY_SECTIONS = ['act', 'work', 'context']
    const CAPABILITY_ROWS = new Set(CAPABILITIES.flatMap(capability => capability.rows))

    /** Whether a row is switched on by its own setting (a platform condition counts as on) and its group. */
    function rowOn(row) {
      return !row.inheritedOff && (row.declared === true || row.declared === 'conditional')
    }

    /**
     * One capability's rows in a mode. `counted` are the rows its built-in or template version switches on, so a row
     * the shipped mode keeps off (for example the Codex subagent) neither blocks "on" nor gets switched on by it.
     */
    function capabilityRows(capability, preset) {
      const rows = preset.rows.filter(row => row.id !== null && capability.rows.includes(row.id))
      const shipped = rows.filter(row => row.shipped !== 'off')
      return { rows, counted: shipped.length > 0 ? shipped : rows }
    }

    function capabilityState(counted) {
      const on = counted.filter(rowOn).length
      return on === 0 ? 'off' : on === counted.length ? 'on' : 'partial'
    }

    /** Row changes that switch a capability on: each counted row back on, following its platform when it has one. */
    function enableChanges(counted) {
      return counted.filter(row => !rowOn(row)).map(row => (row.shipped === 'conditional' || row.platform !== undefined
        ? { rowId: row.id, platform: true }
        : { rowId: row.id, enabled: true }))
    }

    function disableChanges(rows) {
      return rows.filter(rowOn).map(row => ({ rowId: row.id, enabled: false }))
    }

    /** Whether the file tool may write and edit; undefined when the mode has no file tool. */
    function fileWrites(preset) {
      const fs = preset.rows.find(row => row.id === 'tool-fs')
      return fs === undefined ? undefined : !(fs.config?.write === false || fs.config?.edit === false)
    }

    /** Short labels of what a mode can do, for its card header. */
    function capabilityChips(t, preset) {
      return CAPABILITIES.filter(capability => capability.section === 'act').flatMap((capability) => {
        const { rows, counted } = capabilityRows(capability, preset)
        if (rows.length === 0 || capabilityState(counted) === 'off') return []
        if (capability.id === 'files' && fileWrites(preset) === false) return [t('chip.filesReadOnly')]
        return [t(`chip.${capability.id}`)]
      })
    }

    function CapabilityPanel({ ui, preset, onShowPlugins }) {
      const { t, pending, run } = ui
      const editable = preset.source !== 'external'
      const others = preset.rows.filter(row => row.id === null || (!CAPABILITY_ROWS.has(row.id) && !row.essential && !row.own)).length
      const sections = CAPABILITY_SECTIONS.map(section => ({
        section,
        items: CAPABILITIES.filter(capability => capability.section === section)
          .map(capability => ({ capability, ...capabilityRows(capability, preset) }))
          .filter(item => item.rows.length > 0),
      })).filter(item => item.items.length > 0)
      if (sections.length === 0) return h('div', { className: 'pm-muted' }, t('cap.none'))
      const apply = (key, changes) => { if (changes.length > 0) run(key, 'applyRows', { id: preset.id, changes }, 'notice.saved') }
      return h('div', { className: 'pm-caps' },
        h('div', { className: 'pm-hint' }, t('cap.intro')),
        ...sections.map(({ section, items }) => h('div', { key: section, className: 'pm-capsection' },
          h('div', { className: 'pm-group' }, t(`section.${section}`)),
          ...items.map(({ capability, rows, counted }) => {
            const state = capabilityState(counted)
            const key = `cap:${preset.id}:${capability.id}`
            const name = t(`cap.${capability.id}.name`)
            const writes = capability.id === 'files' ? fileWrites(preset) : undefined
            const writesKey = `cap:${preset.id}:writes`
            return h('div', { key: capability.id, className: 'pm-cap' },
              h('div', { className: 'pm-capline' },
                h('div', { className: 'pm-rowmain' },
                  h('div', { className: 'pm-rowtitle' },
                    h('strong', null, name),
                    state === 'partial' ? h('span', { className: 'pm-badge is-warn', title: t('cap.partialHint') }, t('cap.partial')) : null),
                  h('div', { className: 'pm-rowdesc' }, t(`cap.${capability.id}.desc`))),
                h(Switch, {
                  checked: state === 'on', pending: pending.has(key), disabled: !editable, label: name,
                  onChange: enabled => apply(key, enabled ? enableChanges(counted) : disableChanges(rows)),
                })),
              writes !== undefined && state !== 'off'
                ? h('div', { className: 'pm-capline pm-capsub' },
                  h('div', { className: 'pm-rowmain' },
                    h('div', null, t('cap.writes')),
                    h('div', { className: 'pm-rowdesc' }, t('cap.writesDesc'))),
                  h(Switch, {
                    checked: writes, pending: pending.has(writesKey), disabled: !editable, label: t('cap.writes'),
                    onChange: enabled => apply(writesKey, [{ rowId: 'tool-fs', config: enabled ? { write: null, edit: null } : { write: false, edit: false } }]),
                  }))
                : null)
          }))),
        others > 0
          ? h('div', { className: 'pm-hint' }, t('cap.other', { n: others }), ' ',
            h('button', { type: 'button', className: 'pm-link', onClick: onShowPlugins }, t('cap.showPlugins')))
          : null)
    }

    /** The nearest scrolling ancestor, which clips absolutely positioned popups. */
    function scrollParent(element) {
      for (let node = element?.parentElement; node; node = node.parentElement) {
        if (/auto|scroll/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) return node
      }
      return document.scrollingElement
    }

    /**
     * A "more actions" button with a menu of secondary actions. It opens upward when the space below is too short,
     * moves through items with the arrow keys, Home, and End, and closes on a choice, Escape, Tab, or an outside click.
     * Escape is marked handled so the Settings dialog stays open.
     */
    function Menu({ label, items }) {
      const [open, setOpen] = React.useState(false)
      const [up, setUp] = React.useState(false)
      const root = React.useRef(null)
      const trigger = React.useRef(null)
      React.useLayoutEffect(() => {
        if (!open) return undefined
        const list = root.current?.querySelector('[role=menu]')
        const bounds = scrollParent(root.current)?.getBoundingClientRect()
        const anchor = trigger.current?.getBoundingClientRect()
        if (list !== undefined && list !== null && bounds !== undefined && anchor !== undefined) {
          const height = list.offsetHeight + 8
          setUp(anchor.bottom + height > bounds.bottom && anchor.top - height >= bounds.top)
        }
        list?.querySelector('[role=menuitem]:not(:disabled)')?.focus({ preventScroll: true })
        const outside = (event) => { if (!root.current?.contains(event.target)) setOpen(false) }
        document.addEventListener('mousedown', outside)
        return () => document.removeEventListener('mousedown', outside)
      }, [open])
      if (items.length === 0) return null
      const onKeyDown = (event) => {
        if (!open) return
        const entries = [...root.current.querySelectorAll('[role=menuitem]:not(:disabled)')]
        const at = entries.indexOf(document.activeElement)
        const focus = (index) => { event.preventDefault(); entries[(index + entries.length) % entries.length]?.focus() }
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
        else if (event.key === 'ArrowDown') focus(at + 1)
        else if (event.key === 'ArrowUp') focus(at - 1)
        else if (event.key === 'Home') focus(0)
        else if (event.key === 'End') focus(entries.length - 1)
        else if (event.key === 'Tab') setOpen(false)
      }
      return h('div', { className: 'pm-menu', ref: root, onKeyDown },
        h('button', {
          ref: trigger, type: 'button', className: 'pm-btn', 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-label': label, title: label,
          onClick: () => setOpen(!open),
          onKeyDown: (event) => { if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true) } },
        }, '⋯'),
        open
          ? h('div', { className: `pm-menu-list${up ? ' is-up' : ''}`, role: 'menu', 'aria-label': label },
            ...items.map(item => h('button', {
              key: item.label, type: 'button', role: 'menuitem', tabIndex: -1, className: item.danger ? 'pm-danger' : undefined, disabled: item.disabled,
              onClick: () => { setOpen(false); item.onSelect() },
            }, item.label)))
          : null)
    }

    /** Auto / on / off choice for a row whose built-in version switches by a condition, such as the platform. */
    function PlatformChoice({ ui, row, title, pending, onChoose }) {
      const { t } = ui
      const current = row.declared === 'conditional' ? 'platform' : row.declared === true ? 'on' : 'off'
      const now = row.declared === 'conditional' && row.enabled !== undefined ? t('row.platformNow', { state: t(row.enabled ? 'state.on' : 'state.off') }) : t('row.platform')
      const option = (value, label) => h('button', {
        key: value, type: 'button', role: 'radio', 'aria-checked': current === value, disabled: pending || row.inheritedOff,
        onClick: (event) => { event.stopPropagation(); if (current !== value) onChoose(value) },
      }, label)
      return h('div', { className: 'pm-seg', role: 'radiogroup', 'aria-label': title, title: t('row.platformHint') },
        option('platform', now), option('on', t('row.forceOn')), option('off', t('row.forceOff')))
    }

    function PluginRow({ ui, preset, row }) {
      const { t, pending, run } = ui
      const [details, setDetails] = React.useState(false)
      const [confirmOff, setConfirmOff] = React.useState(false)
      const key = `row:${preset.id}:${row.id}`
      const own = OWN_ROWS[row.module]
      const { title, description } = rowCopy(ui, row)
      const on = row.enabled ?? row.declared === true
      const platform = row.id !== null && (row.declared === 'conditional' || row.platform !== undefined)
      const locked = row.id === null ? t('row.noId') : row.inheritedOff ? t('row.groupOff') : undefined
      const toggle = (enabled, force = false) => run(key, 'toggle', { id: preset.id, rowId: row.id, enabled, ...force ? { force } : {} }, 'notice.saved')
      const choose = value => (value === 'platform'
        ? run(key, 'followPlatform', { id: preset.id, rowId: row.id }, 'notice.saved')
        : toggle(value === 'on', true))
      return h('div', { className: 'pm-rowwrap' },
        h('div', { className: 'pm-row' },
          row.meta?.icon && own === undefined
            ? h('img', { className: 'pm-icon', src: row.meta.icon, alt: '' })
            : h('span', { className: 'pm-icon', 'aria-hidden': true }, title.slice(0, 1).toUpperCase()),
          h('div', { className: 'pm-rowmain' },
            h('div', { className: 'pm-rowtitle' },
              h('span', null, title),
              row.essential ? h('span', { className: 'pm-badge is-accent' }, t('row.essential')) : null,
              row.live ? h('span', { className: 'pm-badge is-accent' }, t('badge.live')) : null,
              row.failure !== undefined ? h('span', { className: 'pm-badge is-error', title: row.failure }, t('row.failed')) : null,
              row.changed ? h('span', { className: 'pm-badge is-warn' }, t('row.changed')) : null,
              row.changed && row.restorable
                ? h('button', { type: 'button', className: 'pm-link', disabled: pending.has(key), onClick: () => run(key, 'resetRow', { id: preset.id, rowId: row.id }, 'notice.saved') }, t('action.restoreRow'))
                : null,
              row.platform !== undefined && row.declared !== 'conditional' ? h('span', { className: 'pm-badge', title: t('row.platformHint') }, t('row.forced')) : null,
              locked === undefined ? null : h('span', { className: 'pm-badge', title: row.condition }, locked)),
            description === undefined ? null : h('div', { className: 'pm-rowdesc' }, description),
            row.failure !== undefined ? h('div', { className: 'pm-hint is-error' }, row.failure) : null,
            h('div', null,
              h('button', { type: 'button', className: 'pm-link', 'aria-expanded': details, onClick: () => setDetails(!details) }, t(details ? 'row.hideDetails' : 'row.details')))),
          platform
            ? h(PlatformChoice, { ui, row, title, pending: pending.has(key), onChoose: choose })
            : h(Switch, {
              checked: on, pending: pending.has(key), disabled: locked !== undefined || confirmOff, label: title,
              onChange: (enabled) => {
                if (!enabled && row.essential) setConfirmOff(true)
                else toggle(enabled)
              },
            })),
        confirmOff
          ? h('div', {
            className: 'pm-warn pm-inline', role: 'alertdialog', 'aria-label': title,
            onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); setConfirmOff(false) } },
          },
            h('span', { className: 'pm-grow' }, t('confirm.personaOff', { title })),
            h('button', { type: 'button', className: 'pm-btn', autoFocus: true, onClick: () => setConfirmOff(false) }, t('action.cancel')),
            h('button', { type: 'button', className: 'pm-btn pm-danger', onClick: () => { setConfirmOff(false); toggle(false) } }, t('confirm.personaOffOk')))
          : null,
        details ? h(RowDetails, { ui, row }) : null)
    }

    function PluginList({ ui, preset, rows }) {
      const { t } = ui
      if (rows.length === 0) return h('div', { className: 'pm-muted', style: { padding: '10px 0' } }, t('noMatch'))
      const out = []
      let current
      for (const row of rows) {
        if (row.group !== current || out.length === 0) {
          current = row.group
          const label = row.group === null ? t('group.core') : t(`group.${row.group}`)
          out.push(h('div', { key: `g:${String(row.group)}:${out.length}`, className: 'pm-group' }, label.startsWith('group.') ? row.group : label))
        }
        out.push(h(PluginRow, { key: `${row.id ?? row.module}:${out.length}`, ui, preset, row }))
      }
      return out
    }

    function DetailsForm({ ui, title, initial, presets, from, withId, submitLabel, onSubmit, onCancel }) {
      const { t } = ui
      const taken = React.useMemo(() => new Set(presets.map(p => p.id)), [presets])
      const [name, setName] = React.useState(initial.name ?? '')
      const [description, setDescription] = React.useState(initial.description ?? '')
      const [template, setTemplate] = React.useState(from)
      const [id, setId] = React.useState(() => withId ? freeId(`${from}-copy`, taken) : '')
      const [idTouched, setIdTouched] = React.useState(false)
      const nameInput = React.useRef(null)
      React.useEffect(() => { nameInput.current?.focus() }, [])
      const idProblem = !withId ? undefined : !PRESET_ID.test(id) ? t('create.idInvalid') : taken.has(id) ? t('create.idTaken') : undefined
      const onName = (value) => {
        setName(value)
        if (withId && !idTouched) setId(freeId(slugify(value) || `${template}-copy`, taken))
      }
      const submit = (event) => {
        event.preventDefault()
        if (idProblem === undefined) onSubmit({ id, name, description, from: template })
      }
      return h('form', { className: 'pm-form', onSubmit: submit, onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } } },
        h('strong', { className: 'is-wide' }, title),
        h('label', null, t('create.name'),
          h('input', { ref: nameInput, className: 'pm-input', value: name, placeholder: t('create.namePlaceholder'), onChange: e => onName(e.target.value) })),
        withId
          ? h('label', null, t('create.id'),
            h('input', { className: 'pm-input', value: id, 'aria-invalid': idProblem !== undefined, onChange: (e) => { setIdTouched(true); setId(e.target.value.trim()) } }),
            h('span', { className: `pm-hint${idProblem === undefined ? '' : ' is-error'}` }, idProblem ?? t('create.idHint')))
          : null,
        h('label', { className: withId ? 'is-wide' : undefined }, t('create.description'),
          h('input', { className: 'pm-input', value: description, onChange: e => setDescription(e.target.value) })),
        withId
          ? h('label', null, t('create.from'),
            h('select', { className: 'pm-input', value: template, onChange: e => setTemplate(e.target.value) },
              presets.filter(p => p.rows.length > 0).map(p => h('option', { key: p.id, value: p.id }, ui.presetName(p)))))
          : null,
        h('div', { className: 'pm-bar' },
          h('button', { type: 'button', className: 'pm-btn', onClick: onCancel }, t('action.cancel')),
          h('button', { type: 'submit', className: 'pm-btn pm-primary', disabled: idProblem !== undefined || ui.pending.size > 0 }, submitLabel)))
    }

    function Yaml({ ui, preset }) {
      const { t } = ui
      const [content, setContent] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const [copied, setCopied] = React.useState(false)
      React.useEffect(() => {
        let live = true
        call('read', { id: preset.id }).then((doc) => { if (live) setContent(doc.content) }, (error) => { if (live) setFailure(ui.describe(error)) })
        return () => { live = false }
      }, [preset.id, preset.rows])
      React.useEffect(() => {
        if (!copied) return undefined
        const timer = setTimeout(() => setCopied(false), 1500)
        return () => clearTimeout(timer)
      }, [copied])
      if (failure !== null) return h('div', { className: 'pm-yaml pm-error' }, failure)
      return h('div', { className: 'pm-yaml' },
        h('pre', null, content ?? t('loading')),
        content === null ? null : h('button', {
          type: 'button', className: 'pm-btn',
          onClick: () => { navigator.clipboard?.writeText(content).then(() => setCopied(true), () => undefined) },
        }, copied ? t('action.copied') : t('action.copy')))
    }

    /** The prompt settings an edit compares and saves, with the persona schema's defaults filled in. */
    function promptOf(info) {
      return {
        prefix: info?.prefix ?? '',
        suffix: info?.suffix ?? '',
        complete: info?.complete === true,
        includeRuntimeContext: info?.includeRuntimeContext !== false,
      }
    }

    function PromptHistory({ ui, preset, current, onLoad }) {
      const { t } = ui
      const [entries, setEntries] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      React.useEffect(() => {
        let live = true
        call('history', { id: preset.id }).then((value) => { if (live) setEntries(value.entries) }, (reason) => { if (live) setFailure(ui.describe(reason)) })
        return () => { live = false }
      }, [preset.id])
      if (failure !== null) return h('div', { className: 'pm-error', role: 'alert' }, failure)
      if (entries === null) return h('div', { className: 'pm-muted' }, t('loading'))
      if (entries.length === 0) return h('div', { className: 'pm-hint' }, t('prompt.historyEmpty'))
      const source = (value) => {
        const label = t(`source.${value}`)
        return label.startsWith('source.') ? value : label
      }
      return h('div', { className: 'pm-history' }, entries.map((entry, index) => h('div', { key: `${entry.at}:${index}`, className: 'pm-history-item' },
        h('div', { className: 'pm-bar pm-hint' },
          h('span', null, new Date(entry.at).toLocaleString(ui.lang === 'zh' ? 'zh-CN' : 'en')),
          h('span', { className: 'pm-badge' }, source(entry.source)),
          h('span', { className: 'pm-grow' }),
          entry.prefix === current.prefix && entry.suffix === current.suffix
            ? h('span', null, t('prompt.historyCurrent'))
            : h('button', { type: 'button', className: 'pm-btn', onClick: () => onLoad(entry) }, t('prompt.historyLoad'))),
        h('pre', null, entry.prefix === '' ? '—' : entry.prefix))))
    }

    function PromptEditor({ ui, preset }) {
      const { t } = ui
      const [info, setInfo] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const [text, setText] = React.useState('')
      const [suffix, setSuffix] = React.useState('')
      const [complete, setComplete] = React.useState(false)
      const [runtime, setRuntime] = React.useState(true)
      /** The stored settings this edit started from; a save sends them so a stale editor cannot overwrite newer ones. */
      const [base, setBase] = React.useState(null)
      const [restored, setRestored] = React.useState(false)
      const [conflict, setConflict] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [panel, setPanel] = React.useState({ preview: false, advanced: false, history: false })
      const [confirmRestore, setConfirmRestore] = React.useState(false)
      const area = React.useRef(null)
      const suffixArea = React.useRef(null)
      const lastFocus = React.useRef('prefix')
      const fileInput = React.useRef(null)
      const reload = React.useCallback(() => call('prompt', { id: preset.id }), [preset.id])
      const toggle = name => setPanel(previous => ({ ...previous, [name]: !previous[name] }))
      /** Show `value` as stored, or `draft` on top of it when a draft is being restored. */
      const adopt = (value, draft) => {
        const saved = promptOf(value)
        setInfo(value)
        setText(draft?.text ?? saved.prefix)
        setSuffix(draft?.suffix ?? saved.suffix)
        setComplete(draft?.complete ?? saved.complete)
        setRuntime(draft?.includeRuntimeContext ?? saved.includeRuntimeContext)
        setBase(draft === undefined ? saved : typeof draft.base === 'string' ? { ...saved, prefix: draft.base } : { ...saved, ...draft.base })
        setRestored(draft !== undefined)
        setConflict(null)
      }
      React.useEffect(() => {
        let live = true
        reload().then((value) => {
          if (!live) return
          const saved = promptOf(value)
          const draft = ui.drafts.get(preset.id)
          const differs = draft !== undefined && (draft.text !== saved.prefix
            || ['suffix', 'complete', 'includeRuntimeContext'].some(key => draft[key] !== undefined && draft[key] !== saved[key]))
          if (draft !== undefined && !differs) ui.setDraft(preset.id, undefined)
          adopt(value, differs ? draft : undefined)
          if (differs && ['suffix', 'complete', 'includeRuntimeContext'].some(key => draft[key] !== undefined && draft[key] !== saved[key])) setPanel(previous => ({ ...previous, advanced: true }))
        }, (reason) => { if (live) setFailure(ui.describe(reason)) })
        return () => { live = false }
      }, [preset.id])
      React.useEffect(() => { if (info !== null) area.current?.focus() }, [info === null])
      if (failure !== null) return h('div', { className: 'pm-prompt pm-error', role: 'alert' }, failure)
      if (info === null) return h('div', { className: 'pm-prompt pm-muted' }, t('loading'))
      const saved = promptOf(info)
      const current = { prefix: text, suffix, complete, includeRuntimeContext: runtime }
      const changedKeys = Object.keys(current).filter(key => current[key] !== saved[key])
      const dirty = changedKeys.length > 0
      const problem = templateProblem(text, info.variables) ?? templateProblem(suffix, info.variables)
      const remember = (next) => {
        const merged = { ...current, ...next }
        const differs = Object.keys(merged).some(key => merged[key] !== saved[key])
        ui.setDraft(preset.id, differs
          ? { text: merged.prefix, suffix: merged.suffix, complete: merged.complete, includeRuntimeContext: merged.includeRuntimeContext, base, at: Date.now() }
          : undefined)
      }
      const edit = (value) => { setText(value); setNotice(null); remember({ prefix: value }) }
      const editSuffix = (value) => { setSuffix(value); setNotice(null); remember({ suffix: value }) }
      const editComplete = (value) => { setComplete(value); remember({ complete: value }) }
      const editRuntime = (value) => { setRuntime(value); remember({ includeRuntimeContext: value }) }
      const discard = () => { adopt(info, undefined); ui.setDraft(preset.id, undefined) }
      const save = (overwrite) => {
        if (!dirty || problem !== undefined || saving) return
        setSaving(true)
        setError(null)
        const payload = {
          prefix: text,
          ...changedKeys.includes('suffix') ? { suffix } : {},
          ...changedKeys.includes('complete') ? { complete } : {},
          ...changedKeys.includes('includeRuntimeContext') ? { includeRuntimeContext: runtime } : {},
          ...overwrite ? {} : { base },
        }
        call('setPrompt', { id: preset.id, ...payload })
          .then((value) => {
            const key = info.live ? 'notice.promptSavedLive' : value.effect?.synced ? 'notice.savedSynced' : 'notice.promptSaved'
            ui.setDraft(preset.id, undefined)
            ui.applyList(value, preset.id, key)
            return reload().then((latest) => { adopt(latest, undefined); setNotice(t(key)) })
          })
          .catch((reason) => {
            if (reason instanceof ActionFailure && reason.code === 'prompt-conflict') setConflict(reason.details?.stored ?? { prefix: reason.details?.current ?? '' })
            else setError(ui.describe(reason))
          })
          .finally(() => setSaving(false))
      }
      const loadLatest = () => reload().then((latest) => { adopt(latest, undefined); ui.setDraft(preset.id, undefined) }, reason => setError(ui.describe(reason)))
      /** Run a setting that saves on its own, then refresh the stored state without touching unsaved text. */
      const setting = (action, payload, success) => ui.run(`prompt:${preset.id}`, action, { id: preset.id, ...payload }, success,
        () => reload().then(latest => setInfo(latest), () => undefined))
      const restoreBuiltIn = () => {
        setConfirmRestore(false)
        const after = () => {
          ui.setDraft(preset.id, undefined)
          reload().then((latest) => { adopt(latest, undefined); setNotice(t('notice.promptRestored')) }, () => undefined)
        }
        if (info.live) ui.run(`prompt:${preset.id}`, 'setPrompt', { id: preset.id, ...info.builtIn }, 'notice.promptRestored', after)
        else ui.run(`prompt:${preset.id}`, 'resetRow', { id: preset.id, rowId: info.rowId }, 'notice.promptRestored', after)
      }
      const exportFile = () => {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
        const link = document.createElement('a')
        link.href = url
        link.download = `${preset.id}-prompt.md`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setNotice(t('prompt.exported'))
      }
      const importFile = (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file === undefined) return
        file.text().then((content) => {
          if (content.length > PROMPT_MAX_CHARS) { setError(t('prompt.importTooLarge', { max: PROMPT_MAX_CHARS })); return }
          edit(content)
          setNotice(t('prompt.imported'))
        }, reason => setError(t('prompt.importFailed', { detail: reason instanceof Error ? reason.message : String(reason) })))
      }
      const insert = (name) => {
        const intoSuffix = lastFocus.current === 'suffix' && panel.advanced
        const element = intoSuffix ? suffixArea.current : area.current
        const value = intoSuffix ? suffix : text
        const token = `{{${name}}}`
        const start = element?.selectionStart ?? value.length
        const end = element?.selectionEnd ?? value.length
        const next = value.slice(0, start) + token + value.slice(end)
        if (intoSuffix) editSuffix(next)
        else edit(next)
        requestAnimationFrame(() => {
          element?.focus()
          element?.setSelectionRange(start + token.length, start + token.length)
        })
      }
      const loadVersion = (entry) => {
        edit(entry.prefix)
        if (entry.suffix !== suffix) {
          setSuffix(entry.suffix)
          remember({ prefix: entry.prefix, suffix: entry.suffix })
          if (entry.suffix !== saved.suffix) setPanel(previous => ({ ...previous, advanced: true }))
        }
        setNotice(t('prompt.historyLoaded'))
      }
      let preview = info.preview === undefined ? info.error : info.preview
      if (info.preview !== undefined) {
        if (text !== saved.prefix && saved.prefix !== '' && preview.includes(saved.prefix)) preview = preview.replace(saved.prefix, text)
        if (suffix !== saved.suffix && saved.suffix !== '' && preview.includes(saved.suffix)) preview = preview.replace(saved.suffix, suffix)
      }
      const keys = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); save(false) }
      }
      const busy = ui.pending.size > 0
      const option = (checked, label, onChange, hint) => h('label', { className: 'pm-option' },
        h('input', { type: 'checkbox', checked, disabled: busy, onChange: e => onChange(e.target.checked) }),
        h('span', null, label, hint === undefined ? null : h('span', { className: 'pm-hint', style: { display: 'block' } }, hint)))
      const behavior = (checked, label, hint, onChange) => h('div', { className: 'pm-capline' },
        h('div', { className: 'pm-rowmain' },
          h('div', null, label),
          h('div', { className: 'pm-rowdesc' }, hint)),
        h(Switch, { checked, pending: ui.pending.has(`prompt:${preset.id}`), disabled: busy, label, onChange }))
      return h('div', { className: 'pm-prompt' },
        h('div', { className: 'pm-hint' }, info.rowId === undefined ? t('prompt.none') : info.complete ? t('prompt.complete') : t('prompt.partial')),
        info.off ? h('div', { className: 'pm-warn', role: 'note' },
          h('span', { className: 'pm-grow' }, t('prompt.off')),
          h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setting('toggle', { rowId: info.rowId, enabled: true }, 'notice.saved') }, t('action.enablePersona'))) : null,
        restored ? h('div', { className: 'pm-warn', role: 'status' },
          h('span', { className: 'pm-grow' }, Object.keys(base).every(key => base[key] === saved[key]) ? t('prompt.draftRestored') : `${t('prompt.draftRestored')} ${t('prompt.draftStale')}`),
          h('button', { type: 'button', className: 'pm-btn', onClick: discard }, t('prompt.discardDraft'))) : null,
        h('textarea', {
          ref: area, className: 'pm-input pm-textarea', value: text, rows: 8, spellCheck: false,
          'aria-label': t('prompt.title'), 'aria-invalid': templateProblem(text, info.variables) !== undefined,
          onFocus: () => { lastFocus.current = 'prefix' },
          onChange: e => edit(e.target.value),
          onKeyDown: keys,
        }),
        h('div', { className: 'pm-bar pm-hint' },
          info.variables?.length > 0 ? h('span', null, t('prompt.variables')) : null,
          ...(info.variables ?? []).map(name => h('button', { key: name, type: 'button', className: 'pm-chip', onClick: () => insert(name) }, `{{${name}}}`)),
          h('span', { className: 'pm-grow' }),
          h('span', null, t('prompt.chars', { n: text.length }))),
        h('div', null,
          h('button', { type: 'button', className: 'pm-link', 'aria-expanded': panel.advanced, onClick: () => toggle('advanced') }, `${panel.advanced ? '▾' : '▸'} ${t('prompt.advanced')}`)),
        panel.advanced ? h('div', { className: 'pm-panel' },
          h('label', { className: 'pm-hint', htmlFor: `pm-suffix-${preset.id}` }, t('prompt.suffix')),
          h('textarea', {
            id: `pm-suffix-${preset.id}`, ref: suffixArea, className: 'pm-input pm-textarea', style: { minHeight: 80 }, value: suffix, rows: 4, spellCheck: false,
            'aria-invalid': templateProblem(suffix, info.variables) !== undefined,
            onFocus: () => { lastFocus.current = 'suffix' },
            onChange: e => editSuffix(e.target.value),
            onKeyDown: keys,
          }),
          h('div', { className: 'pm-hint' }, complete ? t('prompt.suffixIgnored') : t('prompt.suffixHint')),
          option(complete, t('prompt.completeLabel'), editComplete),
          option(runtime, t('prompt.runtimeLabel'), editRuntime, t('prompt.flagsNote')))
          : null,
        problem === undefined ? null : h('div', { className: 'pm-error', role: 'alert' }, ui.describeCode(problem.code, problem, '')),
        error === null ? null : h('div', { className: 'pm-error', role: 'alert' }, error),
        notice === null ? null : h('div', { className: 'pm-notice', role: 'status' }, `✓ ${notice}`),
        conflict === null ? null : h('div', { className: 'pm-conflict', role: 'alert' },
          h('strong', null, t('prompt.conflictTitle')),
          h('span', { className: 'pm-hint' }, t('prompt.conflictLatest')),
          h('pre', null, conflict.suffix !== undefined && conflict.suffix !== base.suffix ? `${conflict.prefix}\n\n— ${t('prompt.suffix')} —\n${conflict.suffix}` : conflict.prefix),
          h('div', { className: 'pm-bar' },
            h('button', { type: 'button', className: 'pm-btn', onClick: loadLatest }, t('prompt.loadLatest')),
            h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: saving, onClick: () => save(true) }, t('prompt.overwrite')))),
        h('div', { className: 'pm-bar' },
          h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel.preview, onClick: () => toggle('preview') }, t(panel.preview ? 'prompt.hidePreview' : 'prompt.preview')),
          h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel.history, onClick: () => toggle('history') }, t(panel.history ? 'prompt.hideHistory' : 'prompt.history')),
          h('button', { type: 'button', className: 'pm-btn', onClick: () => fileInput.current?.click() }, t('prompt.import')),
          h('button', { type: 'button', className: 'pm-btn', onClick: exportFile }, t('prompt.export')),
          h('input', { ref: fileInput, className: 'pm-file', type: 'file', accept: '.md,.txt,text/markdown,text/plain', onChange: importFile }),
          info.changed && info.rowId ? h('button', { type: 'button', className: 'pm-btn', disabled: saving || busy || confirmRestore, onClick: () => setConfirmRestore(true) }, t('prompt.restore')) : null,
          h('span', { className: 'pm-grow' }),
          dirty ? h('button', { type: 'button', className: 'pm-btn', onClick: discard }, t('prompt.discard')) : null,
          h('button', { type: 'button', className: 'pm-btn pm-primary', title: t('prompt.shortcut'), disabled: !dirty || problem !== undefined || saving, onClick: () => save(false) }, t('action.save'))),
        confirmRestore
          ? h('div', {
            className: 'pm-warn', role: 'alertdialog', 'aria-label': t('prompt.restore'),
            onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); setConfirmRestore(false) } },
          },
            h('span', { className: 'pm-grow' }, dirty ? `${t('prompt.restoreConfirm')} ${t('prompt.restoreDirty')}` : t('prompt.restoreConfirm')),
            h('button', { type: 'button', className: 'pm-btn', autoFocus: true, onClick: () => setConfirmRestore(false) }, t('action.cancel')),
            h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: busy, onClick: restoreBuiltIn }, t('prompt.restore')))
          : null,
        panel.history ? h(PromptHistory, { ui, preset, current: { prefix: text, suffix }, onLoad: loadVersion }) : null,
        panel.preview
          ? h('div', { className: 'pm-yaml' },
            h('div', { className: 'pm-hint', style: { marginBottom: 6 } }, dirty ? `${t('prompt.previewNote')} ${t('prompt.previewDirty')}` : t('prompt.previewNote')),
            h('pre', null, preview))
          : null,
        h('div', { className: 'pm-behavior' },
          h('div', { className: 'pm-group' }, t('prompt.behaviorTitle')),
          h('div', { className: 'pm-hint' }, t('prompt.behaviorHint')),
          info.rowId ? behavior(info.live === true, t('prompt.liveLabel'), t('prompt.liveHint'), value => setting('setLive', { live: value }, value ? 'notice.liveOn' : 'notice.liveOff')) : null,
          behavior(info.promptTool === true, t('prompt.toolLabel'), t('prompt.toolHint'), value => setting('setPromptTool', { enabled: value }, value ? 'notice.toolOn' : 'notice.toolOff'))))
    }

    function CreateForm({ ui, presets, templates, initial, onSubmit, onCancel }) {
      const { t } = ui
      const taken = React.useMemo(() => new Set(presets.map(p => p.id)), [presets])
      const [kind, setKind] = React.useState(initial.kind)
      const [from, setFrom] = React.useState(initial.from ?? 'standard')
      const [name, setName] = React.useState('')
      const [description, setDescription] = React.useState('')
      const idFor = (nameValue, kindValue, fromValue) => freeId(slugify(nameValue) || (kindValue === 'copy' ? `${fromValue}-copy` : kindValue), taken)
      const [id, setId] = React.useState(() => idFor('', initial.kind, initial.from ?? 'standard'))
      const [idTouched, setIdTouched] = React.useState(false)
      const nameInput = React.useRef(null)
      const formRef = React.useRef(null)
      React.useEffect(() => {
        formRef.current?.scrollIntoView({ block: 'nearest' })
        nameInput.current?.focus({ preventScroll: true })
      }, [])
      const source = presets.find(p => p.id === from)
      const suggested = kind === 'copy' ? t('create.copyName', { name: source === undefined ? from : ui.presetName(source) }) : t(`template.${kind}.suggest`)
      const idProblem = !PRESET_ID.test(id) ? t('create.idInvalid') : taken.has(id) ? t('create.idTaken') : undefined
      const choose = (nextKind, nextFrom = from) => {
        setKind(nextKind)
        setFrom(nextFrom)
        if (!idTouched) setId(idFor(name, nextKind, nextFrom))
      }
      const submit = (event) => {
        event.preventDefault()
        if (idProblem !== undefined) return
        onSubmit({ id, name: name.trim() || suggested, description, ...kind === 'copy' ? { from } : { template: kind }, locale: ui.lang })
      }
      const option = (value, label, note, extra) => h('button', {
        key: value, type: 'button', role: 'radio', 'aria-checked': kind === value, className: 'pm-tpl', onClick: () => choose(value),
        'aria-label': [label, note, extra].filter(Boolean).join(' — '),
      }, h('strong', null, label), h('span', null, note), extra === undefined ? null : h('span', { className: 'pm-hint' }, extra))
      return h('form', { ref: formRef, className: 'pm-form', onSubmit: submit, onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); onCancel() } } },
        h('strong', { className: 'is-wide' }, t('create.title')),
        h('div', { className: 'is-wide pm-tpl-grid', role: 'radiogroup', 'aria-label': t('create.start') },
          ...templates.map(item => option(item.id, t(`template.${item.id}.name`), t(`template.${item.id}.desc`), t('template.on', { n: item.on }))),
          option('copy', t('template.copy.name'), t('template.copy.desc'))),
        kind === 'copy'
          ? h('label', { className: 'is-wide' }, t('create.from'),
            h('select', { className: 'pm-input', value: from, onChange: e => choose('copy', e.target.value) },
              presets.filter(p => p.rows.length > 0).map(p => h('option', { key: p.id, value: p.id }, ui.presetName(p)))))
          : null,
        h('label', null, t('create.name'),
          h('input', {
            ref: nameInput, className: 'pm-input', value: name, placeholder: suggested,
            onChange: (e) => { setName(e.target.value); if (!idTouched) setId(idFor(e.target.value, kind, from)) },
          })),
        h('label', null, t('create.id'),
          h('input', { className: 'pm-input', value: id, 'aria-invalid': idProblem !== undefined, onChange: (e) => { setIdTouched(true); setId(e.target.value.trim()) } }),
          h('span', { className: `pm-hint${idProblem === undefined ? '' : ' is-error'}` }, idProblem ?? t('create.idHint'))),
        h('label', { className: 'is-wide' }, t('create.description'),
          h('input', { className: 'pm-input', value: description, onChange: e => setDescription(e.target.value) })),
        h('div', { className: 'pm-bar' },
          h('button', { type: 'button', className: 'pm-btn', onClick: onCancel }, t('action.cancel')),
          h('button', { type: 'submit', className: 'pm-btn pm-primary', disabled: idProblem !== undefined || ui.pending.size > 0 }, t('action.create'))))
    }

    /** Open and saved sessions that use a preset, fetched when the delete confirmation opens. */
    function RemoveUsage({ ui, preset }) {
      const { t } = ui
      const [usage, setUsage] = React.useState(null)
      React.useEffect(() => {
        let live = true
        call('usage', { id: preset.id }).then((value) => { if (live) setUsage(value) }, () => { if (live) setUsage({ open: preset.usage }) })
        return () => { live = false }
      }, [preset.id])
      if (usage === null) return h('div', { className: 'pm-hint' }, t('confirm.checking'))
      const saved = Math.max(0, (usage.saved ?? 0) - usage.open)
      return h(React.Fragment, null,
        usage.open > 0 ? h('div', { className: 'pm-error' }, t('confirm.inUse', { n: usage.open })) : null,
        saved > 0 ? h('div', { className: 'pm-error' }, t(usage.partial ? 'confirm.savedPartial' : 'confirm.saved', { n: saved })) : null)
    }

    /** What syncing would change, listed before the user confirms. */
    function SyncSummary({ ui, preset, presets }) {
      const { t } = ui
      const sync = preset.sync
      const names = items => items.map(item => item.id ?? item).join(', ')
      const origin = preset.source === 'custom' && sync.origin !== undefined ? presets.find(p => p.id === sync.origin) : undefined
      const lines = [
        sync.added.length > 0 ? t('sync.added', { n: sync.added.length, names: names(sync.added) }) : undefined,
        sync.removed.length > 0 ? t('sync.removed', { n: sync.removed.length, names: names(sync.removed) }) : undefined,
        sync.updated.length > 0 ? t('sync.updated', { n: sync.updated.length, names: names(sync.updated) }) : undefined,
        sync.kept > 0 ? t('sync.kept', { n: sync.kept }) : undefined,
        sync.conflicts > 0 ? t('sync.conflicts', { n: sync.conflicts }) : undefined,
      ].filter(Boolean)
      return h(React.Fragment, null,
        h('div', null, t('sync.title')),
        origin === undefined ? null : h('div', { className: 'pm-hint' }, t('sync.origin', { name: ui.presetName(origin) })),
        h('ul', null, lines.map(line => h('li', { key: line }, line))))
    }

    /** The full row list with its own search, for users who want plugin-level control. */
    function PluginsPanel({ ui, preset }) {
      const { t } = ui
      const [query, setQuery] = React.useState('')
      const [onlyChanged, setOnlyChanged] = React.useState(false)
      const needle = query.trim().toLowerCase()
      const rows = preset.rows.filter((row) => {
        if (onlyChanged && !row.changed) return false
        if (needle === '') return true
        const copy = rowCopy(ui, row)
        return [row.id, row.module, copy.title, copy.description].some(value => value?.toLowerCase().includes(needle))
      })
      return h(React.Fragment, null,
        h('div', { className: 'pm-bar', style: { margin: '8px 0 4px' } },
          h('input', { className: 'pm-input pm-search', type: 'search', value: query, placeholder: t('plugins.search'), 'aria-label': t('plugins.search'), onChange: e => setQuery(e.target.value) }),
          h('label', { className: 'pm-check' },
            h('input', { type: 'checkbox', checked: onlyChanged, onChange: e => setOnlyChanged(e.target.checked) }),
            t('plugins.onlyChanged'))),
        h('div', { className: 'pm-hint' }, t('plugins.intro')),
        h(PluginList, { ui, preset, rows }))
    }

    function PresetCard({ ui, preset, presets, open, onOpen, onDuplicate }) {
      const { t, pending, run, notices, canTry, canSetDefault } = ui
      const [panel, setPanel] = React.useState(null)
      const [tab, setTab] = React.useState('capabilities')
      const name = ui.presetName(preset)
      const description = ui.presetDescription(preset)
      const changed = preset.rows.filter(row => row.changed).length
      const persona = preset.rows.find(row => row.essential)
      const on = preset.rows.filter(row => (row.enabled ?? row.declared === true) === true).length
      const busy = pending.size > 0
      const notice = notices.get(preset.id)
      const act = (action, payload, success) => run(`card:${preset.id}`, action, { id: preset.id, ...payload }, success, () => setPanel(null))
      const classes = ['pm-card', preset.isDefault ? 'is-default' : '', preset.broken ? 'is-broken' : '', notice ? 'is-flash' : ''].filter(Boolean).join(' ')
      const unregistered = preset.rows.length === 0
      const tabs = [
        !unregistered && preset.source !== 'external' && CAPABILITIES.some(capability => capabilityRows(capability, preset).rows.length > 0) ? 'capabilities' : undefined,
        !unregistered && preset.source !== 'external' ? 'prompt' : undefined,
        !unregistered ? 'plugins' : undefined,
      ].filter(Boolean)
      const current = tabs.includes(tab) ? tab : tabs[0]
      const openTab = (name) => { setTab(name); onOpen(true) }
      const panelRef = React.useRef(null)
      const topRef = React.useRef(null)
      React.useEffect(() => {
        if (panel === null) return
        panelRef.current?.scrollIntoView({ block: 'nearest' })
        panelRef.current?.querySelector('[data-autofocus]')?.focus({ preventScroll: true })
      }, [panel])
      /** Close the open panel and hand the keyboard back to the card's more-actions button. */
      const closePanel = () => {
        setPanel(null)
        topRef.current?.querySelector('.pm-menu > button')?.focus({ preventScroll: true })
      }
      const tabKeys = (event) => {
        const at = tabs.indexOf(current)
        const next = event.key === 'ArrowRight' ? at + 1 : event.key === 'ArrowLeft' ? at - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : undefined
        if (next === undefined) return
        event.preventDefault()
        const name = tabs[(next + tabs.length) % tabs.length]
        setTab(name)
        event.currentTarget.querySelector(`#pm-tab-${preset.id}-${name}`)?.focus()
      }
      const chips = capabilityChips(t, preset)
      const meta = [
        t('meta.plugins', { on, total: preset.rows.length }),
        preset.usage > 0 ? t('meta.usage', { n: preset.usage }) : undefined,
        changed > 0 ? t('meta.changed', { n: changed }) : undefined,
        preset.live ? t('meta.live') : undefined,
        preset.promptTool ? t('meta.promptTool') : undefined,
        preset.toolEdits > 0 ? t('meta.toolEdits', { n: preset.toolEdits }) : undefined,
      ].filter(Boolean)
      const failureTitle = (failure) => {
        const row = preset.rows.find(candidate => candidate.id === failure.rowId)
        if (row === undefined) return failure.rowId
        const title = rowCopy(ui, row).title
        return title === failure.rowId ? `${failure.rowId} (${row.module})` : `${title} (${failure.rowId})`
      }
      /** The single most urgent thing this card asks the user to do, if any. */
      const banner = preset.failures !== undefined
        ? h('div', { className: 'pm-warn pm-cardwarn', role: 'alert' },
          h('div', { className: 'pm-grow' },
            h('div', null, `⚠ ${t('repair.title', { n: preset.failures.length })}`),
            h('ul', { style: { margin: '4px 0 0', paddingLeft: 18 } }, preset.failures.map(failure => h('li', { key: failure.rowId }, `${failureTitle(failure)}: ${failure.detail}`))),
            h('div', { className: 'pm-hint', style: { marginTop: 4 } }, t('repair.hint'))),
          h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => act('repair', {}, 'notice.repaired') }, t('action.repair')))
        : preset.sync !== undefined && panel !== 'sync'
          ? h('div', { className: 'pm-warn pm-cardwarn pm-info', role: 'note' },
            h('span', { className: 'pm-grow' }, t('banner.sync')),
            h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setPanel('sync') }, t('action.sync')))
          : persona?.declared === false && persona.id !== null
            ? h('div', { className: 'pm-warn pm-cardwarn', role: 'note' },
              h('span', { className: 'pm-grow' }, `⚠ ${t('warn.personaOff')}`),
              h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => act('toggle', { rowId: persona.id, enabled: true }, 'notice.saved') }, t('action.enablePersona')))
            : ui.drafts.has(preset.id) && !(open && current === 'prompt')
              ? h('div', { className: 'pm-warn pm-cardwarn pm-info', role: 'note' },
                h('span', { className: 'pm-grow' }, t('banner.draft')),
                h('button', { type: 'button', className: 'pm-btn', onClick: () => openTab('prompt') }, t('action.openDraft')))
              : null
      const menu = [
        canSetDefault && !preset.isDefault && !preset.broken ? { label: t('action.setDefault'), disabled: busy, onSelect: () => act('setDefault', {}, 'notice.default') } : undefined,
        preset.rows.length > 0 ? { label: t('action.duplicate'), onSelect: () => onDuplicate({ kind: 'copy', from: preset.id }) } : undefined,
        { label: t('action.yaml'), onSelect: () => setPanel('yaml') },
        preset.source === 'custom' ? { label: t('action.rename'), onSelect: () => setPanel('details') } : undefined,
        preset.source === 'overridden' ? { label: t('action.reset'), disabled: busy, onSelect: () => setPanel('reset') } : undefined,
        preset.source === 'custom' && !preset.isDefault ? { label: t('action.remove'), danger: true, onSelect: () => setPanel('remove') } : undefined,
      ].filter(Boolean)
      return h('section', { className: classes, id: `pm-preset-${preset.id}`, 'aria-label': name },
        h('div', { className: 'pm-top', ref: topRef },
          h('div', {
            className: 'pm-head', role: 'button', tabIndex: 0, 'aria-expanded': open,
            'aria-label': `${name} · ${t(open ? 'action.collapse' : 'action.expand')}`,
            onClick: () => onOpen(!open),
            onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(!open) } },
          },
            h(Chevron, { open }),
            h('div', { className: 'pm-headmain' },
              h('div', { className: 'pm-name' },
                h('strong', null, name),
                preset.isDefault ? h('span', { className: 'pm-badge is-accent' }, t('badge.default')) : null,
                preset.source === 'custom' ? h('span', { className: 'pm-badge' }, t('badge.custom')) : preset.source === 'external' ? h('span', { className: 'pm-badge' }, t('badge.external')) : null,
                preset.broken ? h('span', { className: 'pm-badge is-error' }, t('badge.broken')) : null),
              description ? h('div', { className: 'pm-desc' }, description) : null,
              chips.length > 0 ? h('div', { className: 'pm-chips', 'aria-label': t('chip.label') }, chips.map(chip => h('span', { key: chip, className: 'pm-cchip' }, chip))) : null,
              h('div', { className: 'pm-meta' }, meta.join(' · ')),
              preset.broken && preset.failures === undefined ? h('div', { className: 'pm-error' }, preset.broken) : null)),
          h('div', { className: 'pm-topactions' },
            canTry && !preset.broken ? h('button', { type: 'button', className: 'pm-btn', onClick: () => ui.tryPreset(preset.id) }, t('action.try')) : null,
            h(Menu, { label: t('action.more'), items: menu }))),
        banner,
        panel === 'details'
          ? h(DetailsForm, {
            ui, title: t('rename.title'), initial: preset, presets, from: preset.id, withId: false, submitLabel: t('action.save'),
            onSubmit: values => act('update', { name: values.name, description: values.description }, 'notice.updated'),
            onCancel: closePanel,
          })
          : panel === 'remove' || panel === 'reset' || (panel === 'sync' && preset.sync)
            ? h('div', {
              ref: panelRef, className: 'pm-confirm', role: 'alertdialog', 'aria-label': name,
              onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); closePanel() } },
            },
              panel === 'sync' ? h(SyncSummary, { ui, preset, presets })
                : h('div', null, panel === 'remove' ? t('confirm.remove', { name }) : `${t('confirm.reset', { name, n: changed })}${preset.toolEdits > 0 ? ` ${t('confirm.resetTools', { n: preset.toolEdits })}` : ''}`),
              panel === 'remove' ? h(RemoveUsage, { ui, preset }) : null,
              h('div', { className: 'pm-bar pm-end' },
                h('button', { type: 'button', className: 'pm-btn', 'data-autofocus': panel === 'sync' ? undefined : true, onClick: closePanel }, t('action.cancel')),
                h('button', {
                  type: 'button', className: `pm-btn ${panel === 'sync' ? 'pm-primary' : 'pm-danger'}`, disabled: busy, 'data-autofocus': panel === 'sync' ? true : undefined,
                  onClick: () => act(panel, {}, panel === 'remove' ? 'notice.removed' : panel === 'sync' ? 'notice.synced' : 'notice.reset'),
                }, t(panel === 'sync' ? 'sync.confirm' : panel === 'remove' ? 'action.remove' : 'action.reset'))))
            : null,
        panel === 'yaml'
          ? h('div', { ref: panelRef, onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); closePanel() } } },
            h(Yaml, { ui, preset }),
            h('div', { className: 'pm-bar', style: { margin: '0 14px 12px 40px' } },
              h('button', { type: 'button', className: 'pm-btn', 'data-autofocus': true, onClick: closePanel }, t('action.hideYaml'))))
          : null,
        open && tabs.length > 0
          ? h('div', { className: 'pm-body' },
            h('div', { className: 'pm-tabs', role: 'tablist', 'aria-label': name, onKeyDown: tabKeys },
              ...tabs.map(name => h('button', {
                key: name, type: 'button', role: 'tab', id: `pm-tab-${preset.id}-${name}`, 'aria-selected': current === name, tabIndex: current === name ? 0 : -1,
                'aria-controls': `pm-panel-${preset.id}`, className: 'pm-tab', onClick: () => setTab(name),
              }, t(`tab.${name}`), name === 'prompt' && ui.drafts.has(preset.id) ? h('span', { className: 'pm-dot', title: t('badge.draft') }) : null))),
            h('div', { id: `pm-panel-${preset.id}`, role: 'tabpanel', 'aria-labelledby': `pm-tab-${preset.id}-${current}` },
              current === 'capabilities' ? h(CapabilityPanel, { ui, preset, onShowPlugins: () => setTab('plugins') })
                : current === 'prompt' ? h(PromptEditor, { key: preset.id, ui, preset })
                  : h(PluginsPanel, { ui, preset })))
          : null)
    }

    /** Wait for the blank session the main view shows, then compose it with `preset`; gives up after 3 seconds. */
    async function selectInBlankSession(ctx, preset) {
      try {
        const sessions = ctx.get('sessions')
        const presets = ctx.get('remote.agentPresets')
        if (sessions?.list === undefined || typeof presets?.select !== 'function') return
        for (let attempt = 0; attempt < 30; attempt++) {
          const summaries = Object.values(sessions.list.getSnapshot()?.byId ?? {})
          const blank = summaries.find(summary => summary?.blank === true
            && (sessions.retainInfo?.(summary.id)?.getSnapshot()?.retainedBy?.mainView ?? 0) > 0)
          if (blank !== undefined) {
            await presets.select(blank.id, preset)
            return
          }
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.warn(`dsh-modes: could not compose the new session with ${preset}`, error)
      }
    }

    /** The text a tool carries in one mode: its override, else the built-in text. */
    function effectiveText(entry) {
      return entry.text ?? entry.original ?? ''
    }

    /** A mode the tool view can edit: declared in an editable row, not code mode, and readable. */
    function usableMode(mode) {
      return mode.editable === true && mode.ptc !== true && mode.error === undefined
    }

    /**
     * One tool of the tool view: a header that opens an editor for the selected modes, with the per-mode state,
     * earlier versions, and the built-in text.
     */
    function ToolRow({ ui, name, rows, saveCount, draft, open, busy, onToggle, onDraft, onSave, onRestore }) {
      const { t } = ui
      const base = rows.length === 0 ? '' : effectiveText(rows[0].entry)
      const differ = rows.some(row => effectiveText(row.entry) !== base)
      const value = draft ?? base
      const dirty = draft !== undefined && rows.some(row => effectiveText(row.entry) !== draft)
      const edited = rows.filter(row => row.entry.text !== undefined)
      const outdated = edited.some(row => row.entry.outdated === true)
      const invalid = value.trim() === '' ? 'tool-text-empty' : value.length > TOOL_MAX_CHARS ? 'tool-text-too-long' : undefined
      const previous = [...new Set(rows.flatMap(row => row.entry.previous ?? []))].filter(text => text !== value).slice(0, 5)
      const originals = new Map()
      for (const row of rows) {
        if (row.entry.original === undefined) continue
        originals.set(row.entry.original, [...originals.get(row.entry.original) ?? [], ui.nameOf(row.mode.id)])
      }
      return h('div', { className: `pm-toolrow${dirty ? ' is-dirty' : ''}`, role: 'listitem' },
        h('button', { type: 'button', className: 'pm-toolhead', 'aria-expanded': open, onClick: onToggle },
          h(Chevron, { open }),
          h('span', { className: 'pm-toolname' }, name),
          edited.length > 0 ? h('span', { className: 'pm-badge is-accent' }, t('tools.edited', { n: edited.length, total: rows.length })) : null,
          outdated ? h('span', { className: 'pm-badge is-warn' }, t('tools.outdated')) : null,
          dirty ? h('span', { className: 'pm-badge is-warn' }, t('tools.draft')) : null),
        open ? h('div', { className: 'pm-toolbody' },
          differ ? h('div', { className: 'pm-hint' }, t('tools.differ', { name: ui.nameOf(rows[0].mode.id) })) : null,
          h('label', { className: 'pm-hint', htmlFor: `pm-tool-${name}` }, t('tools.text')),
          h('textarea', {
            id: `pm-tool-${name}`, className: 'pm-input pm-textarea', rows: 6, value, spellCheck: false,
            'aria-invalid': invalid !== undefined || undefined,
            onChange: event => onDraft(event.target.value === base ? undefined : event.target.value),
          }),
          h('div', { className: `pm-hint${invalid !== undefined ? ' is-error' : ''}` },
            invalid === undefined ? t('tools.chars', { n: value.length, max: TOOL_MAX_CHARS }) : ui.describeCode(invalid, { max: TOOL_MAX_CHARS }, invalid)),
          h('div', { className: 'pm-bar' },
            h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: busy || !dirty || invalid !== undefined || saveCount === 0, onClick: onSave }, t('tools.save', { n: saveCount })),
            h('button', { type: 'button', className: 'pm-btn', disabled: busy || saveCount === 0 || edited.length === 0, onClick: () => onRestore(edited.map(row => row.mode.id)) }, t('tools.restoreSelected')),
            draft !== undefined ? h('button', { type: 'button', className: 'pm-btn', onClick: () => onDraft(undefined) }, t('tools.discard')) : null),
          h('div', { className: 'pm-hint' }, t('tools.perMode')),
          h('ul', { className: 'pm-statelist' }, rows.map(row => h('li', { key: row.mode.id },
            h('span', null, ui.nameOf(row.mode.id)),
            h('span', { className: `pm-badge${row.entry.outdated ? ' is-warn' : row.entry.text !== undefined ? ' is-accent' : ''}` },
              t(row.entry.outdated ? 'tools.stateOutdated' : row.entry.text !== undefined ? 'tools.stateEdited' : 'tools.stateBuiltIn')),
            row.entry.text !== undefined
              ? h('button', { type: 'button', className: 'pm-link', disabled: busy || saveCount === 0, onClick: () => onRestore([row.mode.id]) }, t('tools.restoreOne'))
              : null))),
          previous.length > 0 ? h('div', { className: 'pm-history' },
            h('div', { className: 'pm-hint' }, t('tools.previous')),
            previous.map(text => h('div', { key: text, className: 'pm-history-item' },
              h('pre', null, text),
              h('div', { className: 'pm-bar' }, h('button', { type: 'button', className: 'pm-btn', onClick: () => onDraft(text === base ? undefined : text) }, t('tools.use')))))) : null,
          originals.size > 0 ? h('details', null,
            h('summary', { className: 'pm-hint' }, t('tools.builtIn')),
            [...originals].map(([text, modes]) => h('div', { key: text, style: { marginTop: 6 } },
              originals.size > 1 ? h('div', { className: 'pm-hint' }, t('tools.builtInFor', { modes: modes.join(', ') })) : null,
              h('pre', { className: 'pm-pre' }, text)))) : null) : null)
    }

    /**
     * The tool view: pick modes, edit the description of one or several tools, and save them to every picked mode in
     * one call, or restore the built-in text of a tool, of whole modes, or of everything.
     */
    function ToolDescriptions({ ui, reloadKey }) {
      const { t } = ui
      const [catalog, setCatalog] = React.useState(null)
      const [loadError, setLoadError] = React.useState(null)
      const [selected, setSelected] = React.useState(null)
      const [query, setQuery] = React.useState('')
      const [drafts, setDrafts] = React.useState(() => new Map())
      const [expanded, setExpanded] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [failures, setFailures] = React.useState([])
      const [confirm, setConfirm] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        setLoadError(null)
        call('tools', { refresh: reloadKey > 0 }).then((value) => {
          if (!alive) return
          setCatalog(value.presets)
          setSelected((previous) => {
            if (previous !== null) return previous
            const usable = value.presets.filter(usableMode)
            const first = usable.find(mode => mode.id === ui.defaultId) ?? usable[0]
            return new Set(first === undefined ? [] : [first.id])
          })
        }, (error) => { if (alive) setLoadError(ui.describe(error)) })
        return () => { alive = false }
      }, [reloadKey])

      const modes = catalog ?? []
      const usable = modes.filter(usableMode)
      const chosen = usable.filter(mode => selected?.has(mode.id))
      const scope = chosen.length > 0 ? chosen : usable
      const maps = React.useMemo(() => new Map(modes.map(mode => [mode.id, new Map(mode.tools.map(tool => [tool.name, tool]))])), [catalog])
      const needle = query.trim().toLowerCase()
      const names = [...new Set(scope.flatMap(mode => mode.tools.map(tool => tool.name)))].sort().filter((name) => {
        if (needle === '') return true
        return name.toLowerCase().includes(needle) || scope.some(mode => effectiveText(maps.get(mode.id).get(name) ?? {}).toLowerCase().includes(needle))
      })
      const rowsIn = list => name => list.flatMap(mode => (maps.get(mode.id).has(name) ? [{ mode, entry: maps.get(mode.id).get(name) }] : []))
      const chosenRows = rowsIn(chosen)
      const viewRows = rowsIn(scope)
      const dirtyNames = [...drafts.keys()].filter(name => chosenRows(name).some(row => effectiveText(row.entry) !== drafts.get(name)))
      const editedCount = modes => modes.reduce((total, mode) => total + mode.tools.filter(tool => tool.text !== undefined).length, 0)

      const finish = (value, tools) => {
        ui.setList(value)
        setCatalog(value.effect.tools)
        const results = value.effect.results
        const bad = results.filter(result => !['saved', 'restored', 'unchanged'].includes(result.status))
        setFailures(bad)
        const count = status => results.filter(result => result.status === status).length
        const summary = t('tools.summary', { saved: count('saved'), restored: count('restored'), unchanged: count('unchanged') })
        ui.announce(bad.length > 0 ? 'error' : 'notice', bad.length > 0 ? `${summary} · ${t('tools.summaryFailed', { n: bad.length })}` : summary)
        if (tools !== undefined) {
          setDrafts((previous) => {
            const next = new Map(previous)
            for (const name of tools) if (!bad.some(result => result.tool === name)) next.delete(name)
            return next
          })
        }
      }
      const send = (action, payload, tools) => {
        setBusy(true)
        setFailures([])
        setConfirm(null)
        call(action, payload).then(value => finish(value, tools), error => ui.announce('error', ui.describe(error))).finally(() => setBusy(false))
      }
      const save = (tools) => {
        const edits = tools.flatMap(name => chosen.flatMap(mode => (maps.get(mode.id).has(name)
          ? [{ preset: mode.id, tool: name, text: drafts.get(name), expected: maps.get(mode.id).get(name).text ?? null }]
          : [])))
        if (edits.length > 0) send('setToolDescriptions', { edits }, tools)
      }
      const restoreItems = (name, ids) => send('restoreToolDescriptions', { items: ids.map(preset => ({ preset, tool: name })) })
      const setDraft = (name, text) => setDrafts((previous) => {
        const next = new Map(previous)
        if (text === undefined) next.delete(name)
        else next.set(name, text)
        return next
      })
      const toggleMode = (id, on) => setSelected((previous) => {
        const next = new Set(previous)
        if (on) next.add(id)
        else next.delete(id)
        return next
      })
      const confirmCount = confirm === null ? 0 : confirm.kind === 'all' ? editedCount(modes) : confirm.kind === 'modes' ? editedCount(chosen) : confirm.ids.length
      const reason = (result) => {
        const detail = result.status === 'invalid' ? ui.describeCode(result.code, result.max === undefined ? undefined : { max: result.max }, result.status) : t(`tools.status.${result.status}`, { error: result.error ?? '' })
        return t('tools.failureLine', { mode: ui.nameOf(result.preset), tool: result.tool, reason: detail })
      }

      if (loadError !== null) return h('div', { className: 'pm-error', role: 'alert' }, loadError)
      if (catalog === null) return h('div', { className: 'pm-muted' }, t('tools.loading'))
      return h('div', { className: 'pm-tools' },
        h('p', { className: 'pm-intro' }, t('tools.intro')),
        ui.toolsError === undefined ? null : h('div', { className: 'pm-error', role: 'alert' }, t('stateError.tools', { detail: ui.toolsError })),
        usable.length === 0 ? h('div', { className: 'pm-muted' }, t('tools.noModes')) : null,
        h('div', { className: 'pm-panel', role: 'group', 'aria-label': t('tools.modes') },
          h('div', { className: 'pm-bar' },
            h('strong', { className: 'pm-grow' }, t('tools.modes')),
            h('button', { type: 'button', className: 'pm-link', onClick: () => setSelected(new Set(usable.map(mode => mode.id))) }, t('tools.selectAll')),
            h('button', { type: 'button', className: 'pm-link', onClick: () => setSelected(new Set()) }, t('tools.selectNone'))),
          h('div', { className: 'pm-modelist' }, modes.map((mode) => {
            const ok = usableMode(mode)
            const edits = mode.tools.filter(tool => tool.text !== undefined).length
            const why = mode.error !== undefined ? t('tools.modeError', { error: mode.error }) : mode.ptc ? t('tools.modePtc') : !mode.editable ? t('tools.modeReadOnly') : undefined
            return h('label', { key: mode.id, className: `pm-option${ok ? '' : ' is-off'}`, title: why },
              h('input', { type: 'checkbox', checked: ok && selected?.has(mode.id) === true, disabled: !ok, onChange: event => toggleMode(mode.id, event.target.checked) }),
              h('span', null, ui.nameOf(mode.id)),
              edits > 0 ? h('span', { className: 'pm-hint' }, t('tools.modeEdited', { n: edits })) : null,
              why !== undefined ? h('span', { className: 'pm-hint' }, why) : null)
          })),
          chosen.length === 0 && usable.length > 0 ? h('div', { className: 'pm-hint' }, t('tools.scopeAll')) : null),
        dirtyNames.length > 0 ? h('div', { className: 'pm-dirtybar', role: 'status' },
          h('span', { className: 'pm-grow' }, t('tools.dirty', { n: dirtyNames.length })),
          h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: busy || chosen.length === 0, onClick: () => save(dirtyNames) }, t('tools.saveAll', { tools: dirtyNames.length, modes: chosen.length })),
          h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setDrafts(new Map()) }, t('tools.discardAll'))) : null,
        failures.length > 0 ? h('div', { className: 'pm-warn', role: 'alert' },
          h('ul', { style: { margin: 0, paddingLeft: 18 } }, failures.map(result => h('li', { key: `${result.preset}:${result.tool}` }, reason(result))))) : null,
        h('input', { className: 'pm-input', style: { width: '100%' }, type: 'search', value: query, placeholder: t('tools.search'), 'aria-label': t('tools.search'), onChange: event => setQuery(event.target.value) }),
        names.length === 0 ? h('div', { className: 'pm-muted' }, t('tools.empty')) : h('div', { role: 'list', style: { display: 'flex', flexDirection: 'column', gap: 6 } }, names.map(name => h(ToolRow, {
          key: name, ui, name, rows: viewRows(name), saveCount: chosen.length, draft: drafts.get(name), open: expanded === name, busy,
          onToggle: () => setExpanded(expanded === name ? null : name),
          onDraft: text => setDraft(name, text),
          onSave: () => save([name]),
          onRestore: ids => setConfirm({ kind: 'tool', tool: name, ids }),
        }))),
        h('div', { className: 'pm-bar' },
          h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: busy || editedCount(chosen) === 0, onClick: () => setConfirm({ kind: 'modes' }) }, t('tools.restoreModes')),
          h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: busy || editedCount(modes) === 0, onClick: () => setConfirm({ kind: 'all' }) }, t('tools.restoreAll'))),
        confirm === null ? null : h('div', {
          className: 'pm-confirm', style: { margin: 0 }, role: 'alertdialog', 'aria-label': t('tools.restoreAll'),
          onKeyDown: (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setConfirm(null) } },
        },
        h('div', null, confirm.kind === 'tool' ? t('tools.confirmTool', { tool: confirm.tool, n: confirm.ids.length })
          : confirm.kind === 'modes' ? t('tools.confirmModes', { n: confirmCount, modes: chosen.length })
            : t('tools.confirmAll', { n: confirmCount })),
        h('div', { className: 'pm-bar pm-end' },
          h('button', { type: 'button', className: 'pm-btn', 'data-autofocus': true, onClick: () => setConfirm(null) }, t('action.cancel')),
          h('button', {
            type: 'button', className: 'pm-btn pm-danger', disabled: busy,
            onClick: () => (confirm.kind === 'tool' ? restoreItems(confirm.tool, confirm.ids)
              : send('restoreToolDescriptions', confirm.kind === 'all' ? { all: true } : { presets: chosen.map(mode => mode.id) })),
          }, t('tools.restoreOne')))))
    }

    function Page({ ctx, t, close }) {
      const [data, setData] = React.useState(null)
      const [pageError, setPageError] = React.useState(null)
      const [pending, setPending] = React.useState(() => new Set())
      const [notices, setNotices] = React.useState(() => new Map())
      const [errors, setErrors] = React.useState(() => new Map())
      const [open, setOpen] = React.useState(() => new Set())
      const [creating, setCreating] = React.useState(null)
      const [focusId, setFocusId] = React.useState(null)
      const [drafts, setDrafts] = React.useState(() => new Map())
      const [feedback, setFeedback] = React.useState(null)
      const [view, setView] = React.useState('modes')
      const [reloadKey, setReloadKey] = React.useState(0)
      const feedbackTimer = React.useRef(undefined)
      const dataRef = React.useRef(null)
      dataRef.current = data
      const timers = React.useRef(new Map())
      React.useEffect(() => () => {
        for (const timer of timers.current.values()) clearTimeout(timer)
        clearTimeout(feedbackTimer.current)
      }, [])
      React.useEffect(() => {
        if (focusId === null) return
        document.getElementById(`pm-preset-${focusId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        setFocusId(null)
      }, [focusId, data])

      const presetT = ctx.locale.bind('settings.agentPreset')
      const builtInCopy = (preset, part) => {
        const stem = preset.name === undefined ? BUILT_IN_COPY[preset.id] : undefined
        if (stem === undefined) return undefined
        const key = `preset${stem}${part}`
        const value = presetT(key)
        return value === key ? undefined : value
      }
      const text = value => value === undefined || value === null ? undefined : ctx.locale.resolveText(value)
      /** Localized text for a failure code, with its details as parameters; the Host's English message otherwise. */
      const describeCode = (code, details, fallback) => {
        const key = `err.${code}`
        const params = details === undefined ? undefined : { ...details, ...Array.isArray(details.variables) ? { variables: details.variables.join(', ') } : {} }
        const text = t(key, params)
        return text === key ? fallback : text
      }
      const describe = error => error instanceof ActionFailure ? describeCode(error.code, error.details, error.message) : error.message

      /** A preset's display name, looked up in the given lists, then the current one. */
      const presetNameOf = (id, ...lists) => {
        for (const presets of [...lists, dataRef.current?.presets]) {
          const preset = presets?.find(candidate => candidate.id === id)
          if (preset !== undefined) return builtInCopy(preset, 'Name') ?? preset.name ?? preset.id
        }
        return id
      }
      /**
       * Show one line in the feedback bar pinned to the bottom of the page, so the result of a switch far down a
       * card is visible. Notices clear themselves; errors stay until dismissed or replaced.
       */
      const announce = (kind, presetId, text, presets) => {
        clearTimeout(feedbackTimer.current)
        setFeedback({ kind, text: presetId === undefined ? text : t('toast.line', { name: presetNameOf(presetId, presets), text }) })
        if (kind === 'notice') feedbackTimer.current = setTimeout(() => setFeedback(null), NOTICE_MS)
      }
      /** Outline the card an action just changed. */
      const highlight = (presetId) => {
        setNotices(previous => new Map(previous).set(presetId, true))
        clearTimeout(timers.current.get(presetId))
        timers.current.set(presetId, setTimeout(() => {
          setNotices((previous) => { const next = new Map(previous); next.delete(presetId); return next })
        }, NOTICE_MS))
      }
      /** Run one action; a failure of the create form renders under the form, every other one in the feedback bar. */
      const run = (key, action, payload, success, after, errorKey = payload.id) => {
        const presetId = payload.id
        const before = dataRef.current?.presets
        setPending(previous => new Set(previous).add(key))
        setErrors((previous) => { const next = new Map(previous); next.delete(errorKey); return next })
        return call(action, payload)
          .then((value) => {
            setData(value)
            highlight(presetId)
            if (success !== undefined) announce('notice', presetId, t(value.effect?.synced !== undefined && success === 'notice.saved' ? 'notice.savedSynced' : success), [...value.presets, ...before ?? []])
            after?.()
            return value
          })
          .catch((error) => {
            if (errorKey === CREATE_ERROR) setErrors(previous => new Map(previous).set(errorKey, describe(error)))
            else announce('error', presetId, describe(error), before)
          })
          .finally(() => { setPending((previous) => { const next = new Set(previous); next.delete(key); return next }) })
      }
      const load = () => {
        setPageError(null)
        call('list').then((value) => {
          setData(value)
          setDrafts(new Map(value.presets.flatMap((preset) => {
            const draft = readDraft(preset.id)
            return draft === undefined ? [] : [[preset.id, draft]]
          })))
        }, (error) => { setPageError(describe(error)) })
      }
      const setDraft = (id, draft) => {
        writeDraft(id, draft)
        setDrafts((previous) => {
          const next = new Map(previous)
          if (draft === undefined) next.delete(id)
          else next.set(id, draft)
          return next
        })
      }
      React.useEffect(load, [])

      const workspace = ctx.get('uiWorkspace')
      const ui = {
        t, text, describe, describeCode, pending, notices, errors, run, drafts, setDraft,
        lang: String(ctx.locale.getSnapshot().active).toLowerCase().startsWith('zh') ? 'zh' : 'en',
        applyList: (value, presetId) => { setData(value); highlight(presetId) },
        canTry: typeof workspace?.startSession === 'function',
        canSetDefault: data?.canSetDefault === true,
        presetName: preset => builtInCopy(preset, 'Name') ?? preset.name ?? preset.id,
        nameOf: id => presetNameOf(id),
        announce: (kind, text) => announce(kind, undefined, text),
        setList: value => setData(value),
        defaultId: data?.defaultId,
        toolsError: data?.toolsError,
        presetDescription: preset => builtInCopy(preset, 'Description') ?? preset.description,
        tryPreset: (id) => {
          // DSH 0.2.0 starts sessions from a workspace id alone; a preset is then selected on the blank session.
          if (workspace.startSession.length >= 2) workspace.startSession(undefined, { clearPreviousDraft: false, agentPreset: id })
          else {
            workspace.startSession(undefined)
            void selectInBlankSession(ctx, id)
          }
          close?.()
        },
      }
      const presets = data?.presets ?? []
      const setCardOpen = (id, value) => setOpen((previous) => {
        const next = new Set(previous)
        if (value) next.add(id)
        else next.delete(id)
        return next
      })
      const create = (values) => {
        run('create', 'create', values, 'notice.created', () => {
          setCreating(null)
          setCardOpen(values.id, true)
          setFocusId(values.id)
        }, CREATE_ERROR)
      }

      return h('div', { className: 'pm' },
        h('style', null, CSS),
        h('div', { className: 'pm-bar' },
          h('h3', { className: 'pm-grow' }, t('title')),
          h('button', { type: 'button', className: 'pm-btn', onClick: () => { load(); setReloadKey(key => key + 1) } }, t('refresh')),
          view === 'modes' ? h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: data === null, onClick: () => setCreating({ kind: 'develop' }) }, t('newPreset')) : null),
        h('div', {
          className: 'pm-tabs pm-views', role: 'tablist', 'aria-label': t('title'),
          onKeyDown: (event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const next = view === 'modes' ? 'tools' : 'modes'
            setView(next)
            event.currentTarget.querySelector(`#pm-view-${next}`)?.focus()
          },
        }, ['modes', 'tools'].map(name => h('button', {
          key: name, type: 'button', role: 'tab', id: `pm-view-${name}`, 'aria-selected': view === name, tabIndex: view === name ? 0 : -1,
          className: 'pm-tab', onClick: () => setView(name),
        }, t(`view.${name}`)))),
        view === 'modes' ? h('p', { className: 'pm-intro' }, t('intro')) : null,
        pageError === null ? null : h('div', { className: 'pm-error', role: 'alert' }, pageError),
        data?.stateError === undefined ? null : h('div', { className: 'pm-error', role: 'alert' }, t('stateError', { detail: data.stateError })),
        view === 'tools' ? h(ToolDescriptions, { ui, reloadKey }) : null,
        view === 'tools' || creating === null ? null : h('div', { className: 'pm-card' },
          h(CreateForm, {
            key: `${creating.kind}:${creating.from ?? ''}`, ui, presets, templates: data?.templates ?? [], initial: creating,
            onSubmit: create, onCancel: () => { setCreating(null); setErrors((previous) => { const next = new Map(previous); next.delete(CREATE_ERROR); return next }) },
          }),
          errors.get(CREATE_ERROR) ? h('div', { className: 'pm-error', role: 'alert', style: { padding: '0 14px 12px' } }, errors.get(CREATE_ERROR)) : null),
        data === null && pageError === null && view === 'modes' ? h('div', { className: 'pm-muted' }, t('loading')) : null,
        view === 'tools' ? null : presets.map(preset => h(PresetCard, {
          key: preset.id, ui, preset, presets,
          open: open.has(preset.id),
          onOpen: value => setCardOpen(preset.id, value),
          onDuplicate: setCreating,
        })),
        feedback === null ? null : h('div', { className: `pm-toast${feedback.kind === 'error' ? ' is-error' : ''}`, role: feedback.kind === 'error' ? 'alert' : 'status' },
          h('span', { className: 'pm-grow' }, `${feedback.kind === 'error' ? '⚠' : '✓'} ${feedback.text}`),
          h('button', { type: 'button', className: 'pm-toast-close', 'aria-label': t('action.dismiss'), onClick: () => setFeedback(null) }, '×')))
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'dsh-modes: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'dsh-modes',
          order: 21,
          label: () => t('nav'),
          locale: NS,
        }, props => h(Page, { ctx, t, close: props.close })))
      },
    }
  },
})
