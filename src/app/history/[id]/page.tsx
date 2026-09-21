"use client";

import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Star,
  ThumbsUp,
  TrendingUp,
  Clock,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Search,
  MessageSquare,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  ChevronRight,
  Share2,
} from "lucide-react";

type TranscriptLine = {
  id?: number;
  role: string;
  text: string;
};

type InterviewDetail = {
  id: number;
  job_role: string;
  difficulty: string;
  language?: string;
  summary: string;
  rating: number;
  strengths: string[];
  improvements: string[];
  created_at: string;
  transcripts: TranscriptLine[];
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
const CLEAN_BACKEND_URL = BACKEND_URL.endsWith("/") ? BACKEND_URL.slice(0, -1) : BACKEND_URL;

// Circular SVG Rating Gauge
function RatingGauge({ rating }: { rating: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(Math.max((rating || 0) / 10, 0.05), 1);

  return (
    <div className="relative flex flex-col items-center justify-center w-36 h-36 shrink-0">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="url(#detailGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="detailGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f8fff" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-black text-white leading-none tracking-tight">
          {rating}
        </span>
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
          out of 10
        </span>
      </div>
    </div>
  );
}

export default function InterviewDetailPage() {
  const { data: session, status } = useSession();
  const { id } = useParams();
  const router = useRouter();

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"evaluation" | "transcript">("evaluation");
  const [copied, setCopied] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;

    const headers: Record<string, string> = {};
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    }

    setLoading(true);
    fetch(`${CLEAN_BACKEND_URL}/api/history/${id}`, { headers })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("Interview session not found.");
          throw new Error(`Failed to load interview details (Status: ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setInterview(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || "Failed to connect to backend server.");
        setLoading(false);
      });
  }, [id, session]);

  const handleCopyTranscript = () => {
    if (!interview || !interview.transcripts.length) return;

    const text = interview.transcripts
      .map(
        (t) =>
          `[${t.role === "user" ? "Candidate" : "Interviewer"}]:\n${t.text}\n`
      )
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this interview record? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
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
        router.push("/history");
      } else {
        alert("Failed to delete interview session.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting interview session.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter transcripts by search
  const filteredTranscripts = useMemo(() => {
    if (!interview?.transcripts) return [];
    if (!transcriptSearch.trim()) return interview.transcripts;
    const q = transcriptSearch.toLowerCase();
    return interview.transcripts.filter((t) => t.text.toLowerCase().includes(q));
  }, [interview?.transcripts, transcriptSearch]);

  // Transcript stats
  const transcriptStats = useMemo(() => {
    if (!interview?.transcripts) return { total: 0, userTurns: 0, botTurns: 0 };
    const userTurns = interview.transcripts.filter((t) => t.role === "user").length;
    const botTurns = interview.transcripts.filter((t) => t.role === "interviewer").length;
    return { total: interview.transcripts.length, userTurns, botTurns };
  }, [interview?.transcripts]);

  const getDifficultyBadge = (difficulty: string) => {
    const diff = (difficulty || "").toLowerCase();
    if (diff === "easy") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (diff === "hard") return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  };

  const getPerformanceFeedback = (rating: number) => {
    if (rating >= 8) {
      return {
        badge: "Outstanding Candidate",
        badgeClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
        message: "Demonstrated strong domain mastery, structured articulation, and high confidence.",
      };
    }
    if (rating >= 6) {
      return {
        badge: "Proficient Performance",
        badgeClass: "bg-blue-500/15 border-blue-500/30 text-blue-400",
        message: "Clear technical fundamentals with opportunities for deeper behavioral examples.",
      };
    }
    if (rating >= 4) {
      return {
        badge: "Fair Competency",
        badgeClass: "bg-amber-500/15 border-amber-500/30 text-amber-400",
        message: "Addressed questions basically; needs more substantive answers and STAR format structure.",
      };
    }
    return {
      badge: "Needs Practice",
      badgeClass: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      message: "Focus on conversational flow, domain preparation, and full technical responses.",
    };
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <div className="w-10 h-10 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading interview evaluation & transcript...</p>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass-card max-w-lg w-full p-8 text-center rounded-2xl border border-rose-500/20">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Interview Not Found</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {error || "The requested interview session could not be retrieved or has been removed."}
          </p>
          <Link
            href="/history"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Interview History
          </Link>
        </div>
      </div>
    );
  }

  const performance = getPerformanceFeedback(interview.rating);

  return (
    <div className="flex-1 w-full relative overflow-y-auto">
      <div className="bg-ambient" />

      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12 relative z-10">
        {/* Navigation Breadcrumb & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <Link
            href="/history"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors group"
          >
            <span className="p-1 rounded-lg bg-white/5 group-hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </span>
            Back to History
          </Link>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            {/* Copy Transcript Button */}
            <button
              onClick={handleCopyTranscript}
              disabled={!interview.transcripts.length}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all disabled:opacity-40"
              title="Copy entire transcript to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied Transcript!" : "Copy Transcript"}
            </button>

            {/* Re-practice Button */}
            <Link
              href={`/?role=${encodeURIComponent(interview.job_role)}&difficulty=${encodeURIComponent(
                interview.difficulty
              )}`}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Practice Again
            </Link>

            {/* Delete Button */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/20 transition-all disabled:opacity-50"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hero Card: Role, Score, Overview */}
        <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/10 mb-8 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span
                  className={`text-xs px-3 py-1 rounded-full border font-semibold capitalize ${getDifficultyBadge(
                    interview.difficulty
                  )}`}
                >
                  {interview.difficulty} difficulty
                </span>
                {interview.language && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono uppercase">
                    {interview.language === "en" ? "English" : interview.language === "id" ? "Indonesian" : interview.language}
                  </span>
                )}
                <span
                  className={`text-xs px-3 py-1 rounded-full border font-semibold ${performance.badgeClass}`}
                >
                  {performance.badge}
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
                {interview.job_role}
              </h1>

              <p className="text-slate-400 text-sm leading-relaxed mb-4 max-w-2xl">
                {performance.message}
              </p>

              <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(interview.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(interview.created_at).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  {interview.transcripts?.length || 0} conversation turns recorded
                </span>
              </div>
            </div>

            {/* Circular Gauge */}
            <div className="flex items-center justify-center lg:justify-end">
              <RatingGauge rating={interview.rating} />
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 mb-8">
          <button
            onClick={() => setActiveTab("evaluation")}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
              activeTab === "evaluation"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Evaluation & Feedback
          </button>

          <button
            onClick={() => setActiveTab("transcript")}
            className={`flex items-center gap-2 pb-3 px-2 text-sm font-bold border-b-2 transition-all ${
              activeTab === "transcript"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Full Transcript
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {interview.transcripts?.length || 0}
            </span>
          </button>
        </div>

        {/* Tab 1: Evaluation & Feedback */}
        {activeTab === "evaluation" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Overall Feedback Summary Card */}
            <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-3">
                <Sparkles className="w-4 h-4" />
                Executive Assessment
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
                Overall Performance Review
              </h2>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed whitespace-pre-wrap">
                {interview.summary || "No summary provided for this interview session."}
              </p>
            </div>

            {/* Strengths & Improvements Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="glass-card rounded-2xl p-6 sm:p-7 border border-emerald-500/20 bg-emerald-950/10">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg mb-4">
                  <span className="p-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                    <ThumbsUp className="w-4 h-4" />
                  </span>
                  Key Strengths
                </div>

                {interview.strengths && interview.strengths.length > 0 ? (
                  <ul className="space-y-3.5">
                    {interview.strengths.map((str, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          ✓
                        </span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm italic">No specific strengths recorded.</p>
                )}
              </div>

              {/* Areas for Improvement */}
              <div className="glass-card rounded-2xl p-6 sm:p-7 border border-amber-500/20 bg-amber-950/10">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-lg mb-4">
                  <span className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </span>
                  Areas to Improve
                </div>

                {interview.improvements && interview.improvements.length > 0 ? (
                  <ul className="space-y-3.5">
                    {interview.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300 text-sm leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">
                          →
                        </span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-sm italic">No specific improvements recorded.</p>
                )}
              </div>
            </div>

            {/* Quick Practice CTA */}
            <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white mb-1">
                  Ready to practice this role again?
                </h3>
                <p className="text-slate-400 text-xs">
                  Apply these recommendations in another live session with Gemini AI.
                </p>
              </div>
              <Link
                href={`/?role=${encodeURIComponent(interview.job_role)}&difficulty=${encodeURIComponent(
                  interview.difficulty
                )}`}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
              >
                Launch {interview.job_role} Interview
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Tab 2: Full Spoken Transcript */}
        {activeTab === "transcript" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Transcript Controls & Search */}
            <div className="glass-card rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter dialogue text..."
                  value={transcriptSearch}
                  onChange={(e) => setTranscriptSearch(e.target.value)}
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 justify-end">
                <span>
                  Candidate turns: <strong className="text-white">{transcriptStats.userTurns}</strong>
                </span>
                <span>•</span>
                <span>
                  Interviewer turns: <strong className="text-white">{transcriptStats.botTurns}</strong>
                </span>
              </div>
            </div>

            {/* Transcript Bubbles */}
            <div className="glass-card rounded-2xl p-6 sm:p-8 border border-white/5 space-y-6">
              {filteredTranscripts.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="italic">
                    {interview.transcripts.length === 0
                      ? "No transcript dialogue was saved for this interview."
                      : "No transcript messages matched your filter query."}
                  </p>
                </div>
              ) : (
                filteredTranscripts.map((t, idx) => {
                  const isUser = t.role.toLowerCase() === "user" || t.role.toLowerCase() === "candidate";

                  return (
                    <div
                      key={idx}
                      className={`flex gap-3 sm:gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
                          isUser
                            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                            : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                        }`}
                      >
                        {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 sm:p-5 text-sm leading-relaxed ${
                          isUser
                            ? "bg-indigo-600/15 border border-indigo-500/25 text-slate-100 rounded-tr-none"
                            : "bg-slate-900 border border-white/10 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-white/5">
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              isUser ? "text-indigo-400" : "text-emerald-400"
                            }`}
                          >
                            {isUser ? "You (Candidate)" : "AI Interviewer"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Turn #{idx + 1}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{t.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
