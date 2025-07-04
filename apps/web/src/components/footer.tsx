'use client'

import { ThemeSwitcher } from './switch-theme'

export function Footer() {
  return (
    <footer className="flex justify-between items-center w-full px-12 py-6 text-large border-t border-gray-12/10">
      <span className="text-slate-10">
        © 2025 TurboRead: Follow on{' '}
        <a href="https://x.com/michaelyhan_" target="_blank" className="underline font-xl text-slate-12">
          X
        </a>
      </span>
      <ThemeSwitcher />
    </footer>
  )
}
