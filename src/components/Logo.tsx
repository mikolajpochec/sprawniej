/** The Sprawniej mark: two chevrons moving forward in a rounded frame. */
export function Logo({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="26" height="26" rx="6" />
      <path d="m10 11 5 5-5 5" />
      <path d="m17 11 5 5-5 5" />
    </svg>
  )
}
