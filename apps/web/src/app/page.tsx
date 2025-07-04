'use client';

import { InputForm } from "../components/waitlist-form";
import { Footer } from '../components/footer'

async function submitWaitlist(formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
  
  const email = formData.get('email') as string;
  
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { success: true };
}

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-8 w-full">
      {/* Navigation */}
      <nav className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-sm rounded-full p-1.5 shadow-md">
        <ul className="flex items-center">
          <li>
            <a
              href="/"
              aria-current="page"
              className="px-6 py-2 rounded-full text-lg font-medium bg-slate-12 text-slate-1 shadow-sm"
            >
              Waitlist
            </a>
          </li>
          <li>
            <a
              href="/manifesto"
              className="px-6 py-2 rounded-full text-lg font-medium text-slate-12 hover:bg-slate-12/10 transition-colors"
            >
              Manifesto
            </a>
          </li>
        </ul>
      </nav>

      {/* Card */}
      <div className="w-full mx-auto max-w-[800px] flex flex-col bg-white/10 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-2xl">
        <div className="flex flex-col items-center gap-8 flex-1 text-center w-full p-12 pb-0">
          <div className="space-y-3">
            <h1 className="text-5xl font-medium text-slate-12 whitespace-pre-wrap text-pretty italic font-serif">
              TurboRead
            </h1>
            <p className="text-2xl text-slate-10 tracking-tight text-pretty max-w-[600px]">
              Speed-read your documents or anything on the web with highlighting and voice assistance (coming soon!).
            </p>
          </div>
          <div className="px-1 py-4 flex flex-col w-full max-w-[500px]">
            <InputForm
              {...{
                type: "email" as const,
                placeholder: "Enter your email",
                name: "email",
              }}
              formAction={submitWaitlist}
              buttonCopy={{
                idle: "Join Waitlist",
                loading: "Joining...",
                success: "Joined!",
              }}
            />
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
