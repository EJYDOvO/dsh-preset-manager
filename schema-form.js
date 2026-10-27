/** Conservative literal form projection; all writes still go through native Host validation. */
const record = value => value && typeof value === 'object' && !Array.isArray(value)
export function schemaForm(document, limitations = []) {
  if (!record(document) || limitations.length) return null
  const literal = (node, seen = new Set()) => {
    if (!record(node) || seen.has(node)) return null
    seen = new Set(seen).add(node)
    if (node.$ref) {
      if (!node.$ref.startsWith('#/')) return null
      let target = document
      for (const key of node.$ref.slice(2).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'))) { if (!record(target) || !Object.hasOwn(target, key)) return null; target = target[key] }
      const resolved = literal(target, seen); return resolved && { ...resolved, ...Object.fromEntries(Object.entries(node).filter(([key]) => key !== '$ref')) }
    }
    if (node.anyOf) {
      const choices = node.anyOf.filter(branch => branch.$ref !== '#/$defs/loaderExpression')
      if (choices.length !== 1) return null
      const resolved = literal(choices[0], seen)
      return resolved && { ...resolved, ...Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'anyOf')) }
    }
    if (['oneOf','allOf','not','if','then','else','patternProperties'].some(key => Object.hasOwn(node, key))) return null
    if (Array.isArray(node.type)) {
      const types = node.type.filter(type => type !== 'null')
      if (types.length !== 1) return null
      return { ...node, type: types[0] }
    }
    return node
  }
  const root = literal(document)
  if (!root || root.type !== 'object' || !record(root.properties)) return null
  const fields = [], fallback = []
  for (const [key, value] of Object.entries(root.properties)) {
    const node = literal(value)
    if (!node || ['__proto__','prototype','constructor','__jsExpr'].includes(key)) { fallback.push(key); continue }
    let type = node.type
    if (node.enum?.length && node.enum.length <= 100 && node.enum.every(v => ['string','number','boolean'].includes(typeof v))) type = 'enum'
    if (!['string','integer','number','boolean','enum'].includes(type)) { fallback.push(key); continue }
    fields.push({ key, type, title: typeof node.title === 'string' ? node.title : key, description: typeof node.description === 'string' ? node.description : '', required: root.required?.includes(key) === true,
      ...Object.fromEntries(['enum','default','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern'].filter(k => node[k] !== undefined).map(k => [k, node[k]])) })
  }
  return fields.length ? { fields, fallback, additionalProperties: root.additionalProperties !== false } : null
}
