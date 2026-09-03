import { RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function PwaUpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const updateRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedsRefresh(true),
    })

    updateRef.current = () => updateServiceWorker(true)
  }, [])

  if (!needsRefresh) return null

  return (
    <aside className="update-prompt" role="status" aria-live="polite">
      <RefreshCw size={20} aria-hidden />
      <div>
        <strong>Update available</strong>
        <span>Refresh now to use the latest Prince Auto version.</span>
      </div>
      <button
        type="button"
        className="primary-btn"
        onClick={() => void updateRef.current()}
      >
        Update
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setNeedsRefresh(false)}
        aria-label="Dismiss update"
      >
        <X size={18} aria-hidden />
      </button>
    </aside>
  )
}
