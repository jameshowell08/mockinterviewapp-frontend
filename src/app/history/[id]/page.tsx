"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, ThumbsUp, TrendingUp, Clock, Bot, User } from "lucide-react";

type TranscriptLine = {
  role: string;
  text: string;
};

type InterviewDetail = {
  id: number;
  job_role: string;
  difficulty: string;
  summary: string;
  rating: number;
  strengths: string[];
  improvements: string[];
  created_at: string;
  transcripts: TranscriptLine[];
};

export default function InterviewDetailPage() {
  const { data: session, status } = useSession();
  const { id } = useParams();
  const router = useRouter();
  
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    if (status === "authenticated" && id) {
      fetch(`http://127.0.0.1:8000/api/history/${id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load interview");
          return res.json();
        })
        .then((data) => {
          setInterview(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [id, status, router]);

  if (loading || status === "loading") {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
  }

  if (error || !interview) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold text-red-400 mb-4">Error</h1>
        <p className="text-slate-400">{error || "Interview not found."}</p>
        <Link href="/history" className="text-indigo-400 hover:underline mt-4 inline-block">Back to History</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto w-full">
      <Link href="/history" className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to History
      </Link>

      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sm:p-10 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 pb-8 border-b border-white/5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{interview.job_role}</h1>
              <span className="px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-sm font-medium capitalize">
                {interview.difficulty}
              </span>
            </div>
            <p className="text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {new Date(interview.created_at).toLocaleString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          </div>
          <div className="text-center p-4 bg-slate-950 rounded-xl border border-white/5 shadow-inner min-w-[120px]">
            <p className="text-sm text-slate-400 mb-1 font-medium tracking-wide uppercase">Score</p>
            <div className="text-4xl font-black flex items-center justify-center gap-2 text-white">
              {interview.rating}<span className="text-slate-600 text-2xl">/10</span>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Overall Feedback</h2>
          <p className="text-slate-300 leading-relaxed text-lg">{interview.summary}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
            <h3 className="text-emerald-400 font-bold flex items-center gap-2 mb-4">
              <ThumbsUp className="w-5 h-5" /> Strengths
            </h3>
            <ul className="space-y-3">
              {interview.strengths.map((strength, i) => (
                <li key={i} className="flex gap-3 text-slate-300">
                  <span className="text-emerald-500 mt-1">•</span>
                  <span>{strength}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6">
            <h3 className="text-amber-400 font-bold flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" /> Areas for Improvement
            </h3>
            <ul className="space-y-3">
              {interview.improvements.map((improvement, i) => (
                <li key={i} className="flex gap-3 text-slate-300">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>{improvement}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 sm:p-10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          Interview Transcript
        </h2>
        <div className="space-y-6">
          {interview.transcripts.map((t, idx) => {
            const isUser = t.role === "user";
            return (
              <div key={idx} className={`flex gap-4 ${isUser ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${isUser ? "bg-indigo-600" : "bg-emerald-600"}`}>
                  {isUser ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`p-4 rounded-2xl max-w-[85%] ${isUser ? "bg-indigo-600/20 border border-indigo-500/30 text-slate-100 rounded-tr-none" : "bg-slate-800 border border-white/5 text-slate-300 rounded-tl-none"}`}>
                  <p className="text-[11px] uppercase tracking-wider mb-2 opacity-50 font-semibold">
                    {isUser ? "You" : "Interviewer"}
                  </p>
                  <p className="leading-relaxed whitespace-pre-wrap">{t.text}</p>
                </div>
              </div>
            );
          })}
          {interview.transcripts.length === 0 && (
            <p className="text-center text-slate-500 italic py-8">No transcript recorded for this interview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
