/**
 * The row that applies a mode's tool description overrides to the requests of its sessions.
 *
 * It listens to `system-prompt/assemble`, whose output carries the tool definitions sent to the model, and replaces
 * the `description` of each overridden tool. Parameters and names are left alone, and nothing in the tool registry
 * changes, so removing an override gives back the built-in text. The overrides are read from the manager's saved
 * state on every assembly, so a save reaches sessions already running in this mode on their next model step; a
 * session started before this row joined the mode has no listener and sees the first override only in new sessions.
 *
 * `config.preset` names the mode whose overrides are read. The listener is registered first in its chain, so its
 * replacement runs after the listeners it wraps and a deliberate override is not rewritten by another plugin. The
 * code mode (`run_code`) lists tool descriptions inside its own prompt text, which this row does not rewrite.
 */

export const name = 'dsh-preset-manager-tool-descriptions'
export const inject = ['systemPrompt']

export function apply(ctx, config) {
  let warned = false
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const output = await next()
    if (!Array.isArray(output.tools)) return output
    const service = ctx.get('dshModes')
    if (service === undefined) return output
    let overrides
    try {
      service.observeTools(config.preset, output.tools)
      overrides = await service.toolDescriptions(config.preset)
    } catch (error) {
      if (!warned) ctx.logger.warn(`tool descriptions of ${String(config.preset)} are not applied: ${error instanceof Error ? error.message : String(error)}`)
      warned = true
      return output
    }
    if (overrides.size === 0) return output
    return {
      ...output,
      tools: output.tools.map(tool => (overrides.has(tool.name) ? { ...tool, description: overrides.get(tool.name) } : tool)),
    }
  }, { prepend: true })
}
