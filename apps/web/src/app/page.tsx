'use client';
import { Footer } from '../components/footer'
import { AuthNav } from '../components/auth-nav'

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Navigation */}
      <nav className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-sm rounded-full p-1.5 shadow-md">
        <div className="flex items-center justify-between gap-4">
          <ul className="flex items-center">
            <li>
              <a
                href="/"
                aria-current="page"
                className="px-6 py-2 rounded-full text-lg font-medium bg-slate-12 text-slate-1 shadow-sm"
              >
                Home
              </a>
            </li>
            <li>
              <a
                href="/manifesto"
                className="px-6 py-2 rounded-full text-lg font-medium text-slate-12 hover:bg-slate-12/10 transition-colors"
              >
                Demo
              </a>
            </li>
          </ul>
        </div>
      </nav>

      {/* Card */}
      <div className="w-full mx-auto max-w-[800px] flex flex-col bg-white/10 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center gap-4 flex-1 text-center w-full p-12 pb-0">
          <div className="space-y-3">
            <h1 className="text-5xl font-medium text-slate-12 whitespace-pre-wrap text-pretty italic font-serif">
              TurboRead
            </h1>
            <p className="text-2xl text-slate-10 tracking-tight text-pretty max-w-[600px]">
              Speed-read your documents or anything on the web with highlighting and voice assistance (coming soon!).
            </p>
          </div>
          <div className="px-1 py-4 mb-4 items-center flex flex-col w-full max-w-[500px]">
            <AuthNav />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
