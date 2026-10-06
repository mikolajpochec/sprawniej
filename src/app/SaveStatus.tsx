/**
 * The small "Saved" chip. It speaks in everyday words: never commit, push or merge (see CLAUDE.md, writing).
 * Until syncing exists (milestone 1) it says the workspace is sample data.
 */
import { CloudCheck } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip'

export function SaveStatus() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CloudCheck className="size-4" />
          Sample data
        </span>
      </TooltipTrigger>
      <TooltipContent>You're looking at a made-up workspace. Changes are not kept.</TooltipContent>
    </Tooltip>
  )
}
