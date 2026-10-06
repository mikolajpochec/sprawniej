/** An issue title, with `backticks` shown as code. */
export function TitleText({ title }: { title: string }) {
  const parts = title.split(/(`[^`]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') && p.length > 2 ? (
          <code key={i} className="rounded border bg-muted px-1 font-mono text-[0.85em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  )
}
