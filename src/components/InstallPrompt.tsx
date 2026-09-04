import { Share, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { dismissInstallPrompt } from '../lib/pwa'

type Props = {
  onClose: () => void
}

export function InstallPrompt({ onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => {
    dismissInstallPrompt()
    onClose()
  }, [onClose])

  useEffect(() => {
    closeButtonRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab') return

      const first = closeButtonRef.current
      const last = confirmButtonRef.current
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close])

  return (
    <div
      className="install-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      aria-describedby="install-description"
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="install-dismiss"
        onClick={close}
        aria-label="Dismiss install instructions"
      >
        <X size={18} />
      </button>
      <div className="install-icon" aria-hidden>
        <Share size={22} />
      </div>
      <h2 id="install-title">Install on iPhone</h2>
      <p id="install-description">Add PRINCE AMOFAH AUTOS to your Home Screen — opens full-screen like a native app.</p>
      <ol className="install-steps">
        <li>
          Tap <strong>Share</strong> <Share size={14} aria-hidden className="inline-icon" /> in Safari
        </li>
        <li>
          Scroll and tap <strong>Add to Home Screen</strong>
        </li>
        <li>Tap <strong>Add</strong></li>
      </ol>
      <button ref={confirmButtonRef} type="button" className="primary-btn install-btn" onClick={close}>
        Got it
      </button>
    </div>
  )
}
