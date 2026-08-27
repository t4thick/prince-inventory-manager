const QUEUE_KEY = 'prince-offline-sales'

export type OfflineSalePayload = {
  p_id: string
  p_items: unknown
  p_total: number
  p_payment_method: string
  p_created_at: string
  p_worker_id: string
  p_worker_name: string
  p_customer_name: string
  p_vehicle_info: string
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function readQueue(): OfflineSalePayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflineSalePayload[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(items: OfflineSalePayload[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
}

export function enqueueOfflineSale(payload: OfflineSalePayload) {
  writeQueue([...readQueue(), payload])
}

export function pendingOfflineCount(): number {
  return readQueue().length
}

export async function drainOfflineQueue(
  submit: (payload: OfflineSalePayload) => Promise<boolean>,
): Promise<{ synced: number; remaining: number }> {
  const queue = readQueue()
  if (queue.length === 0) return { synced: 0, remaining: 0 }

  let synced = 0
  const remaining: OfflineSalePayload[] = []

  for (const item of queue) {
    const ok = await submit(item)
    if (ok) synced += 1
    else remaining.push(item)
  }

  writeQueue(remaining)
  return { synced, remaining: remaining.length }
}
