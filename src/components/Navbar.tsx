"use client";

import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, History, Home } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="w-full bg-slate-900/50 border-b border-white/5 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl flex items-center gap-2 text-white">
            <Home className="w-5 h-5 text-indigo-400" />
            MockInterview AI
          </Link>
          
          {status === "authenticated" && (
            <Link 
              href="/history" 
              className="text-sm font-medium text-slate-300 hover:text-white flex items-center gap-2 transition-colors"
            >
              <History className="w-4 h-4" />
              History
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-20 h-8 bg-slate-800 rounded animate-pulse"></div>
          ) : session ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400 hidden sm:inline-block">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-lg shadow-indigo-500/20"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
