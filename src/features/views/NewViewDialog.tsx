/**
 * Make a saved view: an emoji, a name, and whose issues it shows (the whole workspace or one team). Filters come
 * along from the page you were on ("Save as view"), or you add them on the view afterwards.
 */
import { useState } from 'react'
import { useLocation } from 'wouter'
import { useShallow } from 'zustand/react/shallow'
import { EmojiPicker } from '@/components/EmojiPicker'
import { createView } from '@/data/actions'
import { DEFAULT_DISPLAY } from '@/data/displays'
import { useData } from '@/data/store'
import type { Display, Filters } from '@/model/schema'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'

const WORKSPACE = '__workspace'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: { team?: string | null; filters?: Filters; display?: Display }
  onCreated?: () => void
}

export function NewViewDialog({ open, onOpenChange, preset, onCreated }: Props) {
  const [, navigate] = useLocation()
  const teams = useData(useShallow((s) => Object.values(s.teams)))
  const [emoji, setEmoji] = useState('🔍')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState(preset?.team ?? WORKSPACE)
  const ok = name.trim().length > 0

  function create() {
    if (!ok) return
    const view = createView({
      name,
      emoji,
      description,
      team: scope === WORKSPACE ? null : scope,
      filters: preset?.filters,
      display: preset?.display ?? { ...DEFAULT_DISPLAY },
    })
    onCreated?.()
    onOpenChange(false)
    navigate(`/view/${view.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogTitle>New view</DialogTitle>
        <DialogDescription>A view is a saved set of filters, for everyone in the workspace. Pick an emoji so it’s easy to spot.</DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <div className="flex items-end gap-3">
            <EmojiPicker value={emoji} onChange={setEmoji} />
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="view-name">Name</Label>
              <Input id="view-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Open bugs" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-description">Description (optional)</Label>
            <Input id="view-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What it’s for" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Shows issues from</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger aria-label="Shows issues from">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORKSPACE}>The whole workspace</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.emoji} {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!ok}>
              Create view
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
