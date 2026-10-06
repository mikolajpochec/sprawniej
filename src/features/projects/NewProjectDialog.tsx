/** Start a project: emoji and name are enough; status, lead, target date and teams are optional chips. */
import { useState } from 'react'
import { useLocation } from 'wouter'
import { EmojiPicker } from '@/components/EmojiPicker'
import { createProject, type NewProject } from '@/data/actions'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { ProjectProperties } from './ProjectProperties'

type Draft = Required<NewProject>

export function NewProjectDialog({ onOpenChange, team }: { onOpenChange: (open: boolean) => void; team?: string }) {
  const [, navigate] = useLocation()
  const [draft, setDraft] = useState<Draft>({ name: '', emoji: '📦', description: '', status: 'planned', lead: null, teams: team ? [team] : [], targetDate: null })
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const ok = draft.name.trim().length > 0

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>A project is a bigger goal made of several issues. Its page shows how much is done.</DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ok) return
            const p = createProject(draft)
            onOpenChange(false)
            navigate(`/project/${p.id}`)
          }}
        >
          <div className="flex items-end gap-3">
            <EmojiPicker value={draft.emoji} onChange={(emoji) => set({ emoji })} />
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="New onboarding" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input id="project-description" value={draft.description} onChange={(e) => set({ description: e.target.value })} placeholder="What it’s about" />
          </div>
          <ProjectProperties value={draft} onChange={(patch) => set(patch as Partial<Draft>)} />
          <DialogFooter>
            <Button type="submit" disabled={!ok}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
