import { registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
const root = new URL('../', import.meta.url).href
const host = pathToFileURL(process.env.DSH_INSTALL_ROOT + '/resources/app.asar/dsh/package.json').href
registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(root) && specifier.startsWith('@deepseek-ai/')) return next(specifier, { ...context, parentURL: host })
  return next(specifier, context)
} })
