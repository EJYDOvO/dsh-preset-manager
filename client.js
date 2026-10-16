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
      'row.conditional': '按运行平台自动开关',
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
      'row.conditional': 'Switched by platform',
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

    function PluginRow({ ui, preset, row }) {
      const { t, text, pending, run } = ui
      const [details, setDetails] = React.useState(false)
      const [confirmOff, setConfirmOff] = React.useState(false)
      const key = `row:${preset.id}:${row.id}`
      const title = text(row.meta?.title) ?? row.id ?? row.module
      const description = text(row.meta?.description)
      const on = row.enabled ?? row.declared === true
      const locked = row.id === null ? t('row.noId') : row.declared === 'conditional' ? t('row.conditional') : row.inheritedOff ? t('row.groupOff') : undefined
      const toggle = enabled => run(key, 'toggle', { id: preset.id, rowId: row.id, enabled }, 'notice.saved')
      return h('div', { className: 'pm-rowwrap' },
        h('div', { className: 'pm-row' },
          row.meta?.icon
            ? h('img', { className: 'pm-icon', src: row.meta.icon, alt: '' })
            : h('span', { className: 'pm-icon', 'aria-hidden': true }, title.slice(0, 1).toUpperCase()),
          h('div', { className: 'pm-rowmain' },
            h('div', { className: 'pm-rowtitle' },
              h('span', null, title),
              row.essential ? h('span', { className: 'pm-badge is-accent' }, t('row.essential')) : null,
              row.changed ? h('span', { className: 'pm-badge is-warn' }, t('row.changed')) : null,
              row.changed && row.restorable
                ? h('button', { type: 'button', className: 'pm-link', disabled: pending.has(key), onClick: () => run(key, 'resetRow', { id: preset.id, rowId: row.id }, 'notice.saved') }, t('action.restoreRow'))
                : null,
              locked === undefined ? null : h('span', { className: 'pm-badge', title: row.condition }, locked)),
            description === undefined ? null : h('div', { className: 'pm-rowdesc' }, description),
            h('div', { className: 'pm-rowtech' },
              row.id === null ? row.module : `${row.id} · ${row.module}`, ' · ',
              h('button', { type: 'button', className: 'pm-link', 'aria-expanded': details, onClick: () => setDetails(!details) }, t(details ? 'row.hideDetails' : 'row.details')))),
          h(Switch, {
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

    function PromptEditor({ ui, preset, onClose }) {
      const { t } = ui
      const [info, setInfo] = React.useState(null)
      const [failure, setFailure] = React.useState(null)
      const [text, setText] = React.useState('')
      /** The stored prompt this edit started from; a save sends it so a stale editor cannot overwrite a newer prompt. */
      const [base, setBase] = React.useState('')
      const [restored, setRestored] = React.useState(false)
      const [conflict, setConflict] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [notice, setNotice] = React.useState(null)
      const [showPreview, setShowPreview] = React.useState(false)
      const area = React.useRef(null)
      const fileInput = React.useRef(null)
      const reload = React.useCallback(() => call('prompt', { id: preset.id }), [preset.id])
      React.useEffect(() => {
        let live = true
        reload().then((value) => {
          if (!live) return
          const saved = value.prefix ?? ''
          const draft = ui.drafts.get(preset.id)
          if (draft !== undefined && draft.text !== saved) {
            setText(draft.text)
            setBase(draft.base)
            setRestored(true)
          } else {
            setText(saved)
            setBase(saved)
            if (draft !== undefined) ui.setDraft(preset.id, undefined)
          }
          setInfo(value)
        }, (reason) => { if (live) setFailure(ui.describe(reason)) })
        return () => { live = false }
      }, [preset.id])
      React.useEffect(() => { if (info !== null) area.current?.focus() }, [info === null])
      if (failure !== null) return h('div', { className: 'pm-prompt pm-error', role: 'alert' }, failure)
      if (info === null) return h('div', { className: 'pm-prompt pm-muted' }, t('loading'))
      const saved = info.prefix ?? ''
      const dirty = text !== saved
      const problem = templateProblem(text, info.variables)
      const edit = (value) => {
        setText(value)
        setNotice(null)
        ui.setDraft(preset.id, value === saved ? undefined : { text: value, base, at: Date.now() })
      }
      const adopt = (value, latest) => {
        setInfo(latest)
        setText(value)
        setBase(latest.prefix ?? '')
        setRestored(false)
        setConflict(null)
        ui.setDraft(preset.id, undefined)
      }
      const discard = () => adopt(saved, info)
      const save = (overwrite) => {
        if (!dirty || problem !== undefined || saving) return
        setSaving(true)
        setError(null)
        call('setPrompt', { id: preset.id, prefix: text, ...overwrite ? {} : { base } })
          .then((value) => {
            ui.setDraft(preset.id, undefined)
            ui.applyList(value, preset.id, 'notice.promptSaved')
            onClose()
          })
          .catch((reason) => {
            if (reason instanceof ActionFailure && reason.code === 'prompt-conflict') setConflict(reason.details?.current ?? '')
            else setError(ui.describe(reason))
          })
          .finally(() => setSaving(false))
      }
      const loadLatest = () => reload().then(latest => adopt(latest.prefix ?? '', latest), reason => setError(ui.describe(reason)))
      const enablePersona = () => ui.run(`prompt:${preset.id}`, 'toggle', { id: preset.id, rowId: info.rowId, enabled: true }, 'notice.saved',
        () => reload().then(latest => setInfo(latest), () => undefined))
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
        const element = area.current
        const token = `{{${name}}}`
        const start = element?.selectionStart ?? text.length
        const end = element?.selectionEnd ?? text.length
        edit(text.slice(0, start) + token + text.slice(end))
        requestAnimationFrame(() => {
          element?.focus()
          element?.setSelectionRange(start + token.length, start + token.length)
        })
      }
      const preview = info.preview === undefined ? info.error
        : dirty && saved !== '' && info.preview.includes(saved) ? info.preview.replace(saved, text) : info.preview
      return h('div', { className: 'pm-prompt' },
        h('div', { className: 'pm-hint' }, info.rowId === undefined ? t('prompt.none') : info.complete ? t('prompt.complete') : t('prompt.partial')),
        info.off ? h('div', { className: 'pm-warn', role: 'note' },
          h('span', { className: 'pm-grow' }, t('prompt.off')),
          h('button', { type: 'button', className: 'pm-btn', disabled: ui.pending.size > 0, onClick: enablePersona }, t('action.enablePersona'))) : null,
        restored ? h('div', { className: 'pm-warn', role: 'status' },
          h('span', { className: 'pm-grow' }, base === saved ? t('prompt.draftRestored') : `${t('prompt.draftRestored')} ${t('prompt.draftStale')}`),
          h('button', { type: 'button', className: 'pm-btn', onClick: discard }, t('prompt.discardDraft'))) : null,
        h('textarea', {
          ref: area, className: 'pm-input pm-textarea', value: text, rows: 8, spellCheck: false,
          'aria-label': t('prompt.title'), 'aria-invalid': problem !== undefined,
          onChange: e => edit(e.target.value),
          onKeyDown: (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); save(false) }
            else if (event.key === 'Escape') onClose()
          },
        }),
        h('div', { className: 'pm-bar pm-hint' },
          info.variables?.length > 0 ? h('span', null, t('prompt.variables')) : null,
          ...(info.variables ?? []).map(name => h('button', { key: name, type: 'button', className: 'pm-chip', onClick: () => insert(name) }, `{{${name}}}`)),
          h('span', { className: 'pm-grow' }),
          h('span', null, t('prompt.chars', { n: text.length }))),
        problem === undefined ? null : h('div', { className: 'pm-error', role: 'alert' }, ui.describeCode(problem.code, problem, '')),
        error === null ? null : h('div', { className: 'pm-error', role: 'alert' }, error),
        notice === null ? null : h('div', { className: 'pm-notice', role: 'status' }, `✓ ${notice}`),
        conflict === null ? null : h('div', { className: 'pm-conflict', role: 'alert' },
          h('strong', null, t('prompt.conflictTitle')),
          h('span', { className: 'pm-hint' }, t('prompt.conflictLatest')),
          h('pre', null, conflict),
          h('div', { className: 'pm-bar' },
            h('button', { type: 'button', className: 'pm-btn', onClick: loadLatest }, t('prompt.loadLatest')),
            h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: saving, onClick: () => save(true) }, t('prompt.overwrite')))),
        h('div', { className: 'pm-bar' },
          h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': showPreview, onClick: () => setShowPreview(!showPreview) }, t(showPreview ? 'prompt.hidePreview' : 'prompt.preview')),
          h('button', { type: 'button', className: 'pm-btn', onClick: () => fileInput.current?.click() }, t('prompt.import')),
          h('button', { type: 'button', className: 'pm-btn', onClick: exportFile }, t('prompt.export')),
          h('input', { ref: fileInput, className: 'pm-file', type: 'file', accept: '.md,.txt,text/markdown,text/plain', onChange: importFile }),
          dirty ? h('button', { type: 'button', className: 'pm-btn', onClick: discard }, t('prompt.discard')) : null,
          info.changed && info.rowId
            ? h('button', { type: 'button', className: 'pm-btn', disabled: saving, onClick: () => ui.run(`prompt:${preset.id}`, 'resetRow', { id: preset.id, rowId: info.rowId }, 'notice.promptRestored', () => { ui.setDraft(preset.id, undefined); onClose() }) }, t('prompt.restore'))
            : null,
          h('span', { className: 'pm-grow' }),
          h('span', { className: 'pm-hint' }, t('prompt.shortcut')),
          h('button', { type: 'button', className: 'pm-btn', onClick: onClose }, t('prompt.close')),
          h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: !dirty || problem !== undefined || saving, onClick: () => save(false) }, t('action.save'))),
        showPreview
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
              ui.drafts.has(preset.id) ? h('span', { className: 'pm-badge is-warn' }, t('badge.draft')) : null,
              preset.broken ? h('span', { className: 'pm-badge is-error' }, t('badge.broken')) : null),
            description ? h('div', { className: 'pm-desc' }, description) : null,
            preset.promptExcerpt ? h('div', { className: 'pm-excerpt', title: preset.promptExcerpt }, t('prompt.excerptLine', { text: preset.promptExcerpt })) : null,
            h('div', { className: 'pm-muted' }, t('summary', { on, total: preset.rows.length })),
            preset.broken ? h('div', { className: 'pm-error' }, preset.broken) : null,
            notice ? h('div', { className: 'pm-notice', role: 'status' }, `✓ ${t(notice)}`) : null,
            error ? h('div', { className: 'pm-error', role: 'alert' }, error) : null)),
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
          : panel === 'remove' || panel === 'reset'
            ? h('div', { className: 'pm-confirm', role: 'alertdialog', 'aria-label': name },
              h('div', null, panel === 'remove' ? t('confirm.remove', { name }) : t('confirm.reset', { name, n: changed })),
              panel === 'remove' && preset.usage > 0 ? h('div', { className: 'pm-error' }, t('confirm.inUse', { n: preset.usage })) : null,
              h('div', { className: 'pm-bar' },
                h('button', { type: 'button', className: 'pm-btn pm-danger', disabled: busy, onClick: () => act(panel, {}, panel === 'remove' ? undefined : 'notice.reset') }, t('confirm.ok')),
                h('button', { type: 'button', className: 'pm-btn', onClick: () => setPanel(null) }, t('action.cancel'))))
            : h('div', { className: 'pm-actions' },
              canTry && !preset.broken ? h('button', { type: 'button', className: 'pm-btn pm-primary', onClick: () => ui.tryPreset(preset.id) }, t('action.try')) : null,
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
            if (success !== undefined) flash(presetId, success)
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
          workspace.startSession(undefined, { clearPreviousDraft: false, agentPreset: id })
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
