let mounts = 0
export function apply() { if (++mounts === 2) throw Error('Fails only when the validated composition is actually saved') }
