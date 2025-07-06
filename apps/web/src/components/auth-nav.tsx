'use client';

import { useSession, signIn, signOut } from "next-auth/react"

export function AuthNav() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <div className="px-4 py-2 text-slate-10">
        Loading...
      </div>
    )
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {session.user?.image && (
            <img 
              src={session.user.image} 
              alt="Profile" 
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-slate-12 font-medium">
            {session.user?.name || session.user?.email}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-full text-md font-medium bg-slate-12/10 text-slate-12 hover:bg-slate-12/20 transition-colors text-pretty"
        >
          Logout
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signIn('google')}
      className="px-6 py-1 rounded-full text-xl font-medium bg-slate-900/10 dark:bg-slate-200/30 text-slate-1 dark:text-slate-12 hover:bg-slate-11 transition-colors text-pretty hover:underline"
    >
      Login
    </button>
  )
} 