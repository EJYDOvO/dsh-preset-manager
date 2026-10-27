import z from '@deepseek-ai/schemastery'
export const inject = ['tools']
export const Config = z.object({ count: z.natural().min(1).default(1), enabled: z.boolean().default(true), nested: z.object({ note:z.string() }).default({note:''}) })
export function apply(ctx, config) {
  ctx.tools.register({ name: 'pm_fixture', description: 'Isolated Preset Manager fixture', parameters: {}, output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: value }] }, execute: async () => String(config.count) })
}
