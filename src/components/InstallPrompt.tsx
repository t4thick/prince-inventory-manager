import { Share, X } from 'lucide-react'
import { dismissInstallPrompt } from '../lib/pwa'

type Props = {
  onClose: () => void
}

export function InstallPrompt({ onClose }: Props) {
  function close() {
    dismissInstallPrompt()
    onClose()
  }

  return (
    <div className="install-prompt" role="dialog" aria-labelledby="install-title">
      <button type="button" className="install-dismiss" onClick={close} aria-label="Dismiss">
        <X size={18} />
      </button>
      <div className="install-icon" aria-hidden>
        <Share size={22} />
      </div>
      <h2 id="install-title">Install on iPhone</h2>
      <p>Add Prince Auto to your Home Screen — opens full-screen like a native app.</p>
      <ol className="install-steps">
        <li>
          Tap <strong>Share</strong> <Share size={14} aria-hidden className="inline-icon" /> in Safari
        </li>
        <li>
          Scroll and tap <strong>Add to Home Screen</strong>
        </li>
        <li>Tap <strong>Add</strong></li>
      </ol>
      <button type="button" className="primary-btn install-btn" onClick={close}>
        Got it
      </button>
    </div>
  )
}
