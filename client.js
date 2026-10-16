window.__ModuleLoader__.load({
  id: '@local/dsh-preset-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'preset-manager'
    const ROUTE = '/api/preset-manager'
    const PRESET_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
    /** Copy keys the official Agent presets page registers for the four shipped presets. */
    const BUILT_IN_COPY = { standard: 'Standard', ptc: 'Ptc', minimal: 'Minimal', cordis: 'Cordis' }
    const NOTICE_MS = 2500
    /** Error-map key for the create form, which belongs to no preset card yet. */
    const CREATE_ERROR = '\0create'

    const ZH = {
      nav: '预设管理',
      title: '预设管理',
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
    }
    const EN = {
      nav: 'Preset manager',
      title: 'Preset manager',
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
.pm-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: .5px solid var(--dsw-alias-border-l4); }
.pm-group + .pm-row { border-top: 0; }
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
@container (max-width: 520px) {
  .pm-actions, .pm-body, .pm-confirm, .pm-yaml { margin-left: 0; padding-left: 14px; }
  .pm-yaml { margin: 0 14px 12px; }
  .pm-form { grid-template-columns: minmax(0, 1fr); }
}
`

    class ActionFailure extends Error {
      constructor(code, message) {
        super(message)
        this.code = code
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
      if (body.ok !== true) throw new ActionFailure(body.code ?? 'failed', body.error)
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

    function PluginRow({ ui, preset, row }) {
      const { t, text, pending, run } = ui
      const key = `row:${preset.id}:${row.id}`
      const title = text(row.meta?.title) ?? row.id ?? row.module
      const description = text(row.meta?.description)
      const on = row.enabled ?? row.declared === true
      const locked = row.id === null ? t('row.noId') : row.declared === 'conditional' ? t('row.conditional') : row.inheritedOff ? t('row.groupOff') : undefined
      return h('div', { className: 'pm-row' },
        row.meta?.icon
          ? h('img', { className: 'pm-icon', src: row.meta.icon, alt: '' })
          : h('span', { className: 'pm-icon', 'aria-hidden': true }, title.slice(0, 1).toUpperCase()),
        h('div', { className: 'pm-rowmain' },
          h('div', { className: 'pm-rowtitle' },
            h('span', null, title),
            row.changed ? h('span', { className: 'pm-badge is-warn' }, t('row.changed')) : null,
            row.changed && row.restorable
              ? h('button', { type: 'button', className: 'pm-link', disabled: pending.has(key), onClick: () => run(key, 'resetRow', { id: preset.id, rowId: row.id }, 'notice.saved') }, t('action.restoreRow'))
              : null,
            locked === undefined ? null : h('span', { className: 'pm-badge', title: row.condition }, locked)),
          description === undefined ? null : h('div', { className: 'pm-rowdesc' }, description),
          h('div', { className: 'pm-rowtech' }, row.id === null ? row.module : `${row.id} · ${row.module}`)),
        h(Switch, {
          checked: on, pending: pending.has(key), disabled: locked !== undefined, label: title,
          onChange: enabled => run(key, 'toggle', { id: preset.id, rowId: row.id, enabled }, 'notice.saved'),
        }))
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

    function PresetCard({ ui, preset, presets, query, onlyChanged, open, onOpen, onDuplicate }) {
      const { t, pending, run, notices, errors, canTry, canSetDefault } = ui
      const [panel, setPanel] = React.useState(null)
      const name = ui.presetName(preset)
      const description = ui.presetDescription(preset)
      const changed = preset.rows.filter(row => row.changed).length
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
              preset.broken ? h('span', { className: 'pm-badge is-error' }, t('badge.broken')) : null),
            description ? h('div', { className: 'pm-desc' }, description) : null,
            h('div', { className: 'pm-muted' }, t('summary', { on, total: preset.rows.length })),
            preset.broken ? h('div', { className: 'pm-error' }, preset.broken) : null,
            notice ? h('div', { className: 'pm-notice', role: 'status' }, `✓ ${t(notice)}`) : null,
            error ? h('div', { className: 'pm-error', role: 'alert' }, error) : null)),
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
              preset.rows.length > 0 ? h('button', { type: 'button', className: 'pm-btn', onClick: () => onDuplicate(preset.id) }, t('action.duplicate')) : null,
              h('button', { type: 'button', className: 'pm-btn', 'aria-pressed': panel === 'yaml', onClick: () => setPanel(panel === 'yaml' ? null : 'yaml') }, t(panel === 'yaml' ? 'action.hideYaml' : 'action.yaml')),
              preset.source === 'overridden' ? h('button', { type: 'button', className: 'pm-btn', disabled: busy, onClick: () => setPanel('reset') }, t('action.reset')) : null,
              preset.source === 'custom' ? h('button', { type: 'button', className: 'pm-btn', onClick: () => setPanel('details') }, t('action.rename')) : null,
              preset.source === 'custom' && !preset.isDefault ? h('button', { type: 'button', className: 'pm-btn pm-danger', onClick: () => setPanel('remove') }, t('action.remove')) : null),
        panel === 'yaml' ? h(Yaml, { ui, preset }) : null,
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
      const describe = error => (error instanceof ActionFailure && t(`err.${error.code}`) !== `err.${error.code}`) ? t(`err.${error.code}`) : error.message

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
        call('list').then(setData, (error) => { setPageError(describe(error)) })
      }
      React.useEffect(load, [])

      const workspace = ctx.get('uiWorkspace')
      const ui = {
        t, text, describe, pending, notices, errors, run,
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
          h('button', { type: 'button', className: 'pm-btn pm-primary', disabled: data === null, onClick: () => setCreating('standard') }, t('newPreset'))),
        h('p', { className: 'pm-intro' }, t('intro')),
        h('div', { className: 'pm-bar' },
          h('input', { className: 'pm-input pm-search', type: 'search', value: query, placeholder: t('search'), 'aria-label': t('search'), onChange: e => setQuery(e.target.value) }),
          h('label', { className: 'pm-check' },
            h('input', { type: 'checkbox', checked: onlyChanged, onChange: e => setOnlyChanged(e.target.checked) }),
            t('onlyChanged'))),
        pageError === null ? null : h('div', { className: 'pm-error', role: 'alert' }, pageError),
        creating === null ? null : h('div', { className: 'pm-card' },
          h(DetailsForm, {
            key: creating, ui, title: t('create.title'), initial: {}, presets, from: creating, withId: true, submitLabel: t('action.create'),
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
        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'preset-manager: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section',
          id: 'preset-manager',
          order: 21,
          label: () => t('nav'),
          locale: NS,
        }, props => h(Page, { ctx, t, close: props.close })))
      },
    }
  },
})
