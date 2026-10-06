/** "Open the issue and show this comment" (from the inbox): the comment list scrolls to it once it's on screen. */
let pending: string | null = null

export const jumpToComment = (id: string | undefined) => void (pending = id ?? null)

/** the comment to show, once */
export function takeJump(): string | null {
  const id = pending
  pending = null
  return id
}
