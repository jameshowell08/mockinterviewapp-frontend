"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, History, Home } from "lucide-react";

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const isHomeActive = pathname === "/";
  const isHistoryActive = pathname.startsWith("/history");

  return (
    <nav className="w-full bg-slate-950/80 border-b border-white/10 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl flex items-center gap-2 text-white group">
            <span className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 group-hover:scale-105 transition-transform">
              <Home className="w-4 h-4 text-indigo-400" />
            </span>
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              MockInterview AI
            </span>
          </Link>

          <Link
            href="/history"
            className={`text-sm font-medium flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              isHistoryActive
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <History className="w-4 h-4" />
            History
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="w-20 h-8 bg-slate-800 rounded animate-pulse"></div>
          ) : session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 hidden sm:inline-block max-w-[180px] truncate bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/25 active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
