/**
 * Holds user-created presets as `config.presets` and registers each one on the
 * registry, the same call `@deepseek-ai/dsh-agent-preset` makes per row.
 * A registration failure (duplicate id, invalid row list) is logged and the
 * remaining presets still register; the manager reports the missing id.
 */

/** Keeps child `!!js` literal until each preset's own rows load (EntryGroup.key). */
const GROUP = Symbol.for('cordis.group')
/** Cordis startup hook (Service.init); each yielded disposer unregisters one preset. */
const INIT = Symbol.for('cordis.init')

export default class CustomPresets {
  static inject = ['agentPresets']
  static [GROUP] = true

  constructor(ctx, config) {
    this.ctx = ctx
    this.presets = Array.isArray(config?.presets) ? config.presets : []
  }

  async* [INIT]() {
    for (const preset of this.presets) {
      try {
        yield await this.ctx.agentPresets.register(preset)
      } catch (error) {
        this.ctx.logger.warn(`custom preset ${String(preset?.id)}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
}
