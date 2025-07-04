'use client'

import { ThemeSwitcher } from './switch-theme'

export function Footer() {
  return (
    <footer className="flex justify-between items-center w-full px-8 py-3 text-md bg-gray-12/5 rounded-b-2xl">
      <span className="text-slate-10">
        © 2025 TurboRead: Follow on{' '}
        <a href="https://x.com/michaelyhan_" target="_blank" className="underline font-large text-slate-12">
          X
        </a>
      </span>
      <ThemeSwitcher />
    </footer>
  )
}
