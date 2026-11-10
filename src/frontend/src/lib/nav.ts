export function getScrollElement(): HTMLElement | null {
  return document.getElementById('mr-reader-scroll')
}

export function scrollToHeading(id: string, smooth = true): void {
  const el = document.getElementById(id)
  const scroller = getScrollElement()
  if (!el || !scroller) return
  const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 24
  scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
}
