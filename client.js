window.__ModuleLoader__.load({
  id: '@local/dsh-preset-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'preset-manager'
    const ROUTE = '/api/preset-manager'

    const ZH = {
      nav: '预设管理',
      title: '预设管理（原型）',
      note: '修改会写入当前 profile 的 cordis.patch.yml；正在运行的会话保持原配置，之后新建的会话使用新配置。',
      loading: '加载中…',
      refresh: '刷新',
      default: '默认',
      'source.builtin': '内置',
      'source.overridden': '已覆盖',
      'source.custom': '自定义',
      'source.external': '其他 bundle',
      expand: '插件',
      collapse: '收起',
      yaml: '查看 YAML',
      hideYaml: '隐藏 YAML',
      reset: '恢复内置',
      remove: '删除',
      conditional: '按条件',
      offByGroup: '所在分组已关闭',
      noId: '无 id，无法切换',
      createTitle: '新建自定义预设',
      createId: 'id（小写字母、数字、连字符）',
      createName: '显示名称（可选）',
      createFrom: '复制自',
      create: '新建',
      confirmRemove: '确定删除这个自定义预设？',
    }
    const EN = {
      nav: 'Preset manager',
      title: 'Preset manager (prototype)',
      note: 'Edits are written to this profile\'s cordis.patch.yml. Running sessions keep their composition; sessions created later use the new one.',
      loading: 'Loading…',
      refresh: 'Refresh',
      default: 'Default',
      'source.builtin': 'Built-in',
      'source.overridden': 'Overridden',
      'source.custom': 'Custom',
      'source.external': 'Other bundle',
      expand: 'Plugins',
      collapse: 'Collapse',
      yaml: 'View YAML',
      hideYaml: 'Hide YAML',
      reset: 'Restore built-in',
      remove: 'Delete',
      conditional: 'Conditional',
      offByGroup: 'Group is off',
      noId: 'No id; cannot toggle',
      createTitle: 'New custom preset',
      createId: 'id (lowercase letters, digits, hyphens)',
      createName: 'Display name (optional)',
      createFrom: 'Copy from',
      create: 'Create',
      confirmRemove: 'Delete this custom preset?',
    }

    async function call(action, payload) {
      const response = await fetch(ROUTE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const body = await response.json()
      if (body.ok !== true) throw new Error(body.error)
      return body.value
    }

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--dsw-alias-label-primary)', fontSize: 13 },
      muted: { color: 'var(--dsw-alias-label-secondary)' },
      card: { border: '1px solid var(--dsw-alias-border-l3)', borderRadius: 10, padding: 12, background: 'var(--dsw-alias-bg-layer-2)', display: 'flex', flexDirection: 'column', gap: 8 },
      head: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      badge: { fontSize: 11, padding: '1px 8px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l3)', color: 'var(--dsw-alias-label-secondary)' },
      button: { fontSize: 12, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l3)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer' },
      error: { color: 'var(--dsw-alias-state-error-primary)', whiteSpace: 'pre-wrap' },
      row: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderTop: '1px solid var(--dsw-alias-border-l4)' },
      pre: { margin: 0, maxHeight: 320, overflow: 'auto', fontSize: 12, padding: 8, borderRadius: 6, background: 'var(--dsw-alias-bg-layer-3)' },
      input: { fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l3)', background: 'transparent', color: 'var(--dsw-alias-label-primary)' },
    }

    function Switch({ checked, disabled, label, onChange }) {
      return h('button', {
        type: 'button', role: 'switch', 'aria-checked': checked, 'aria-label': label, disabled,
        onClick: () => onChange(!checked),
        style: {
          width: 32, height: 18, borderRadius: 999, border: 'none', padding: 2, flex: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
          background: checked ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)',
        },
      }, h('span', { style: { display: 'block', width: 14, height: 14, borderRadius: 999, background: '#fff', transform: checked ? 'translateX(14px)' : 'none', transition: 'transform .15s' } }))
    }

    function PluginRow({ t, row, busy, onToggle }) {
      const on = row.enabled ?? row.declared === true
      const blocked = row.id === null ? t('noId') : row.declared === 'conditional' ? `${t('conditional')}: ${row.condition ?? ''}` : row.inheritedOff ? t('offByGroup') : undefined
      return h('div', { style: S.row },
        h(Switch, { checked: on, disabled: busy || blocked !== undefined, label: row.module, onChange: enabled => onToggle(row.id, enabled) }),
        h('div', { style: { minWidth: 0, flex: 1 } },
          h('div', { style: { overflowWrap: 'anywhere' } }, row.module),
          h('div', { style: { ...S.muted, fontSize: 11, overflowWrap: 'anywhere' } }, [row.id ?? '—', blocked].filter(Boolean).join(' · '))))
    }

    function PresetCard({ t, preset, busy, run }) {
      const [open, setOpen] = React.useState(false)
      const [yaml, setYaml] = React.useState(null)
      const showYaml = () => {
        if (yaml !== null) { setYaml(null); return }
        run(() => call('read', { id: preset.id }).then(doc => { setYaml(doc.content) }), false)
      }
      return h('div', { style: S.card },
        h('div', { style: S.head },
          h('strong', null, preset.name ?? preset.id),
          h('code', { style: S.muted }, preset.id),
          h('span', { style: S.badge }, t(`source.${preset.source}`)),
          preset.isDefault ? h('span', { style: { ...S.badge, color: 'var(--dsw-alias-brand-primary)' } }, t('default')) : null,
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', style: S.button, onClick: () => setOpen(!open) }, open ? t('collapse') : `${t('expand')} (${preset.rows.length})`),
          h('button', { type: 'button', style: S.button, disabled: busy || preset.broken?.startsWith('Not registered'), onClick: showYaml }, yaml === null ? t('yaml') : t('hideYaml')),
          preset.source === 'overridden'
            ? h('button', { type: 'button', style: S.button, disabled: busy, onClick: () => run(() => call('reset', { id: preset.id })) }, t('reset'))
            : null,
          preset.source === 'custom'
            ? h('button', { type: 'button', style: { ...S.button, color: 'var(--dsw-alias-state-error-primary)' }, disabled: busy || preset.isDefault, onClick: () => { if (window.confirm(t('confirmRemove'))) run(() => call('remove', { id: preset.id })) } }, t('remove'))
            : null),
        preset.description ? h('div', { style: S.muted }, preset.description) : null,
        preset.broken ? h('div', { style: S.error }, preset.broken) : null,
        yaml === null ? null : h('pre', { style: S.pre }, yaml),
        open ? h('div', null, preset.rows.map((row, index) => h(PluginRow, {
          key: `${row.id ?? row.module}:${index}`, t, row, busy,
          onToggle: (rowId, enabled) => run(() => call('toggle', { id: preset.id, rowId, enabled })),
        }))) : null)
    }

    function CreateForm({ t, presets, busy, run }) {
      const [id, setId] = React.useState('')
      const [name, setName] = React.useState('')
      const [from, setFrom] = React.useState('standard')
      const submit = (event) => {
        event.preventDefault()
        run(() => call('create', { id, name, from }).then((value) => { setId(''); setName(''); return value }))
      }
      return h('form', { style: S.card, onSubmit: submit },
        h('strong', null, t('createTitle')),
        h('div', { style: { ...S.head, alignItems: 'stretch' } },
          h('input', { style: S.input, value: id, placeholder: t('createId'), 'aria-label': t('createId'), onChange: e => setId(e.target.value) }),
          h('input', { style: S.input, value: name, placeholder: t('createName'), 'aria-label': t('createName'), onChange: e => setName(e.target.value) }),
          h('label', { style: { ...S.head, ...S.muted } }, t('createFrom'),
            h('select', { style: S.input, value: from, onChange: e => setFrom(e.target.value) },
              presets.filter(p => p.rows.length > 0).map(p => h('option', { key: p.id, value: p.id }, p.name ?? p.id)))),
          h('button', { type: 'submit', style: S.button, disabled: busy || id === '' }, t('create'))))
    }

    function Page({ t }) {
      const [presets, setPresets] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const run = React.useCallback((task, replacesList = true) => {
        setBusy(true)
        setError(null)
        task()
          .then((value) => { if (replacesList) setPresets(value.presets) })
          .catch((reason) => { setError(reason instanceof Error ? reason.message : String(reason)) })
          .finally(() => { setBusy(false) })
      }, [])
      React.useEffect(() => { run(() => call('list')) }, [run])
      return h('div', { style: S.page },
        h('div', { style: S.head },
          h('h3', { style: { margin: 0, fontSize: 15 } }, t('title')),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', style: S.button, disabled: busy, onClick: () => run(() => call('list')) }, t('refresh'))),
        h('div', { style: S.muted }, t('note')),
        error === null ? null : h('div', { style: S.error, role: 'alert' }, error),
        presets === null ? h('div', { style: S.muted }, t('loading')) : [
          ...presets.map(preset => h(PresetCard, { key: preset.id, t, preset, busy, run })),
          h(CreateForm, { key: '__create', t, presets, busy, run }),
        ])
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
        }, () => h(Page, { t })))
      },
    }
  },
})
