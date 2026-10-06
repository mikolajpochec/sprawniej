/**
 * The rich text editor for descriptions and comments. It formats as you type (**bold**, "- " lists, "[] " checklists,
 * ``` code), turns pasted links into links (paste a link onto selected words to link them), and stores plain Markdown.
 *
 * Saving: `onChange` gets the Markdown a moment after you stop typing, and at once when you leave the field.
 * A teammate's change shows up here too, unless you're typing in this field right now.
 */
import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { cn } from '@/lib/utils'
import { MentionSuggest } from './MentionSuggest'
import { References } from './references'
import { tidyMarkdown } from './tidy'

const lowlight = createLowlight(common)

const SAVE_AFTER = 400

interface Props {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  /** ⌘/Ctrl + Enter */
  onSubmit?: () => void
  /** the field's accessible name */
  label?: string
}

export function Editor({ value, onChange, placeholder = 'Add a description…', autoFocus, className, onSubmit, label = 'Description' }: Props) {
  const lastSent = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const changeRef = useRef(onChange)
  const submitRef = useRef(onSubmit)
  useEffect(() => {
    changeRef.current = onChange
    submitRef.current = onSubmit
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Markdown,
      References,
      MentionSuggest,
    ],
    content: value,
    contentType: 'markdown',
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'prose-sprawniej tiptap-editor outline-none', 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && submitRef.current) {
          flush()
          submitRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_AFTER)
    },
    onBlur: () => flush(),
  })

  function flush() {
    clearTimeout(timer.current)
    if (!editor || editor.isDestroyed) return
    const md = tidyMarkdown(editor.getMarkdown())
    if (md === lastSent.current) return
    lastSent.current = md
    changeRef.current(md)
  }

  // leaving the page while a save is waiting: send it now
  useEffect(() => () => flush(), [editor]) // oxlint-disable-line react-hooks/exhaustive-deps

  // someone else changed it (or another field did): show the new text unless you're typing here
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === lastSent.current || editor.isFocused) return
    lastSent.current = value
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  }, [value, editor])

  return <EditorContent editor={editor} className={cn('min-h-24 cursor-text', className)} />
}
