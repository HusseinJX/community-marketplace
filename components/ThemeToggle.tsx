'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

export const THEME_KEY = 'wl_theme'

// Light/dark toggle. Defaults to the OS preference; an explicit choice is
// remembered. The class goes on <html> (`.dark`), which the CSS layer in
// globals.css keys off — see the "Dark mode" block there.
//
// The no-flash init runs BEFORE paint (inline script in app/layout.tsx), so this
// component only handles the click; it reads the class that's already applied
// rather than deciding the theme itself.
export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
    setReady(true)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      /* private mode — the choice just won't persist */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
    >
      {/* Until mounted we don't know the theme — render the icon invisibly so the
          button doesn't jump or show the wrong state on hydration. */}
      <span className={ready ? '' : 'opacity-0'}>
        {dark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </span>
    </button>
  )
}
