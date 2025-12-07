"use client";

import { useEffect, useState, useRef } from "react";
import CitationChip from "../chat/CitationChip";
import GeneralKnowledgeToggle from "../components/GeneralKnowledgeToggle";
import { scrollToChunk } from "../components/DocumentViewer";

type Citation = {
  docId: string;
  chunkId: string;
  score?: number;
  snippet?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  loading?: boolean;
  citations?: Citation[];
};

type Doc = {
  docId: string;
  originalname: string;
  status?: string;
};

export default function ChatWindow({
  sessionId,
  onCitationClick,
  useGeneralKnowledge,
  onToggleGeneralKnowledge,
}: {
  sessionId?: string;
  onCitationClick?: (c: Citation) => void;
  useGeneralKnowledge?: boolean;
  onToggleGeneralKnowledge?: (value: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState(420);
  const [isResizing, setIsResizing] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);

  // local toggle state, initialize from prop and keep in sync
  const [localUseGeneral, setLocalUseGeneral] = useState<boolean>(!!useGeneralKnowledge);

  // if parent changes prop, sync local state
  useEffect(() => {
    setLocalUseGeneral(!!useGeneralKnowledge);
  }, [useGeneralKnowledge]);

  // handler when the toggle changes locally
  function handleToggleLocal(v: boolean) {
    setLocalUseGeneral(v);
    if (typeof onToggleGeneralKnowledge === "function") {
      try {
        onToggleGeneralKnowledge(v);
      } catch {
        // ignore
      }
    }
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  function getSelectedDocFromHash() {
    if (typeof window === "undefined") return null;
    const h = (window.location.hash || "").replace("#doc-", "");
    return h || null;
  }

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  useEffect(() => {
    function readHash() {
      setSelectedDocId(getSelectedDocFromHash());
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  // fetch documents list when chat opens
  useEffect(() => {
    if (!sessionId || !open) return;
    let cancelled = false;
    
    fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch session`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setDocs(json?.docs || []);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, open, API_BASE]);

  function switchToDoc(docId: string) {
    if (typeof window !== "undefined") {
      window.location.hash = `doc-${docId}`;
    }
  }

  const pushMessage = (m: Message) => setMessages((s) => [...s, m]);

  // auto-scroll chat to the latest message whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      try {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {
        // ignore scroll errors
      }
    }
  }, [messages]);

  // handle resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setChatWidth(Math.max(320, Math.min(newWidth, window.innerWidth * 0.9)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Normalize a backend citation entry. backend might return:
  // - an object { docId, chunkId, snippet, score }
  // - a string like "session:...:doc:<docId>#chunk:<chunkId>"
  function normalizeCitation(raw: any): Citation | null {
    if (!raw) return null;
    if (typeof raw === "string") {
      // try parse docId and chunkId
      const m = raw.match(/doc:([^#\s]+).*#chunk:([^\s]+)/);
      if (m) {
        return { docId: m[1], chunkId: m[2], snippet: "" };
      }
      return null;
    }
    // if already an object, pick fields
    const docId = raw.docId || raw.document || (raw.source && raw.source.docId) || null;
    const chunkId = raw.chunkId || raw.chunk || (raw.source && raw.source.chunkId) || null;
    const snippet = raw.snippet || raw.text || raw.snippet_text || "";
    if (!docId || !chunkId) return null;
    return { docId, chunkId, score: raw.score, snippet };
  }

  // fallback local citation click handler (if parent doesn't pass onCitationClick)
  async function handleCitationClickLocal(c: Citation) {
    try {
      if (!c || !c.docId) return;
      // set hash to open doc viewer (DocumentViewer listens for hash changes)
      if (typeof window !== "undefined") {
        window.location.hash = `doc-${c.docId}`;
      }

      // Retry scroll until doc-viewer is present and snippet search succeeds (max attempts)
      const maxAttempts = 8;
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          // If snippet present, attempt highlight
          if (c.snippet && c.snippet.length > 8) {
            const ok = scrollToChunk(c.chunkId, c.snippet);
            if (ok) return;
          } else {
            // fallback: try scrollToChunk with chunkId and empty snippet (function handles fallback)
            const ok = scrollToChunk(c.chunkId, c.snippet || "");
            if (ok) return;
          }
        } catch (e) {
          // ignore and retry
        }
        // wait longer after each try
        await wait(200 + attempt * 150);
      }
      // last resort: just ensure doc opened (hash set above)
    } catch (e) {
      // no-op
    }
  }

  async function handleSend() {
    if (!input.trim()) return;
    if (!sessionId) {
      pushMessage({ id: Date.now().toString(), role: "assistant", text: "Please upload a document first.", });
      return;
    }

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", text: input.trim() };
    pushMessage(userMsg);
    setInput("");
    setSending(true);

    const placeholder: Message = { id: `a-${Date.now()}`, role: "assistant", text: "Thinking…", loading: true };
    pushMessage(placeholder);

    try {
      const payload = {
        sessionId,
        docId: selectedDocId,
        question: userMsg.text,
        useGeneralKnowledge: localUseGeneral,
      };
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMessages((cur) => cur.filter((m) => m.id !== placeholder.id));
      if (!res.ok) {
        const txt = await res.text().catch(() => `Server error (${res.status})`);
        pushMessage({ id: `a-err-${Date.now()}`, role: "assistant", text: `Error: ${txt}` });
      } else {
        const json = await res.json();
        const answer = json.answer || "No answer";

        const rawCits = Array.isArray(json.citations) ? json.citations : [];
        const normalized: Citation[] = [];
        const seen = new Set<string>();
        for (const r of rawCits) {
          const n = normalizeCitation(r);
          if (!n) continue;
          const key = `${n.docId}#${n.chunkId}`;
          if (seen.has(key)) continue;
          seen.add(key);
          normalized.push(n);
        }

        pushMessage({ id: `a-${Date.now()}`, role: "assistant", text: answer, citations: normalized });
      }
    } catch (err: any) {
      setMessages((cur) => cur.filter((m) => m.id !== placeholder.id));
      pushMessage({ id: `a-err-${Date.now()}`, role: "assistant", text: `Network error: ${err?.message || err}` });
    } finally {
      setSending(false);
    }
  }

  async function downloadExportJson() {
    if (!sessionId || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}/export/json`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clause-genie-session-${sessionId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* floating toggle button (only visible when closed) */}
      {!open && (
        <div style={{ position: "fixed", right: 22, bottom: 22, zIndex: 60 }}>
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-3 rounded-full shadow-lg border border-slate-700 bg-linear-to-r from-[#13a4ec] to-[#00f2ea] text-black font-semibold"
            aria-expanded={open}
            aria-label="Open chat"
          >
            Chat with Genie
          </button>
        </div>
      )}

      {/* sliding panel */}
      <div
        className={`fixed top-0 right-0 h-full z-50 transform ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ 
          width: chatWidth, 
          maxWidth: "100vw", 
          background: "#1a2942", 
          boxShadow: "-30px 0 100px rgba(0,0,0,0.8), -10px 0 40px rgba(0,0,0,0.5)", 
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          transition: isResizing ? 'none' : 'transform 0.3s ease'
        }}
      >
        {/* resize handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className="absolute left-0 top-0 w-1 h-full cursor-ew-resize hover:bg-cyan-500/50 transition-colors"
          style={{ marginLeft: '-2px' }}
        />
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between gap-3 bg-[#020817]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#22d3ee] to-[#0ea5e9] flex items-center justify-center shadow-lg overflow-hidden">
                <img src="/images/genie.svg" alt="Genie" className="w-7 h-7" />
              </div>
              <div className="text-white font-semibold text-sm">Clause Genie</div>
            </div>
            <div className="flex items-center gap-2 relative">
              <GeneralKnowledgeToggle
                enabled={localUseGeneral}
                onToggle={handleToggleLocal}
                size="sm"
              />
              {sessionId && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExportOpen((v) => !v)}
                    className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                    aria-label="Export session"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  {exportOpen && (
                    <div className="absolute right-0 mt-2 w-40 rounded-xl bg-[#020617] border border-slate-700 shadow-xl text-xs text-slate-100 z-50">
                      <button
                        type="button"
                        onClick={() => {
                          setExportOpen(false);
                          downloadExportJson();
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-xl"
                      >
                        JSON (session data)
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => {
                  setMessages([]);
                }}
                className="text-sm text-slate-400 hover:text-slate-200 transition"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                aria-label="Close chat panel"
              >
                ✕
              </button>
            </div>
          </div>

          {/* document navigation tabs */}
          {docs.length > 0 && (
            <div className="px-3 py-2 border-b border-slate-700/50 bg-[#0a1628] overflow-x-auto">
              <div className="flex gap-1.5 min-w-max">
                {docs.map((doc, idx) => {
                  const isActive = doc.docId === selectedDocId;
                  return (
                    <button
                      key={doc.docId}
                      onClick={() => switchToDoc(doc.docId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-linear-to-r from-[#0ea5e9] to-[#06b6d4] text-white shadow-md"
                          : "bg-[#081226] text-slate-400 hover:bg-[#0f1729] hover:text-slate-200 border border-slate-700/50"
                      }`}
                      title={doc.originalname}
                    >
                      <span className="font-semibold">{idx + 1}</span>
                      <span className="mx-1">·</span>
                      <span className="max-w-[120px] truncate inline-block align-bottom">{doc.originalname}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto px-4 py-5 space-y-4 bg-[#020617]">
            {messages.length === 0 && (
              <div className="text-center px-4 py-8">
                <div className="text-slate-400 text-sm mb-2">
                  Ask me anything about your documents
                </div>
                <div className="text-slate-500 text-xs">
                  I'll retrieve relevant clauses and cite them for you.
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-linear-to-br from-[#0ea5e9] to-[#06b6d4] text-white rounded-br-md"
                      : "bg-[#0f1729] border border-slate-700/60 text-slate-100 rounded-bl-md"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {m.citations.map((c, i) => (
                        <CitationChip
                          key={`${c.docId}#${c.chunkId}`}
                          index={i + 1}
                          citation={c}
                          onClick={(cit) => {
                            if (typeof onCitationClick === "function") {
                              onCitationClick(cit);
                            } else {
                              handleCitationClickLocal(cit);
                            }
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {m.loading && <div className="text-xs text-slate-400 mt-1.5">Thinking…</div>}
                </div>
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-slate-700/50 bg-[#020817]">
            <div className="flex gap-2.5 items-center">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type your question…"
                className="flex-1 px-4 py-2.5 bg-[#0a1628] text-slate-200 rounded-full border border-slate-700/60 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 text-sm placeholder:text-slate-500"
                disabled={!sessionId || sending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending || !sessionId}
                className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-linear-to-br from-[#0ea5e9] to-[#06b6d4] text-white shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:shadow-xl transition"
                aria-label="Send message"
              >
                {sending ? (
                  <span className="text-xs">…</span>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}