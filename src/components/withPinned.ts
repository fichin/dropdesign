/**
 * The indexes a virtualized list renders: the virtualizer's own (the items near the screen),
 * plus `pinned` ones that must stay in the page wherever they are. Sorted, so the page keeps
 * the list's order (and Tab moves through it in order), and without duplicates.
 * Out-of-range pins (-1 when there's nothing to pin) are ignored.
 */
export function withPinned(indexes: number[], pinned: number[], count: number) {
  const extra = pinned.filter((index) => index >= 0 && index < count && !indexes.includes(index))
  return extra.length ? [...new Set([...indexes, ...extra])].sort((a, b) => a - b) : indexes
}
