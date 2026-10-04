interface HighlightProps {
  text: string
  /** Lowercased search text; every case-insensitive occurrence is wrapped in <mark> */
  search: string
}

/** Text with the parts matching the search marked */
function Highlight({ text, search }: HighlightProps) {
  if (!search) return text
  const lower = text.toLowerCase()
  const parts: { text: string; match: boolean }[] = []
  let from = 0
  for (let at = lower.indexOf(search); at !== -1; at = lower.indexOf(search, at + search.length)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false })
    parts.push({ text: text.slice(at, at + search.length), match: true })
    from = at + search.length
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false })
  return (
    <>
      {parts.map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : part.text))}
    </>
  )
}

export default Highlight
