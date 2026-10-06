/** Shows Markdown as formatted text. The formatter loads the first time it's needed; until then the text shows as-is. */
import { lazy, Suspense, type ComponentProps } from 'react'
import { assetUrl } from '@/data/assets'
import { linkReferences } from '@/data/mentions'
import { findByRef, useData } from '@/data/store'

const ReactMarkdown = lazy(() => import('react-markdown'))

/** @people and ENG-12 references look the same as in the editor; other links open in a new tab */
function A({ href = '', children, node: _node, ...rest }: ComponentProps<'a'> & { node?: unknown }) {
  if (href.startsWith('#@')) return <span className="mention">{children}</span>
  if (href.startsWith('#/issue/')) return <a href={href} className="issue-ref no-underline" title={findByRef(useData.getState().issues, href.slice(8))?.title}>{children}</a>
  return <a href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>
}

/** workspace pictures show from the app's own copy */
function Img({ src, alt }: ComponentProps<'img'> & { node?: unknown }) {
  return <img src={assetUrl(typeof src === 'string' ? src : undefined)} alt={alt ?? ''} loading="lazy" />
}

/** `references`: highlight @people and issue references (comments, descriptions) */
export function Markdown({ children, references }: { children: string; references?: boolean }) {
  // a string, so this only redraws when the result changes
  const text = useData((s) => (references ? linkReferences(children, s.people, (ref) => !!findByRef(s.issues, ref)) : children))
  return (
    <Suspense fallback={<p className="whitespace-pre-wrap">{children}</p>}>
      <ReactMarkdown components={{ a: A, img: Img }}>{text}</ReactMarkdown>
    </Suspense>
  )
}
