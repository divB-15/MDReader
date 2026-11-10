import { useEffect, useRef } from 'react'
import { platform, joinPath } from '../lib/platform'
import { applySearch, clearSearch, focusHit } from '../lib/search'
import { scrollToHeading } from '../lib/nav'
import { useStore } from '../store'
import type { Doc } from '../lib/types'

interface GalleryItem {
  src: string
  alt: string
}

export default function Reader({ doc }: { doc: Doc }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<GalleryItem[]>([])
  const restoredRef = useRef(false)
  const saveTimer = useRef(0)
  const pendingJump = useRef(false)

  const ui = useStore((s) => s.ui)
  const setUI = useStore((s) => s.setUI)
  const openViewer = useStore((s) => s.openViewer)

  /* --------------------------------- restore --------------------------------- */

  useEffect(() => {
    if (doc.state !== 'ready' || restoredRef.current) return
    restoredRef.current = true
    const key = `mdreader:scroll:${doc.id}`
    const saved = Number(localStorage.getItem(key) || 0)
    if (saved > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: saved, behavior: 'auto' })
      })
    }
  }, [doc.state, doc.id])

  /* ------------------------------ scroll tracking ----------------------------- */

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const state = useStore.getState()
        const max = el.scrollHeight - el.clientHeight
        const progress = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0
        if (Math.abs(state.ui.progress - progress) > 0.004) state.setUI({ progress })

        // The outline follows the heading the reader is inside; before the first
        // heading scrolls past the top it is still the first one.
        let active = doc.headings.length ? doc.headings[0].id : ''
        for (const heading of doc.headings) {
          const node = document.getElementById(heading.id)
          if (!node) continue
          const top = node.getBoundingClientRect().top - el.getBoundingClientRect().top
          if (top <= 96) active = heading.id
          else break
        }
        if (doc.headings.length && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
          active = doc.headings[doc.headings.length - 1].id
        }
        if (active && state.ui.activeHeading !== active) state.setUI({ activeHeading: active })

        window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => {
          localStorage.setItem(`mdreader:scroll:${doc.id}`, String(Math.round(el.scrollTop)))
        }, 280)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
      window.clearTimeout(saveTimer.current)
    }
  }, [doc.id, doc.headings, doc.state])

  /* ---------------------------------- search --------------------------------- */

  useEffect(() => {
    const container = contentRef.current
    if (!container || doc.state !== 'ready') return
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      if (!ui.searchOpen || !ui.query.trim()) {
        clearSearch(container)
        pendingJump.current = false
        if (ui.hits !== 0 || ui.current !== 0) setUI({ hits: 0, current: 0 })
        return
      }
      const total = applySearch(container, ui.query)
      const current = total ? Math.min(Math.max(ui.current, 1), total) : 0
      const state = useStore.getState()
      if (total !== state.ui.hits || current !== state.ui.current) {
        state.setUI({ hits: total, current })
      }
      // A jump requested before the highlights existed is served here.
      if (pendingJump.current && total) {
        pendingJump.current = false
        focusHit(container, current || 1)
      }
    }, 130)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [doc.html, doc.state, ui.searchOpen, ui.query])

  useEffect(() => {
    const container = contentRef.current
    if (!container || !ui.searchOpen || ui.searchJump < 1) return
    if (container.querySelector(`mark[data-mr-hit]`)) {
      focusHit(container, Math.max(1, ui.current))
    } else {
      pendingJump.current = true
    }
  }, [ui.searchJump, ui.searchOpen])

  /* ---------------------------------- images ---------------------------------- */

  useEffect(() => {
    const container = contentRef.current
    if (!container || doc.state !== 'ready') return
    let cancelled = false
    const images = Array.from(container.querySelectorAll<HTMLImageElement>('img'))
    const gallery: GalleryItem[] = []
    galleryRef.current = gallery

    const register = (img: HTMLImageElement) => {
      const existing = img.getAttribute('src') || ''
      if (!existing) return
      const alt = img.getAttribute('alt') || img.getAttribute('title') || ''
      const entry = { src: existing, alt }
      img.dataset.mrGallery = String(gallery.length)
      gallery.push(entry)
      wrapFigure(img, alt)
    }

    const wrapFigure = (img: HTMLImageElement, alt: string) => {
      const parent = img.parentElement
      if (!parent || parent.tagName !== 'P') {
        img.classList.add('mr-img')
        return
      }
      const siblings = Array.from(parent.childNodes).filter(
        (n) => !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()),
      )
      if (siblings.length !== 1) {
        img.classList.add('mr-img')
        return
      }
      const figure = document.createElement('figure')
      figure.className = 'mr-figure'
      parent.parentNode?.insertBefore(figure, parent)
      figure.appendChild(img)
      img.classList.add('mr-img')
      if (alt) {
        const caption = document.createElement('figcaption')
        caption.textContent = alt
        figure.appendChild(caption)
      }
      parent.remove()
    }

    const resolve = async (img: HTMLImageElement) => {
      const rel = img.getAttribute('data-src') || ''
      img.removeAttribute('data-src')
      const url = await platform.readImage(doc, rel)
      if (cancelled) return
      if (!url) {
        img.classList.add('mr-img-broken')
        const fallback = img.getAttribute('alt') || '图片无法加载'
        img.after(createBrokenHint(fallback))
        return
      }
      img.src = url
      img.classList.add('mr-img')
      const alt = img.getAttribute('alt') || img.getAttribute('title') || ''
      img.dataset.mrGallery = String(gallery.length)
      gallery.push({ src: url, alt })
      wrapFigure(img, alt)
    }

    const createBrokenHint = (text: string) => {
      const note = document.createElement('div')
      note.className = 'mr-img-missing'
      note.textContent = `图片未找到：${text}`
      return note
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const img = entry.target as HTMLImageElement
          observer.unobserve(img)
          void resolve(img)
        }
      },
      { root: scrollRef.current, rootMargin: '900px 0px' },
    )

    for (const img of images) {
      if (img.hasAttribute('data-src')) {
        img.classList.add('mr-img-pending')
        observer.observe(img)
      } else {
        register(img)
      }
    }

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [doc.html, doc.state, doc.id])

  /* -------------------------------- interactions ------------------------------ */

  useEffect(() => {
    const container = contentRef.current
    if (!container) return

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const img = target.closest('img') as HTMLImageElement | null
      if (img) {
        const gallery = galleryRef.current.filter((item) => item.src)
        const index = Number(img.dataset.mrGallery)
        const resolvedIndex = gallery.indexOf(galleryRef.current[index])
        if (gallery.length && resolvedIndex >= 0) {
          openViewer(gallery, resolvedIndex)
        }
        return
      }

      const anchor = target.closest('a') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href') || ''
      if (!href) return

      if (href.startsWith('#')) {
        event.preventDefault()
        scrollToHeading(decodeURIComponent(href.slice(1)))
        return
      }
      if (/^(http|https|mailto|tel):/i.test(href)) {
        event.preventDefault()
        void platform.openExternal(href)
        return
      }

      event.preventDefault()
      const joined = joinPath(doc.dir, href)
      if (/\.(md|markdown|mdown|mkd|mdx|txt)$/i.test(href)) {
        window.dispatchEvent(new CustomEvent('mdreader:open-path', { detail: joined }))
      } else {
        // Local attachments are not opened through ShellExecute: a document
        // must not be able to launch an arbitrary executable on disk.
        useStore.getState().showToast('暂不支持打开这类本地附件')
      }
    }

    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [doc.dir, openViewer])

  /* ---------------------------------- render ---------------------------------- */

  return (
    <div id="mr-reader-scroll" ref={scrollRef} className="reader-scroll">
      <div className="reader">
        {doc.state === 'error' && (
          <div className="reader-error">
            <p>这份文档没能渲染出来。</p>
            <pre>{doc.error}</pre>
          </div>
        )}
        {doc.state === 'rendering' && doc.html === '' && <div className="reader-loading">排版中…</div>}
        <div
          className="markdown-body"
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      </div>
    </div>
  )
}
