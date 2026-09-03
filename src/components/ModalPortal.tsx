import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  children: ReactNode
  onClose: () => void
  className?: string
}

export function ModalPortal({ children, onClose, className = '' }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const scrollY = window.scrollY
    const previous = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    }

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    function syncVisualViewport() {
      const viewport = window.visualViewport
      const backdrop = backdropRef.current
      if (!viewport || !backdrop) return

      backdrop.style.setProperty('--modal-viewport-height', `${viewport.height}px`)
      backdrop.style.setProperty('--modal-viewport-top', `${viewport.offsetTop}px`)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }

    syncVisualViewport()
    window.visualViewport?.addEventListener('resize', syncVisualViewport)
    window.visualViewport?.addEventListener('scroll', syncVisualViewport)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.visualViewport?.removeEventListener('resize', syncVisualViewport)
      window.visualViewport?.removeEventListener('scroll', syncVisualViewport)
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous.overflow
      document.body.style.position = previous.position
      document.body.style.top = previous.top
      document.body.style.width = previous.width
      window.scrollTo(0, scrollY)
    }
  }, [])

  return createPortal(
    <div
      ref={backdropRef}
      className={`modal-backdrop ${className}`.trim()}
      role="presentation"
    >
      {children}
    </div>,
    document.body,
  )
}
