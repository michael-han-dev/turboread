'use client';
import { Footer } from '../../components/footer'

export default function Manifesto() {
  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Navigation */}
      <nav className="bg-slate-1/70 backdrop-blur-sm rounded-full p-1.5 shadow-md">
        <ul className="flex items-center">
          <li>
            <a
              href="/"
              className="px-6 py-2 rounded-full text-base font-medium text-slate-12 hover:bg-slate-12/10 transition-colors"
            >
              Waitlist
            </a>
          </li>
          <li>
            <a
              href="/manifesto"
              aria-current="page"
              className="px-6 py-2 rounded-full text-base font-medium bg-slate-12 text-slate-1 shadow-sm"
            >
              Manifesto
            </a>
          </li>
        </ul>
      </nav>

      {/* Manifesto content */}
      <div className="max-w-[800px] mx-auto w-full bg-gray-1/85 backdrop-blur-md rounded-2xl shadow-lg p-12 text-center space-y-6">
        <h1 className="text-4xl font-medium text-slate-12 font-['var(--font-instrument-serif)']">TurboRead Manifesto</h1>
        <p className="text-lg text-slate-10 leading-relaxed">
          TurboRead is on a mission to help everyone read faster, understand deeper, and learn more efficiently.
          We believe technology should augment human cognition—turning dense documents into bite-sized insights and
          freeing your time for what matters most.
        </p>
        <p className="text-lg text-slate-10 leading-relaxed">
          By combining AI-powered summarisation, smart highlights, and voice playback, TurboRead lets you consume
          knowledge at the speed of thought. Join us on this journey—because the world moves fast, and your reading
          should keep up.
        </p>
        <p className="text-lg text-slate-11 font-medium">— The TurboRead Team</p>
      </div>
      <Footer />
    </div>
  );
}
