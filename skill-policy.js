/**
 * The row that applies one mode's skill settings to the sessions of that mode.
 *
 * It registers a skill provider in the mode's own scope. For each skill the mode hides, the provider lists an entry
 * that neither the model nor the user may invoke; for each skill the mode pins to a saved version, it lists that
 * version. Its entries carry the lowest rank, so they win over every other provider in the same scope, and providers
 * of farther scopes lose to the mode's scope anyway. Skill files are never moved or changed.
 *
 * `config.preset` names the mode. The manager invalidates the provider after every change, so a session already
 * running in this mode receives a replacement skill catalog on its next model step.
 */

const PROVIDER = 'dsh-preset-manager'
/** Lower ranks win duplicate names within a scope; the filesystem provider uses 100–600. */
const RANK = -1000
const OFF_DESCRIPTION = 'Turned off in this mode by dsh-preset-manager.'

export const name = 'dsh-preset-manager-skills'
export const inject = ['skills']

function pinned(skill, version) {
  return {
    name: skill,
    description: version.meta.description,
    ...typeof version.meta.whenToUse === 'string' ? { whenToUse: version.meta.whenToUse } : {},
    invocation: version.meta.invocation ?? { modelInvocable: true, userInvocable: true },
    source: PROVIDER,
    provider: PROVIDER,
    path: version.file,
    resourceBase: { kind: 'directory', path: version.files },
  }
}

export function apply(ctx, config) {
  let warned = false
  const warn = (error) => {
    if (!warned) ctx.logger.warn(`skill settings of ${String(config.preset)} are not applied: ${error instanceof Error ? error.message : String(error)}`)
    warned = true
  }
  ctx.effect(() => ctx.skills.registerProvider((control) => {
    let stop
    const watch = () => {
      if (stop === undefined) stop = ctx.get('dshModes')?.watchSkills(() => control.invalidate())
    }
    control.signal.addEventListener('abort', () => stop?.())
    watch()
    return {
      name: PROVIDER,
      async list() {
        watch()
        const service = ctx.get('dshModes')
        if (service === undefined) return []
        try {
          const policy = await service.skillPolicy(config.preset)
          const candidates = [...policy.off].map(skill => ({
            name: skill,
            description: OFF_DESCRIPTION,
            invocation: { modelInvocable: false, userInvocable: false },
            source: PROVIDER,
            provider: PROVIDER,
            rank: RANK,
            locator: { kind: 'off' },
          }))
          for (const [skill, id] of policy.pins) {
            const version = await service.skillVersion(skill, id)
            if (version !== undefined) candidates.push({ ...pinned(skill, version), rank: RANK, locator: { kind: 'pin', version: id } })
          }
          for (const [skill, version] of await service.assignedSkills?.(config.preset) ?? []) {
            if (policy.off.has(skill) || policy.pins.has(skill)) continue
            candidates.push({ ...pinned(skill, version), rank: RANK, locator: { kind: 'assigned' } })
          }
          return candidates
        } catch (error) {
          warn(error)
          return []
        }
      },
      async get(candidate) {
        if (candidate.locator?.kind === 'assigned') {
          const version = await ctx.get('dshModes')?.assignedSkill(config.preset, candidate.name)
          return version === undefined ? undefined : { ...pinned(candidate.name, version), content: version.meta.content }
        }
        if (candidate.locator?.kind !== 'pin') return undefined
        const version = await ctx.get('dshModes')?.skillVersion(candidate.name, candidate.locator.version)
        return version === undefined ? undefined : { ...pinned(candidate.name, version), content: version.meta.content }
      },
    }
  }), 'dsh-preset-manager: skill policy')
}
