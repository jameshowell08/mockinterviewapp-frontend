"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";

// ── Types ──
type Screen = "setup" | "interview" | "results";
type AIState = "idle" | "listening" | "thinking" | "speaking";
type ConnectionStatus = "disconnected" | "connecting" | "live";
type TranscriptEntry = { role: "user" | "interviewer"; text: string; streaming?: boolean };

const JOB_ROLES = [
  "Software Engineer",
  "Product Manager",
  "QA Engineer",
  "Data Scientist",
  "DevOps Engineer",
  "UI/UX Designer",
];

const DIFFICULTIES = ["easy", "normal", "hard"] as const;

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "id", label: "Indonesian", flag: "🇮🇩" },
] as const;

// ── Audio Helpers ──
function float32ToPCM16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64PCMToFloat32(base64: string): Float32Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ── Main Component ──
export default function MockInterviewApp() {
  const { data: session } = useSession();
  const [screen, setScreen] = useState<Screen>("setup");
  const [jobRole, setJobRole] = useState("Software Engineer");
  const [difficulty, setDifficulty] = useState<string>("normal");
  const [language, setLanguage] = useState<string>("en");

  // Interview state
  const [aiState, setAiState] = useState<AIState>("idle");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Transcription
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const transcriptEntriesRef = useRef<TranscriptEntry[]>([]);

  // Results
  const [summary, setSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextCapRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextPlayRef = useRef<AudioContext | null>(null);
  const playbackWorkletRef = useRef<AudioWorkletNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const isMutedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Pause state
  const [isPaused, setIsPaused] = useState(false);
  const isPausedRef = useRef(false);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { transcriptEntriesRef.current = transcriptEntries; }, [transcriptEntries]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptEntries]);

  // Helper: append text to the current bubble, or create a new one if role changed
  const upsertBubble = useCallback((role: "user" | "interviewer", text: string) => {
    setTranscriptEntries((prev) => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      if (lastIdx >= 0 && copy[lastIdx].role === role && copy[lastIdx].streaming) {
        copy[lastIdx] = { role, text: copy[lastIdx].text + text, streaming: true };
      } else {
        // If there's an active streaming bubble of a DIFFERENT role, finalize it
        if (lastIdx >= 0 && copy[lastIdx].streaming) {
          copy[lastIdx].streaming = false;
        }
        copy.push({ role, text, streaming: true });
      }
      return copy;
    });
  }, []);

  const finalizeBubbles = useCallback(() => {
    setTranscriptEntries((prev) => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      if (lastIdx >= 0 && copy[lastIdx].streaming) {
        copy[lastIdx].streaming = false;
      }
      return copy;
    });
  }, []);



  // ── Audio Capture Setup ──
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      mediaStreamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextCapRef.current = ctx;
      await ctx.audioWorklet.addModule("/audio-processors/capture.worklet.js");

      const worklet = new AudioWorkletNode(ctx, "audio-capture-processor");
      audioWorkletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        if (e.data?.type === "audio" && !isMutedRef.current && !isPausedRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
          const b64 = float32ToPCM16Base64(e.data.data);
          wsRef.current.send(JSON.stringify({ type: "audio", data: b64 }));
        }
      };

      const source = ctx.createMediaStreamSource(stream);
      source.connect(worklet);
      console.log("🎤 Audio capture started");
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  }, []);

  const stopAudioCapture = useCallback(() => {
    audioWorkletRef.current?.disconnect();
    audioWorkletRef.current?.port.close();
    audioWorkletRef.current = null;
    audioContextCapRef.current?.close();
    audioContextCapRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  // ── Audio Playback Setup ──
  const initPlayback = useCallback(async () => {
    const ctx = new AudioContext({ sampleRate: 24000 });
    audioContextPlayRef.current = ctx;
    await ctx.audioWorklet.addModule("/audio-processors/playback.worklet.js");

    const worklet = new AudioWorkletNode(ctx, "pcm-processor");
    playbackWorkletRef.current = worklet;

    const gain = ctx.createGain();
    gain.gain.value = 1.0;
    gainNodeRef.current = gain;

    worklet.connect(gain);
    gain.connect(ctx.destination);
    console.log("🔊 Audio playback initialized");
  }, []);

  const stopPlayback = useCallback(() => {
    playbackWorkletRef.current?.port.postMessage("interrupt");
    audioContextPlayRef.current?.close();
    audioContextPlayRef.current = null;
    playbackWorkletRef.current = null;
    gainNodeRef.current = null;
  }, []);

  const playAudioChunk = useCallback((base64: string) => {
    if (!playbackWorkletRef.current || !audioContextPlayRef.current) return;
    if (audioContextPlayRef.current.state === "suspended") audioContextPlayRef.current.resume();
    const f32 = base64PCMToFloat32(base64);
    playbackWorkletRef.current.port.postMessage(f32);
  }, []);

  // ── WebSocket ──
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setConnectionStatus("connecting");

    const ws = new WebSocket("ws://localhost:8000/ws/interview");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected, sending config...");
      ws.send(JSON.stringify({ jobRole, difficulty, language, token: session?.accessToken }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "status":
          if (data.status === "live") {
            setConnectionStatus("live");
            setAiState("thinking");
          }
          break;

        case "audio":
          setAiState("speaking");
          playAudioChunk(data.data);
          break;

        case "text":
          setAiState("speaking");
          break;

        case "input_transcription": {
          if (data.text) upsertBubble("user", data.text);
          break;
        }

        case "output_transcription": {
          if (data.text) upsertBubble("interviewer", data.text);
          break;
        }

        case "interrupted":
          playbackWorkletRef.current?.port.postMessage("interrupt");
          finalizeBubbles();
          break;

        case "turn_complete":
          setAiState("listening");
          finalizeBubbles();
          break;

        case "error":
          console.error("[WS] Error:", data.message);
          break;
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setAiState("idle");
    };

    ws.onerror = () => setConnectionStatus("disconnected");
  }, [jobRole, difficulty, language, playAudioChunk, upsertBubble, finalizeBubbles]);

  // ── Interview Controls ──
  const startInterview = useCallback(async () => {
    setScreen("interview");
    setTranscriptEntries([]);
    setElapsed(0);
    setSummary(null);
    setIsMuted(false);
    setIsPaused(false);

    await initPlayback();
    connectWS();
    await startAudioCapture();

    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }, [initPlayback, connectWS, startAudioCapture]);

  const endInterview = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopAudioCapture();
    stopPlayback();
    wsRef.current?.close();
    wsRef.current = null;
    setAiState("idle");
    setConnectionStatus("disconnected");

    // Generate summary
    const entries = transcriptEntriesRef.current;
    setScreen("results");
    
    if (entries.length === 0) {
      setSummary({
        summary: "No conversation was recorded. Please try again and speak into the microphone.",
        rating: 0,
        strengths: ["None detected"],
        improvements: ["Ensure your microphone is working and try speaking louder."],
      });
      return;
    }

    setLoadingSummary(true);
    try {
      const resp = await fetch("http://localhost:8000/api/summary", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.accessToken}`
        },
        body: JSON.stringify({ userEmail: session?.user?.email || "anonymous", jobRole, difficulty, transcript: entries }),
      });
      const result = await resp.json();
      setSummary(result);
    } catch {
      setSummary({
        summary: "Could not generate summary.",
        rating: 0,
        strengths: [],
        improvements: [],
      });
    }
    setLoadingSummary(false);
  }, [jobRole, difficulty, stopAudioCapture, stopPlayback]);

  const togglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next && timerRef.current) clearInterval(timerRef.current);
      else if (!next) timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const startNew = useCallback(() => {
    setScreen("setup");
    setTranscriptEntries([]);
    setSummary(null);
    setElapsed(0);
  }, []);

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudioCapture();
      stopPlayback();
      wsRef.current?.close();
    };
  }, [stopAudioCapture, stopPlayback]);

  // ── Render ──

  // Rating gauge SVG helper
  const RatingGauge = ({ rating }: { rating: number }) => {
    const r = 58;
    const c = 2 * Math.PI * r;
    const pct = Math.min(rating / 10, 1);
    return (
      <div className="rating-gauge">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="70" cy="70" r={r} fill="none"
            stroke="url(#grad)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c * (1 - pct)}`}
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#4f8fff" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
        <span className="value">{rating}</span>
        <span className="label">out of 10</span>
      </div>
    );
  };

  // ── Setup Screen ──
  if (screen === "setup") {
    return (
      <main style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div className="bg-ambient" />
        <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40, zIndex: 1, width: "100%", maxWidth: 440, padding: "0 24px" }}>
          <div className="orb-hero" />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "2.5rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8, background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              MockInterview AI
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6 }}>
              Practice real-time voice interviews powered by Gemini Live
            </p>
          </div>

          <div className="glass-card" style={{ width: "100%", padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="select-group">
              <label className="select-label" htmlFor="role-select">Job Role</label>
              <select id="role-select" className="select-input" value={jobRole} onChange={(e) => setJobRole(e.target.value)}>
                {JOB_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="select-group">
              <span className="select-label">Difficulty</span>
              <div className="difficulty-chips">
                {DIFFICULTIES.map((d) => (
                  <button key={d} className={`chip ${difficulty === d ? `active ${d}` : ""}`} onClick={() => setDifficulty(d)}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="select-group">
              <span className="select-label">Language</span>
              <div className="difficulty-chips">
                {LANGUAGES.map((l) => (
                  <button key={l.code} className={`chip ${language === l.code ? "active normal" : ""}`} onClick={() => setLanguage(l.code)}>
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            <button className="btn-primary" onClick={startInterview} disabled={!session} style={{ display: "flex", alignItems: "center", gap: 10, opacity: session ? 1 : 0.5 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              Start Interview
            </button>
            {!session && (
              <p style={{ color: "var(--accent-orange)", fontSize: "0.85rem" }}>
                Please sign in with Google to start an interview and save your history.
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ── Interview Screen ──
  if (screen === "interview") {
    const stateBadgeClass = aiState === "listening" ? "badge-listening" : aiState === "thinking" ? "badge-thinking" : aiState === "speaking" ? "badge-speaking" : "badge-idle";
    const connBadgeClass = connectionStatus === "live" ? "badge-live" : connectionStatus === "connecting" ? "badge-connecting" : "badge-disconnected";

    return (
      <main style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative" }}>
        <div className="bg-ambient" />

        {/* Top Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className={`badge ${stateBadgeClass}`}>
              <span className="pulse-dot" />
              {aiState}
            </span>
            <span className={`badge ${connBadgeClass}`}>
              {connectionStatus === "live" && <span className="pulse-dot" />}
              {connectionStatus}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="timer">{formatTime(elapsed)}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", background: "var(--bg-glass)", padding: "4px 10px", borderRadius: "var(--radius-full)", border: "1px solid var(--border-glass)" }}>
              {jobRole} · {difficulty}
            </span>
          </div>
        </div>

        {/* Orb + Transcript */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 1, overflow: "hidden", padding: "0 24px" }}>
          <div className="orb-container" style={{ marginTop: 20, marginBottom: 16, flexShrink: 0 }}>
            <div className={`orb ${aiState}`} />
          </div>

          {/* Transcript Panel */}
          <div className="glass-card" style={{ flex: 1, width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", overflow: "hidden", marginBottom: 100 }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-glass)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-secondary)" }}>
                Live Transcript
              </span>
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {transcriptEntries.length} messages
              </span>
            </div>
            <div className="transcript-area" ref={transcriptRef}>
              {transcriptEntries.length === 0 && (
                <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 40 }}>
                  {connectionStatus === "live" ? "Waiting for the interviewer to start..." : "Connecting..."}
                </p>
              )}
              {transcriptEntries.map((e, i) => (
                <div key={i} className={`transcript-msg ${e.role === "user" ? "user" : "ai"} ${e.streaming ? "streaming" : ""}`}>
                  {e.text}
                  {e.streaming && <span className="typing-cursor" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}>
          <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 24px" }}>
            <button className={`btn-icon btn-mic ${isMuted ? "muted" : ""}`} onClick={toggleMute} title={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.34 2.18"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              )}
            </button>
            <button className={`btn-icon ${isPaused ? "muted" : ""}`} onClick={togglePause} title={isPaused ? "Resume" : "Pause"}>
              {isPaused ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              )}
            </button>
            <button className="btn-primary" style={{ padding: "8px 20px", fontSize: "0.85rem", borderRadius: "var(--radius-full)" }} onClick={endInterview} title="Finish Interview">
              Finish
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Results Screen ──
  return (
    <main style={{ height: "100vh", overflow: "auto", position: "relative" }}>
      <div className="bg-ambient" />
      <div className="slide-up" style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px 80px", zIndex: 1, position: "relative" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8, background: "var(--gradient-hero)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Interview Complete
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 32, fontSize: "0.9rem" }}>
          {jobRole} · {difficulty} · {formatTime(elapsed)}
        </p>

        {loadingSummary ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 60 }}>
            <div className="spinner" />
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Analyzing your interview...</p>
          </div>
        ) : summary ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Rating */}
            <div className="glass-card" style={{ display: "flex", alignItems: "center", gap: 28, padding: 28 }}>
              <RatingGauge rating={summary.rating || 0} />
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>Overall Performance</h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7 }}>
                  {summary.summary}
                </p>
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="result-card">
                <h3>✦ Strengths</h3>
                <ul className="result-list">
                  {(summary.strengths || []).map((s: string, i: number) => (
                    <li key={i}>
                      <span className="icon" style={{ color: "var(--accent-green)" }}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="result-card">
                <h3>△ Areas to Improve</h3>
                <ul className="result-list">
                  {(summary.improvements || []).map((s: string, i: number) => (
                    <li key={i}>
                      <span className="icon" style={{ color: "var(--accent-orange)" }}>→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Full Transcript */}
            {transcriptEntries.length > 0 && (
              <div className="result-card">
                <h3>Full Transcript</h3>
                <div className="full-transcript">
                  {transcriptEntries.map((e, i) => (
                    <p key={i}>
                      <span className={`speaker ${e.role === "interviewer" ? "interviewer" : "candidate"}`}>
                        {e.role === "interviewer" ? "Interviewer:" : "You:"}
                      </span>
                      {e.text}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={startNew} style={{ alignSelf: "center", marginTop: 8 }}>
              Start New Interview
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
