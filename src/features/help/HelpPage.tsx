/** The user guide (docs/user-guide.md), shown inside the app for teammates who never open GitHub. */
import Markdown from 'react-markdown'
import guide from '../../../docs/user-guide.md?raw'
import { useCrumbs } from '@/app/chrome'

export function HelpPage() {
  useCrumbs([{ label: 'Help' }])
  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="prose-sprawniej mx-auto max-w-2xl">
        <Markdown>{guide}</Markdown>
      </div>
    </div>
  )
}
