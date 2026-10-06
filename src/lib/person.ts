/** Initials and a stable colour for people without a picture. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function personColor(login: string): string {
  let h = 0
  for (const ch of login.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 50% 42%)`
}
