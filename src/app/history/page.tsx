"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import {
  ArrowRight,
  Star,
  Search,
  Filter,
  Trash2,
  Calendar,
  Award,
  BarChart2,
  BookOpen,
  Sparkles,
  ArrowUpDown,
  LogIn,
  Layers,
  ChevronRight,
} from "lucide-react";

type InterviewHistory = {
  id: number;
  job_role: string;
  difficulty: string;
  language?: string;
  rating: number;
  summary?: string;
  created_at: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const CLEAN_BACKEND_URL = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<InterviewHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "highest" | "lowest">("newest");

  useEffect(() => {
    if (status === "loading") return;

    const email = session?.user?.email;
    const url = email
      ? `${CLEAN_BACKEND_URL}/api/history?email=${encodeURIComponent(email)}`
      : `${CLEAN_BACKEND_URL}/api/history`;

    const headers: Record<string, string> = {};
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }

    setLoading(true);
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setHistory([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load interview history:", err);
        setError("Unable to connect to the interview history service.");
        setLoading(false);
      });
  }, [session, status]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this interview record? This action cannot be undone.")) {
      return;
    }

    setDeletingId(id);
    try {
      const headers: Record<string, string> = {};
      if (session?.accessToken) {
        headers["Authorization"] = `Bearer ${session.accessToken}`;
      }

      const res = await fetch(`${CLEAN_BACKEND_URL}/api/history/${id}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert("Failed to delete interview record. Please try again.");
      }
    } catch (err) {
      console.error("Error deleting interview:", err);
      alert("Error connecting to server to delete interview.");
    } finally {
      setDeletingId(null);
    }
  };

  // Metrics calculations
  const metrics = useMemo(() => {
    if (history.length === 0) return { total: 0, avgRating: 0, topRole: "N/A", bestRating: 0 };

    const total = history.length;
    const ratedSessions = history.filter((h) => h.rating > 0);
    const avgRating =
      ratedSessions.length > 0
        ? (ratedSessions.reduce((acc, h) => acc + h.rating, 0) / ratedSessions.length).toFixed(1)
        : "0.0";

    const bestRating = Math.max(...history.map((h) => h.rating || 0));

    // Top role
    const roleCounts: Record<string, number> = {};
    history.forEach((h) => {
      roleCounts[h.job_role] = (roleCounts[h.job_role] || 0) + 1;
    });
    let topRole = "N/A";
    let maxCount = 0;
    for (const [role, count] of Object.entries(roleCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topRole = role;
      }
    }

    return { total, avgRating, topRole, bestRating };
  }, [history]);

  // Filtered & Sorted items
  const filteredHistory = useMemo(() => {
    return history
      .filter((item) => {
        const matchesSearch =
          item.job_role.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.summary && item.summary.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesDiff =
          selectedDifficulty === "all" ||
          item.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
        return matchesSearch && matchesDiff;
      })
      .sort((a, b) => {
        if (sortBy === "highest") return (b.rating || 0) - (a.rating || 0);
        if (sortBy === "lowest") return (a.rating || 0) - (b.rating || 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [history, searchQuery, selectedDifficulty, sortBy]);

  const getDifficultyBadge = (difficulty: string) => {
    const diff = difficulty.toLowerCase();
    if (diff === "easy") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (diff === "hard") {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  };

  const getScoreBadge = (rating: number) => {
    if (rating >= 8) {
      return {
        bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
        label: "Outstanding",
      };
    }
    if (rating >= 6) {
      return {
        bg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
        label: "Proficient",
      };
    }
    if (rating >= 4) {
      return {
        bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
        label: "Fair",
      };
    }
    return {
      bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      label: "Needs Practice",
    };
  };

  return (
    <div className="flex-1 w-full relative overflow-y-auto">
      <div className="bg-ambient" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Performance & History Hub
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Interview History
            </h1>
            <p className="text-slate-400 mt-2 text-sm sm:text-base max-w-2xl leading-relaxed">
              Review your complete mock interview records, AI evaluation rubrics, actionable feedback, and full spoken transcripts.
            </p>
          </div>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
          >
            Start New Interview
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Unauthenticated notification banner if applicable */}
        {status === "unauthenticated" && (
          <div className="mb-8 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Viewing recent test sessions</p>
                <p className="text-xs text-slate-400">
                  Sign in to link and persist your interview evaluations to your personal account.
                </p>
              </div>
            </div>
            <button
              onClick={() => signIn()}
              className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors shrink-0"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Analytics summary row */}
        {history.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Total Sessions</span>
                <Layers className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white">{metrics.total}</div>
              <p className="text-xs text-slate-500 mt-1">Interviews completed</p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Average Score</span>
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400/20" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-1">
                {metrics.avgRating}
                <span className="text-sm text-slate-500 font-normal">/10</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Across all roles</p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Top Score</span>
                <Award className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white flex items-baseline gap-1">
                {metrics.bestRating}
                <span className="text-sm text-slate-500 font-normal">/10</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Personal best</p>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs uppercase tracking-wider font-semibold">Primary Role</span>
                <BookOpen className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-white truncate" title={metrics.topRole}>
                {metrics.topRole}
              </div>
              <p className="text-xs text-slate-500 mt-1">Most practiced topic</p>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="glass-card p-4 rounded-xl border border-white/5 mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by role or feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/60 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end overflow-x-auto">
            {/* Difficulty Filter */}
            <div className="flex items-center gap-1 bg-slate-900/60 p-1 rounded-lg border border-white/5">
              {(["all", "easy", "normal", "hard"] as const).map((diff) => (
                <button
                  key={diff}
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                    selectedDifficulty === diff
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="newest">Newest First</option>
                <option value="highest">Highest Score</option>
                <option value="lowest">Lowest Score</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Loading your interview sessions...</p>
          </div>
        ) : error && history.length === 0 ? (
          <div className="p-8 rounded-2xl glass-card border border-rose-500/20 text-center max-w-xl mx-auto my-12">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Unable to Load History</h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <Link
              href="/"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium inline-block transition-colors"
            >
              Start New Mock Interview
            </Link>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center border border-white/5 my-8">
            <div className="w-16 h-16 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {history.length === 0 ? "No Mock Interviews Yet" : "No Matching Sessions Found"}
            </h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              {history.length === 0
                ? "You haven't conducted any mock interviews yet. Launch your first voice session powered by Gemini Live to practice in real time."
                : "No interview records matched your search query or difficulty filters. Try clearing your filters."}
            </p>
            {history.length === 0 ? (
              <Link
                href="/"
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium text-sm rounded-xl inline-flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
              >
                Start First Mock Interview
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedDifficulty("all");
                }}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-lg text-xs font-semibold transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredHistory.map((interview) => {
              const scoreInfo = getScoreBadge(interview.rating);
              const isDeleting = deletingId === interview.id;

              return (
                <Link
                  key={interview.id}
                  href={`/history/${interview.id}`}
                  className="group glass-card rounded-2xl p-6 border border-white/5 hover:border-indigo-500/40 hover:bg-slate-900/80 transition-all duration-200 block relative overflow-hidden"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    {/* Role & Metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5 mb-2">
                        <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                          {interview.job_role}
                        </h2>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold capitalize ${getDifficultyBadge(
                            interview.difficulty
                          )}`}
                        >
                          {interview.difficulty}
                        </span>
                        {interview.language && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 uppercase font-mono">
                            {interview.language}
                          </span>
                        )}
                      </div>

                      {interview.summary && (
                        <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed mb-3">
                          {interview.summary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(interview.created_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>•</span>
                        <span className="text-indigo-400 font-medium group-hover:underline">
                          View full evaluation & transcript
                        </span>
                      </div>
                    </div>

                    {/* Score & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`px-3.5 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[90px] ${scoreInfo.bg}`}
                        >
                          <div className="flex items-center gap-1 font-black text-xl leading-none">
                            <span>{interview.rating}</span>
                            <span className="text-xs opacity-60">/10</span>
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider mt-1 opacity-90">
                            {scoreInfo.label}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleDelete(interview.id, e)}
                          disabled={isDeleting}
                          title="Delete session"
                          className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl transition-all disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-500 transition-all">
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
