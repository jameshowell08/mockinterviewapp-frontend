"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import { ArrowRight, Star } from "lucide-react";

type InterviewHistory = {
  id: number;
  job_role: string;
  difficulty: string;
  rating: number;
  created_at: string;
};

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const [history, setHistory] = useState<InterviewHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.email) {
      fetch(`http://127.0.0.1:8000/api/history?email=${encodeURIComponent(session.user.email)}`)
        .then((res) => res.json())
        .then((data) => {
          setHistory(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [session, status]);

  if (status === "loading" || loading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
  }

  if (status === "unauthenticated") {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-4">Please log in</h1>
        <p className="text-slate-400">You must be logged in to view your interview history.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-8">Interview History</h1>
      
      {history.length === 0 ? (
        <div className="bg-slate-900 rounded-xl p-8 border border-white/10 text-center">
          <p className="text-slate-400 mb-4">You haven't completed any interviews yet.</p>
          <Link href="/" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium inline-block">
            Start a Mock Interview
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {history.map((interview) => (
            <Link 
              key={interview.id} 
              href={`/history/${interview.id}`}
              className="group bg-slate-900 rounded-xl p-6 border border-white/5 hover:border-indigo-500/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                  {interview.job_role} 
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-medium capitalize">
                    {interview.difficulty}
                  </span>
                </h2>
                <p className="text-slate-400 text-sm">
                  {new Date(interview.created_at).toLocaleDateString(undefined, { 
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {interview.rating}/10
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  </div>
                </div>
                <div className="p-2 bg-white/5 rounded-full group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
