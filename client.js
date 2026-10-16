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
    const NOTICE_MS = 2500
    const PROMPT_MAX_CHARS = 20000
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
      intro: '查看每个模式包含哪些能力，按需开关、复制成自己的模式。修改只影响之后新建的会话。',
      search: '搜索插件或模式',
      onlyChanged: '只看改动',
      refresh: '刷新',
      newPreset: '新建模式',
      loading: '加载中…',
      noMatch: '没有匹配的插件',
      'badge.default': '默认',
      'badge.builtin': '内置',
      'badge.custom': '自定义',
      'badge.external': '来自其他插件',
      'badge.modified': '已修改 {n} 项',
      'badge.usage': '{n} 个会话在用',
      'badge.broken': '无法使用',
      summary: '{on}/{total} 个插件已启用',
      'action.try': '用它新建会话',
      'action.setDefault': '设为默认',
      'action.duplicate': '复制',
      'action.yaml': 'YAML',
      'action.hideYaml': '收起 YAML',
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
      'confirm.ok': '确认',
      'notice.saved': '已保存 · 之后新建的会话生效',
      'notice.created': '已创建',
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
      'action.prompt': '编辑提示词',
      'badge.promptChanged': '提示词已修改',
      'prompt.excerptLine': '提示词：{text}',
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
      'prompt.close': '收起',
      'prompt.conflictTitle': '保存被拒绝：这段提示词在你编辑期间被别处修改了。',
      'prompt.conflictLatest': '最新内容：',
      'prompt.loadLatest': '载入最新内容（放弃我的修改）',
      'prompt.overwrite': '用我的版本覆盖',
      'prompt.off': '身份行已关闭，这段提示词不会生效。',
      'badge.live': '即时生效',
      'badge.sync': '内置模式有更新',
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
      'row.platform': '跟随平台',
      'row.platformNow': '跟随平台（当前{state}）',
      'row.forceOn': '开',
      'row.forceOff': '关',
      'row.forced': '已固定，不随平台切换',
      'row.platformHint': '这一项原本按运行平台自动开关；固定为开或关后，换到其他平台也不会再自动切换。',
      'err.no-condition': '找不到这个插件原本的平台条件。',
      'confirm.saved': '另有 {n} 个已保存的会话是用这个模式创建的，删除后再打开这些会话会失败。',
      'confirm.checking': '正在统计使用这个模式的会话…',
      'confirm.savedPartial': '另有至少 {n} 个已保存的会话使用这个模式（会话较多，没有全部统计完），删除后再打开这些会话会失败。',
      'prompt.advanced': '更多设置',
      'prompt.hideAdvanced': '收起更多设置',
      'prompt.suffix': '结尾提示词',
      'prompt.suffixHint': '追加在工具说明、工作区规则等内容之后。留空会去掉这个模式原有的结尾。',
      'prompt.suffixIgnored': '已选择只用开头这段作为完整提示词，结尾提示词不会生效。',
      'prompt.completeLabel': '只用开头这段作为完整的系统提示词，不追加工具说明等内容',
      'prompt.runtimeLabel': '附带运行时上下文：当前时间、工作目录、权限等',
      'prompt.flagsNote': '这两项只对之后新建的会话生效，预览也不会反映它们的变化。',
      'prompt.liveLabel': '即时生效：保存提示词后，正在运行的会话从下一步起就使用新提示词',
      'prompt.liveHint': '会话中途换提示词时，模型会收到一条新的系统提示，可能多消耗一些输入令牌。开关本身只对之后新建的会话生效；卸载本插件前请先关闭。',
      'prompt.toolLabel': '允许在对话里修改提示词：模型可以调用 mode_prompt 工具，每次保存都要你批准',
      'prompt.toolHint': '只对之后新建的会话生效。',
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
    }
    const EN = {
      nav: 'Modes',
      title: 'Modes',
      intro: 'See what each mode includes, switch capabilities on or off, and copy modes into your own. Changes apply to sessions created afterwards.',
      search: 'Search plugins or modes',
      onlyChanged: 'Changed only',
      refresh: 'Refresh',
      newPreset: 'New mode',
      loading: 'Loading…',
      noMatch: 'No matching plugins',
      'badge.default': 'Default',
      'badge.builtin': 'Built-in',
      'badge.custom': 'Custom',
      'badge.external': 'From another plugin',
      'badge.modified': '{n} changed',
      'badge.usage': 'Used by {n} sessions',
      'badge.broken': 'Unavailable',
      summary: '{on}/{total} plugins on',
      'action.try': 'New session with it',
      'action.setDefault': 'Make default',
      'action.duplicate': 'Duplicate',
      'action.yaml': 'YAML',
      'action.hideYaml': 'Hide YAML',
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
      'confirm.ok': 'Confirm',
      'notice.saved': 'Saved · applies to new sessions',
      'notice.created': 'Created',
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
      'action.prompt': 'Edit prompt',
      'badge.promptChanged': 'Prompt changed',
      'prompt.excerptLine': 'Prompt: {text}',
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
      'prompt.close': 'Close',
      'prompt.conflictTitle': 'Not saved: this prompt was changed elsewhere while you were editing.',
      'prompt.conflictLatest': 'Latest version:',
      'prompt.loadLatest': 'Load the latest (discard my edits)',
      'prompt.overwrite': 'Overwrite with my version',
      'prompt.off': 'The persona row is off, so this prompt is not applied.',
      'badge.live': 'Live prompt',
      'badge.sync': 'Built-in update',
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
      'row.platform': 'Follow platform',
      'row.platformNow': 'Follow platform (now {state})',
      'row.forceOn': 'On',
      'row.forceOff': 'Off',
      'row.forced': 'Fixed; no longer follows the platform',
      'row.platformHint': 'This plugin is normally switched by platform; fixed on or off, it stays that way on every platform.',
      'err.no-condition': 'The plugin\'s original platform condition is not known.',
      'confirm.saved': '{n} more saved sessions were created with this mode; they will fail to open after it is deleted.',
      'confirm.checking': 'Counting the sessions that use this mode…',
      'confirm.savedPartial': 'At least {n} more saved sessions use this mode (not every session was counted); they will fail to open after it is deleted.',
      'prompt.advanced': 'More settings',
      'prompt.hideAdvanced': 'Fewer settings',
      'prompt.suffix': 'Closing prompt',
      'prompt.suffixHint': 'Added after tool guidance, workspace rules, and other sections. Leave it empty to drop this mode\'s closing text.',
      'prompt.suffixIgnored': 'The opening text is the complete prompt, so the closing prompt is not used.',
      'prompt.completeLabel': 'Use only the opening text as the complete system prompt, without tool guidance or other sections',
      'prompt.runtimeLabel': 'Include runtime context: current time, working directory, permissions, and more',
      'prompt.flagsNote': 'These two settings apply to sessions created afterwards, and the preview does not reflect them.',
      'prompt.liveLabel': 'Live prompt: after a save, running sessions use the new prompt from their next step',
      'prompt.liveHint': 'A mid-session prompt change reaches the model as a new system message and can cost some extra input tokens. The switch itself applies to sessions created afterwards; turn it off before uninstalling this plugin.',
      'prompt.toolLabel': 'Allow prompt changes in chat: the model can call the mode_prompt tool, and every save asks you first',
      'prompt.toolHint': 'Applies to sessions created afterwards.',
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
    }

    const CSS = `
.pm { container-type: inline-size; display: flex; flex-direction: column; gap: 14px; max-width: 760px; color: var(--dsw-alias-label-primary); font-size: 13px; }
.pm h3 { margin: 0; font-size: 18px; font-weight: 600; }
.pm-intro { margin: 0; color: var(--dsw-alias-label-tertiary); }
.pm-muted { color: var(--dsw-alias-label-tertiary); }
.pm-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pm-grow { flex: 1 1 auto; }
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
.pm-head:hover { background: var(--dsw-alias-interactive-bg-hover); }
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
.pm-actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 14px 12px 40px; }
.pm-body { border-top: .5px solid var(--dsw-alias-border-l3); padding: 6px 14px 12px 40px; display: flex; flex-direction: column; }
.pm-group { margin: 12px 0 4px; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--dsw-alias-label-tertiary); }
.pm-rowwrap { border-top: .5px solid var(--dsw-alias-border-l4); }
.pm-group + .pm-rowwrap { border-top: 0; }
.pm-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; }
.pm-icon { flex: none; width: 28px; height: 28px; border-radius: 7px; object-fit: contain; background: var(--dsw-alias-bg-layer-3); display: grid; place-items: center; font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-secondary); }
.pm-rowmain { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pm-rowtitle { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.pm-rowdesc { color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.pm-rowtech { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; color: var(--dsw-alias-label-quaternary, var(--dsw-alias-label-tertiary)); overflow-wrap: anywhere; }
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
.pm-excerpt { font-size: 12px; color: var(--dsw-alias-label-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-prompt { margin: 0 14px 12px 40px; display: flex; flex-direction: column; gap: 8px; }
.pm-textarea { width: 100%; min-height: 140px; resize: vertical; font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 12px; line-height: 1.6; }
.pm-textarea[aria-invalid='true'] { border-color: var(--dsw-alias-state-error-primary); }
.pm-chip { font-family: var(--dsw-font-mono, ui-monospace, monospace); font-size: 11px; padding: 1px 6px; border-radius: 6px; border: 1px solid var(--dsw-alias-border-l3); background: transparent; color: var(--dsw-alias-state-business-primary); cursor: pointer; }
.pm-chip:hover { background: var(--dsw-alias-interactive-bg-hover); }
.pm-prompt .pm-yaml { margin: 0; }
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
@container (max-width: 520px) {
  .pm-actions, .pm-body, .pm-confirm, .pm-yaml, .pm-prompt { margin-left: 0; padding-left: 14px; }
  .pm-inline { margin-left: 0; }
  .pm-cardwarn { margin-left: 14px; }
  .pm-yaml { margin: 0 14px 12px; }
  .pm-form { grid-template-columns: minmax(0, 1fr); }
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

    /** Follow-platform / on / off choice for a row whose built-in version is switched by a platform condition. */
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
      const { t, text, pending, run } = ui
      const [details, setDetails] = React.useState(false)
      const [confirmOff, setConfirmOff] = React.useState(false)
      const key = `row:${preset.id}:${row.id}`
      const own = OWN_ROWS[row.module]
      const title = own !== undefined ? t(`own.${own}.title`) : text(row.meta?.title) ?? row.id ?? row.module
      const description = own !== undefined ? t(`own.${own}.desc`) : text(row.meta?.description)
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
            h('div', { className: 'pm-rowtech' },
              row.id === null ? row.module : `${row.id} · ${row.module}`, ' · ',
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
          ? h('div', { className: 'pm-warn pm-inline', role: 'alertdialog', 'aria-label': title },
            h('span', { className: 'pm-grow' }, t('confirm.personaOff', { title })),
            h('button', { type: 'button', className: 'pm-btn pm-danger', onClick: () => { setConfirmOff(false); toggle(false) } }, t('confirm.personaOffOk')),
            h('button', { type: 'button', className: 'pm-btn', onClick: () => setConfirmOff(false) }, t('action.cancel')))
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
      return h('form', { className: 'pm-form', onSubmit: submit, onKeyDown: (event) => { if (event.key === 'Escape') onCancel() } },
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

    function PromptEditor({ ui, preset, onClose }) {
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
            ui.setDraft(preset.id, undefined)
            ui.applyList(value, preset.id, info.live ? 'notice.promptSavedLive' : value.effect?.synced ? 'notice.savedSynced' : 'notice.promptSaved')
            onClose()
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
        const after = () => { ui.setDraft(preset.id, undefined); onClose() }
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
        else if (event.key === 'Escape') onClose()
      }
      const busy = ui.pending.size > 0
      const option = (checked, label, onChange, hint) => h('label', { className: 'pm-option' },
        h('input', { type: 'checkbox', checked, disabled: busy, onChange: e => onChange(e.target.checked) }),
        h('span', null, label, hint === undefined ? null : h('span', { className: 'pm-hint', style: { display: 'block' } }, hint)))
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
          option(runtime, t('prompt.runtimeLabel'), editRuntime, t('prompt.flagsNote')),
          info.rowId ? option(info.live === true, t('prompt.liveLabel'), value => setting('setLive', { live: value }, value ? 'notice.liveOn' : 'notice.liveOff'), t('prompt.liveHint')) : null,
          option(info.promptTool === true, t('prompt.toolLabel'), value => setting('setPromptTool', { enabled: value }, value ? 'notice.toolOn' : 'notice.toolOff'), t('prompt.toolHint')))
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
          h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel.advanced, onClick: () => toggle('advanced') }, t(panel.advanced ? 'prompt.hideAdvanced' : 'prompt.advanced')),
          h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel.history, onClick: () => toggle('history') }, t(panel.history ? 'prompt.hideHistory' : 'prompt.history')),
          h('button', { type: 'button', className: 'pm-btn', onClick: () => fileInput.current?.click() }, t('prompt.import')),
          h('button', { type: 'button', className: 'pm-btn', onClick: exportFile }, t('prompt.export')),
          h('input', { ref: fileInput, className: 'pm-file', type: 'file', accept: '.md,.txt,text/markdown,text/plain', onChange: importFile }),
          dirty ? h('button', { type: 'button', className: 'pm-btn', onClick: discard }, t('prompt.discard')) : null,
          info.changed && info.rowId ? h('button', { type: 'button', className: 'pm-btn', disabled: saving || busy, onClick: restoreBuiltIn }, t('prompt.restore')) : null,
          h('span', { className: 'pm-grow' }),
          h('span', { className: 'pm-hint' }, t('prompt.shortcut')),
          h('button', { type: 'button', className: 'pm-btn', onClick: onClose }, t('prompt.close')),
          h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: !dirty || problem !== undefined || saving, onClick: () => save(false) }, t('action.save'))),
        panel.history ? h(PromptHistory, { ui, preset, current: { prefix: text, suffix }, onLoad: loadVersion }) : null,
        panel.preview
          ? h('div', { className: 'pm-yaml' },
            h('div', { className: 'pm-hint', style: { marginBottom: 6 } }, dirty ? `${t('prompt.previewNote')} ${t('prompt.previewDirty')}` : t('prompt.previewNote')),
            h('pre', null, preview))
          : null)
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
      React.useEffect(() => { nameInput.current?.focus() }, [])
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
      return h('form', { className: 'pm-form', onSubmit: submit, onKeyDown: (event) => { if (event.key === 'Escape') onCancel() } },
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

    function PresetCard({ ui, preset, presets, query, onlyChanged, open, onOpen, onDuplicate }) {
      const { t, pending, run, notices, errors, canTry, canSetDefault } = ui
      const [panel, setPanel] = React.useState(null)
      const name = ui.presetName(preset)
      const description = ui.presetDescription(preset)
      const changed = preset.rows.filter(row => row.changed).length
      const persona = preset.rows.find(row => row.essential)
      const promptChanged = persona?.changed === true
      const on = preset.rows.filter(row => (row.enabled ?? row.declared === true) === true).length
      const needle = query.trim().toLowerCase()
      const rows = preset.rows.filter(row => (!onlyChanged || row.changed)
        && (needle === '' || [row.id, row.module, ui.text(row.meta?.title), ui.text(row.meta?.description)].some(value => value?.toLowerCase().includes(needle))))
      const busy = pending.size > 0
      const notice = notices.get(preset.id)
      const error = errors.get(preset.id)
      const act = (action, payload, success) => run(`card:${preset.id}`, action, { id: preset.id, ...payload }, success, () => setPanel(null))
      const classes = ['pm-card', preset.isDefault ? 'is-default' : '', preset.broken ? 'is-broken' : '', notice ? 'is-flash' : ''].filter(Boolean).join(' ')
      const failureTitle = (failure) => {
        const row = preset.rows.find(candidate => candidate.id === failure.rowId)
        const title = row === undefined ? undefined : ui.text(row.meta?.title)
        return title === undefined || title === failure.rowId ? `${failure.rowId} (${row?.module ?? '?'})` : `${title} (${failure.rowId})`
      }
      return h('section', { className: classes, id: `pm-preset-${preset.id}`, 'aria-label': name },
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
              h('span', { className: 'pm-code' }, preset.id),
              preset.isDefault ? h('span', { className: 'pm-badge is-accent' }, t('badge.default')) : null,
              h('span', { className: 'pm-badge' }, t(preset.source === 'custom' ? 'badge.custom' : preset.source === 'external' ? 'badge.external' : 'badge.builtin')),
              changed > 0 ? h('span', { className: 'pm-badge is-warn' }, t('badge.modified', { n: changed })) : null,
              preset.usage > 0 ? h('span', { className: 'pm-badge' }, t('badge.usage', { n: preset.usage })) : null,
              promptChanged ? h('span', { className: 'pm-badge is-warn' }, t('badge.promptChanged')) : null,
              preset.live ? h('span', { className: 'pm-badge is-accent' }, t('badge.live')) : null,
              preset.sync ? h('span', { className: 'pm-badge is-accent' }, t('badge.sync')) : null,
              ui.drafts.has(preset.id) ? h('span', { className: 'pm-badge is-warn' }, t('badge.draft')) : null,
              preset.broken ? h('span', { className: 'pm-badge is-error' }, t('badge.broken')) : null),
            description ? h('div', { className: 'pm-desc' }, description) : null,
            preset.promptExcerpt ? h('div', { className: 'pm-excerpt', title: preset.promptExcerpt }, t('prompt.excerptLine', { text: preset.promptExcerpt })) : null,
            h('div', { className: 'pm-muted' }, t('summary', { on, total: preset.rows.length })),
            preset.broken && preset.failures === undefined ? h('div', { className: 'pm-error' }, preset.broken) : null,
            notice ? h('div', { className: 'pm-notice', role: 'status' }, `✓ ${t(notice)}`) : null,
            error ? h('div', { className: 'pm-error', role: 'alert' }, error) : null)),
        preset.failures !== undefined
          ? h('div', { className: 'pm-warn pm-cardwarn', role: 'alert' },
            h('div', { className: 'pm-grow' },
              h('div', null, `⚠ ${t('repair.title', { n: preset.failures.length })}`),
              h('ul', { style: { margin: '4px 0 0', paddingLeft: 18 } }, preset.failures.map(failure => h('li', { key: failure.rowId }, `${failureTitle(failure)}: ${failure.detail}`))),
              h('div', { className: 'pm-hint', style: { marginTop: 4 } }, t('repair.hint'))),
            h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => act('repair', {}, 'notice.repaired') }, t('action.repair')))
          : null,
        persona?.declared === false && persona.id !== null
          ? h('div', { className: 'pm-warn pm-cardwarn', role: 'note' },
            h('span', { className: 'pm-grow' }, `⚠ ${t('warn.personaOff')}`),
            h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => act('toggle', { rowId: persona.id, enabled: true }, 'notice.saved') }, t('action.enablePersona')))
          : null,
        panel === 'details'
          ? h(DetailsForm, {
            ui, title: t('rename.title'), initial: preset, presets, from: preset.id, withId: false, submitLabel: t('action.save'),
            onSubmit: values => act('update', { name: values.name, description: values.description }, 'notice.updated'),
            onCancel: () => setPanel(null),
          })
          : panel === 'remove' || panel === 'reset' || (panel === 'sync' && preset.sync)
            ? h('div', { className: 'pm-confirm', role: 'alertdialog', 'aria-label': name },
              panel === 'sync' ? h(SyncSummary, { ui, preset, presets })
                : h('div', null, panel === 'remove' ? t('confirm.remove', { name }) : t('confirm.reset', { name, n: changed })),
              panel === 'remove' ? h(RemoveUsage, { ui, preset }) : null,
              h('div', { className: 'pm-bar' },
                h('button', {
                  type: 'button', className: `pm-btn ${panel === 'sync' ? 'pm-primary' : 'pm-danger'}`, disabled: busy,
                  onClick: () => act(panel, {}, panel === 'remove' ? undefined : panel === 'sync' ? 'notice.synced' : 'notice.reset'),
                }, t(panel === 'sync' ? 'sync.confirm' : 'confirm.ok')),
                h('button', { type: 'button', className: 'pm-btn', onClick: () => setPanel(null) }, t('action.cancel'))))
            : h('div', { className: 'pm-actions' },
              canTry && !preset.broken ? h('button', { type: 'button', className: 'pm-btn pm-primary', onClick: () => ui.tryPreset(preset.id) }, t('action.try')) : null,
              preset.sync ? h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setPanel('sync') }, t('action.sync')) : null,
              canSetDefault && !preset.isDefault && !preset.broken
                ? h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => act('setDefault', {}, 'notice.default') }, t('action.setDefault'))
                : null,
              preset.source !== 'external' && !preset.broken ? h('button', { type: 'button', className: 'pm-btn', onClick: () => setPanel('prompt') }, t('action.prompt')) : null,
              preset.rows.length > 0 ? h('button', { type: 'button', className: 'pm-btn', onClick: () => onDuplicate({ kind: 'copy', from: preset.id }) }, t('action.duplicate')) : null,
              h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel === 'yaml', onClick: () => setPanel(panel === 'yaml' ? null : 'yaml') }, t(panel === 'yaml' ? 'action.hideYaml' : 'action.yaml')),
              preset.source === 'overridden' ? h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setPanel('reset') }, t('action.reset')) : null,
              preset.source === 'custom' ? h('button', { type: 'button', className: 'pm-btn', onClick: () => setPanel('details') }, t('action.rename')) : null,
              preset.source === 'custom' && !preset.isDefault ? h('button', { type: 'button', className: 'pm-btn pm-danger', onClick: () => setPanel('remove') }, t('action.remove')) : null),
        panel === 'yaml' ? h(Yaml, { ui, preset }) : null,
        panel === 'prompt' ? h(PromptEditor, { ui, preset, onClose: () => setPanel(null) }) : null,
        open && preset.rows.length > 0 ? h('div', { className: 'pm-body' }, h(PluginList, { ui, preset, rows })) : null)
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

    function Page({ ctx, t, close }) {
      const [data, setData] = React.useState(null)
      const [pageError, setPageError] = React.useState(null)
      const [pending, setPending] = React.useState(() => new Set())
      const [notices, setNotices] = React.useState(() => new Map())
      const [errors, setErrors] = React.useState(() => new Map())
      const [query, setQuery] = React.useState('')
      const [onlyChanged, setOnlyChanged] = React.useState(false)
      const [open, setOpen] = React.useState(() => new Set())
      const [creating, setCreating] = React.useState(null)
      const [focusId, setFocusId] = React.useState(null)
      const [drafts, setDrafts] = React.useState(() => new Map())
      const timers = React.useRef(new Map())
      React.useEffect(() => () => { for (const timer of timers.current.values()) clearTimeout(timer) }, [])
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

      const flash = (presetId, notice) => {
        setNotices(previous => new Map(previous).set(presetId, notice))
        clearTimeout(timers.current.get(presetId))
        timers.current.set(presetId, setTimeout(() => {
          setNotices((previous) => { const next = new Map(previous); next.delete(presetId); return next })
        }, NOTICE_MS))
      }
      /** Run one action; `errorKey` names where its failure renders (a preset card, or the create form). */
      const run = (key, action, payload, success, after, errorKey = payload.id) => {
        const presetId = payload.id
        setPending(previous => new Set(previous).add(key))
        setErrors((previous) => { const next = new Map(previous); next.delete(errorKey); return next })
        return call(action, payload)
          .then((value) => {
            setData(value)
            if (success !== undefined) flash(presetId, value.effect?.synced !== undefined && success === 'notice.saved' ? 'notice.savedSynced' : success)
            after?.()
            return value
          })
          .catch((error) => { setErrors(previous => new Map(previous).set(errorKey, describe(error))) })
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
        applyList: (value, presetId, notice) => { setData(value); flash(presetId, notice) },
        canTry: typeof workspace?.startSession === 'function',
        canSetDefault: data?.canSetDefault === true,
        presetName: preset => builtInCopy(preset, 'Name') ?? preset.name ?? preset.id,
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
      const needle = query.trim().toLowerCase()
      const searching = needle !== '' || onlyChanged
      /** A preset whose name matches keeps all its rows; otherwise the query filters rows. */
      const nameMatches = preset => needle !== '' && [preset.id, ui.presetName(preset)].some(value => value.toLowerCase().includes(needle))
      const visible = presets.filter(preset => !searching
        || preset.rows.some(row => (!onlyChanged || row.changed)
          && (needle === '' || nameMatches(preset) || [row.id, row.module, text(row.meta?.title), text(row.meta?.description)].some(value => value?.toLowerCase().includes(needle))))
        || (!onlyChanged && nameMatches(preset)))
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
          h('button', { type: 'button', className: 'pm-btn', onClick: load }, t('refresh')),
          h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: data === null, onClick: () => setCreating({ kind: 'develop' }) }, t('newPreset'))),
        h('p', { className: 'pm-intro' }, t('intro')),
        h('div', { className: 'pm-bar' },
          h('input', { className: 'pm-input pm-search', type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: e => setQuery(e.target.value) }),
          h('label', { className: 'pm-check' },
            h('input', { type: 'checkbox', checked: onlyChanged, onChange: e => setOnlyChanged(e.target.checked) }),
            t('onlyChanged'))),
        pageError === null ? null : h('div', { className: 'pm-error', role: 'alert' }, pageError),
        data?.stateError === undefined ? null : h('div', { className: 'pm-error', role: 'alert' }, t('stateError', { detail: data.stateError })),
        creating === null ? null : h('div', { className: 'pm-card' },
          h(CreateForm, {
            key: `${creating.kind}:${creating.from ?? ''}`, ui, presets, templates: data?.templates ?? [], initial: creating,
            onSubmit: create, onCancel: () => { setCreating(null); setErrors((previous) => { const next = new Map(previous); next.delete(CREATE_ERROR); return next }) },
          }),
          errors.get(CREATE_ERROR) ? h('div', { className: 'pm-error', role: 'alert', style: { padding: '0 14px 12px' } }, errors.get(CREATE_ERROR)) : null),
        data === null && pageError === null ? h('div', { className: 'pm-muted' }, t('loading')) : null,
        data !== null && visible.length === 0 ? h('div', { className: 'pm-muted' }, t('noMatch')) : null,
        visible.map(preset => h(PresetCard, {
          key: preset.id, ui, preset, presets, query: nameMatches(preset) ? '' : query, onlyChanged,
          open: searching || open.has(preset.id),
          onOpen: value => setCardOpen(preset.id, value),
          onDuplicate: setCreating,
        })))
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
