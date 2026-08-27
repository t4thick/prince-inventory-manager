export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function isIosSafari(): boolean {
  if (!isIos()) return false
  const ua = navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

const DISMISS_KEY = 'prince-install-dismissed'

export function shouldShowInstallPrompt(): boolean {
  if (typeof localStorage === 'undefined') return false
  if (isStandalone()) return false
  if (!isIosSafari()) return false
  return localStorage.getItem(DISMISS_KEY) !== '1'
}

export function dismissInstallPrompt() {
  localStorage.setItem(DISMISS_KEY, '1')
}
