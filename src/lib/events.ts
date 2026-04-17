type Listener = (data: unknown) => void

const listeners = new Map<string, Listener[]>()

export function emit(event: string, data?: unknown): void {
  const callbacks = listeners.get(event)
  if (!callbacks) return
  // copy array to avoid mutation during iteration
  callbacks.slice().forEach(cb => cb(data))
}

export function subscribe(event: string, callback: Listener): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, [])
  }
  listeners.get(event)!.push(callback)
  return () => {
    const callbacks = listeners.get(event)
    if (!callbacks) return
    const index = callbacks.indexOf(callback)
    if (index >= 0) callbacks.splice(index, 1)
  }
}