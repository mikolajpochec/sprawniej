/** Shows Markdown as formatted text. The formatter loads the first time it's needed; until then the text shows as-is. */
import { lazy, Suspense } from 'react'

const ReactMarkdown = lazy(() => import('react-markdown'))

export function Markdown({ children }: { children: string }) {
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </Suspense>
  )
}
