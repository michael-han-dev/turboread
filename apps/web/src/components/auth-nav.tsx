'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import clsx from "clsx"; // Optional but cleaner class merging

export function AuthNav({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className={clsx("px-4 py-2 text-slate-10", className)}>
        Loading...
      </div>
    );
  }

  if (session) {
    return (
      <div className={clsx("flex items-center gap-4", className)}>
        <div className="flex items-center gap-2">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt="Profile"
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-slate-12 text-md font-medium">
            {session.user?.name || session.user?.email}
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="px-4 py-2 rounded-full text-md font-medium bg-slate-12/10 text-slate-12 hover:bg-slate-12/20 hover:underline transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className={clsx(
        "px-6 py-1 rounded-full text-md font-medium bg-slate-900/10 dark:bg-slate-200/30 text-slate-1 dark:text-slate-12 hover:bg-slate-11 transition-colors hover:underline",
        className
      )}
    >
      Login
    </button>
  );
}
