/**
 * The `mode_prompt` tool: lets the model read the system prompt of the mode its
 * session runs in, and save a new one after the user approves.
 *
 * Mounted as a row inside one mode, so only sessions of that mode see the tool.
 * Saving goes through the manager's own prompt save (variable checks, history,
 * conflict detection). Every save asks the user through the approval service; a
 * deployment without one, or with the `never` policy, refuses the save.
 */

const TOOL = 'mode_prompt'
const ACTIONS = ['read', 'replace', 'append']

export const name = 'dsh-preset-manager-prompt-tool'
export const inject = ['tools']

const DESCRIPTION = [
  'Read or change the system prompt of the mode this session runs in: the persona text that opens your system prompt in this mode.',
  '`read` returns the current text. `replace` saves `text` as the whole prompt; `append` adds `text` as a new paragraph at the end.',
  'Saving needs the user\'s approval. A saved prompt applies to new sessions in this mode; when the mode applies prompt changes live, it also applies to this session from its next step, and the result says which.',
  'Variables are written as {{name}} and must be ones the mode provides, such as {{model}}; an unknown variable is refused.',
].join(' ')

function modeOf(ctx, agent) {
  return agent === undefined ? undefined : ctx.get('agentPresets')?.composedPreset(agent.ctx)
}

function definition(ctx) {
  return {
    name: TOOL,
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ACTIONS, description: 'read | replace | append.' },
        text: { type: 'string', description: 'The prompt text to save (replace) or add (append). Not used by read.' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string' },
          prompt: { type: 'string' },
          saved: { type: 'boolean' },
          applies: { type: 'string', enum: ['next-step', 'new-sessions'] },
        },
        required: ['mode', 'prompt', 'saved'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: !value.saved
          ? `The system prompt of mode "${value.mode}":\n\n${value.prompt}`
          : value.applies === 'next-step'
            ? `Saved the system prompt of mode "${value.mode}". It applies to this session from the next step and to new sessions in this mode.`
            : `Saved the system prompt of mode "${value.mode}". New sessions in this mode use it; this session keeps its current prompt.`,
      }],
    },
    async execute(args, exec) {
      const action = args?.action
      if (!ACTIONS.includes(action)) throw new Error(`action must be one of ${ACTIONS.join(', ')}`)
      if (action !== 'read' && (typeof args.text !== 'string' || args.text.trim() === '')) throw new Error(`text is required for ${action}`)
      const service = ctx.get('dshModes')
      if (service === undefined) throw new Error('The mode prompt store is unavailable')
      const mode = modeOf(ctx, exec.agent)
      if (mode === undefined) throw new Error('This session does not run in a mode')
      const current = await service.promptText(mode)
      if (action === 'read') return { mode, prompt: current.prefix, saved: false }
      const prompt = action === 'replace' || current.prefix.trim() === '' ? args.text : `${current.prefix.replace(/\s+$/, '')}\n\n${args.text}`
      const result = await service.savePrompt(mode, prompt, current.prefix, 'chat')
      return { mode, prompt, saved: true, applies: result.live ? 'next-step' : 'new-sessions' }
    },
    presentCall: args => ({
      card: 'generic',
      title: args?.action === 'read' ? 'Read mode prompt' : 'Change mode prompt',
      kind: args?.action === 'read' ? 'read' : 'edit',
      rawInput: args,
    }),
  }
}

export function apply(ctx) {
  ctx.effect(() => ctx.tools.register(definition(ctx)), 'dsh-preset-manager: mode_prompt tool')
  ctx.on('tools/pre-execute', async (exec, next) => {
    const decision = await next()
    if (exec.name !== TOOL || decision.kind !== 'allow' || exec.arguments?.action === 'read') return decision
    const mode = modeOf(ctx, exec.agent) ?? 'unknown'
    return {
      kind: 'ask',
      reason: `${TOOL} saves a new system prompt for mode ${mode}`,
      displayReason: { en: `Save a new system prompt for mode "${mode}"`, zh: `为模式「${mode}」保存新的系统提示词` },
    }
  })
}
