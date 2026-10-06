/**
 * The issue title on its page. Typing stays in the field and is saved a moment after you pause (or when you leave
 * the field), so a fast typist makes one change instead of one per key. A teammate's new title shows up as soon as
 * you're not typing in it.
 */
import { useEffect, useRef, useState } from 'react'
import { updateIssue } from '@/data/actions'

const SAVE_AFTER = 400

export function TitleField({ id, value }: { id: string; value: string }) {
  const [text, setText] = useState(value)
  const [focused, setFocused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(text)

  // someone else changed it while we weren't typing
  const [seen, setSeen] = useState(value)
  if (value !== seen && !focused) {
    setSeen(value)
    setText(value)
  }

  const save = () => {
    clearTimeout(timer.current)
    if (latest.current !== value) updateIssue(id, { title: latest.current })
  }
  // leaving the page while a save is waiting
  const saveRef = useRef(save)
  useEffect(() => {
    saveRef.current = save
  })
  useEffect(() => () => saveRef.current(), [])

  return (
    <textarea
      value={text}
      placeholder="Issue title"
      onChange={(e) => {
        const next = e.target.value.replace(/\n/g, ' ')
        setText(next)
        latest.current = next
        clearTimeout(timer.current)
        timer.current = setTimeout(save, SAVE_AFTER)
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        setSeen(latest.current)
        save()
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
      rows={1}
      className="field-sizing-content w-full resize-none bg-transparent text-2xl font-semibold leading-snug outline-none"
      aria-label="Title"
    />
  )
}
