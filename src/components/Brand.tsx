export function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`shop-brand ${compact ? 'compact' : ''}`}>
    <span className="brand-emblem" aria-hidden>PA<span> / </span></span>
    <span className="brand-name">PRINCE AMOFAH AUTOS<small>SUAME · KUMASI</small></span>
  </div>
}
