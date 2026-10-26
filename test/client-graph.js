/** Read only native boot JSON; do not execute inline scripts or invent unversioned resource URLs. */
export function clientEntryFromHtml(html, id) {
  const blocks = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(match => match[1])
  const block = blocks.find(text => /^\s*globalThis\["__DSH_BOOT__"\]\s*=/.test(text))
  if (!block) throw Error('Native boot graph is missing')
  const graph = JSON.parse(block.slice(block.indexOf('=') + 1).trim().replace(/;$/, ''))
  const entry = graph.entries?.find(item => item.id === id)
  if (!entry || typeof entry.url !== 'string' || typeof entry.rev !== 'string') throw Error('Client entry is not in the native graph')
  const base = 'http://127.0.0.1/', url = new URL(entry.url, base)
  if (!entry.url.startsWith('plugins/??') || url.origin !== new URL(base).origin || url.searchParams.get('rev') !== entry.rev) throw Error('Invalid advertised client resource')
  return entry
}
