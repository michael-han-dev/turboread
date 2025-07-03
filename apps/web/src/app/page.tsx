'use client';

import { InputForm } from "../components/waitlist-form";

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
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Navigation */}
      <nav className="bg-slate-1/70 backdrop-blur-sm rounded-full p-1 shadow-md">
        <ul className="flex items-center">
          <li>
            <a
              href="/"
              aria-current="page"
              className="px-4 py-1 rounded-full text-sm font-medium bg-slate-12 text-slate-1 shadow-sm"
            >
              Waitlist
            </a>
          </li>
          <li>
            <a
              href="/manifesto"
              className="px-4 py-1 rounded-full text-sm font-medium text-slate-12 hover:bg-slate-12/10 transition-colors"
            >
              Manifesto
            </a>
          </li>
        </ul>
      </nav>

      {/* Card */}
      <div className="w-full mx-auto max-w-[500px] flex flex-col justify-center items-center bg-gray-1/85 backdrop-blur-md pb-0 overflow-hidden rounded-2xl shadow-lg">
        <div className="flex flex-col items-center gap-4 flex-1 text-center w-full p-8 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-medium text-slate-12 whitespace-pre-wrap text-pretty">
              (check)TurboRead
            </h1>
            <p className="text-slate-10 tracking-tight text-pretty">
              Speed-read your documents with AI-powered highlighting and voice assistance.
            </p>
          </div>
          <div className="px-1 flex flex-col w-full self-stretch">
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
      </div>
    </div>
  );
}
