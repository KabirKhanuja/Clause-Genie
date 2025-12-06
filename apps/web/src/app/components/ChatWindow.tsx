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

        // normalize & dedupe citations
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
        className={`fixed top-0 right-0 h-full z-50 transform transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ width: 420, maxWidth: "100vw", background: "linear-gradient(180deg,#071126,#020617)", boxShadow: "-20px 0 80px rgba(0,0,0,0.6)", borderLeft: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="text-white font-semibold">Clause Genie</div>
                <GeneralKnowledgeToggle
                  enabled={localUseGeneral}
                  onToggle={handleToggleLocal}
                />
              </div>
              <div className="text-xs text-slate-400">{sessionId ? `Session: ${sessionId.slice(0, 8)}…` : "No session"}</div>
              <div className="text-xs text-slate-400">{selectedDocId ? `Doc: ${selectedDocId.slice(0, 8)}…` : "No doc selected"}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setMessages([]);
                }}
                className="text-sm text-slate-400 hover:text-slate-200"
              >
                Clear
              </button>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full border border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close chat panel"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-slate-400 text-sm">Ask questions about the selected document. Genie will use retrieved context to answer.</div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`p-3 rounded ${
                  m.role === "user"
                    ? "bg-[#052033] text-slate-200 self-end"
                    : "bg-[#0f1724] text-slate-200 self-start"
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                {m.citations && m.citations.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {m.citations.map((c, i) => (
                      <CitationChip
                        key={`${c.docId}#${c.chunkId}`}
                        index={i + 1}
                        citation={c}
                        onClick={(cit) => {
                          // prefer parent handler if provided
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
                {m.loading && <div className="text-xs text-slate-400 mt-1">…</div>}
              </div>
            ))}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-slate-700">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={sessionId ? (selectedDocId ? "Ask about the selected document…" : "Select a document to ask about it…") : "Upload a document first"}
                className="flex-1 px-3 py-2 bg-[#071026] text-slate-200 rounded border border-slate-700"
                disabled={!sessionId || sending}
              />
              <button onClick={handleSend} disabled={!input.trim() || sending || !sessionId} className="px-3 py-2 rounded bg-[#0b6b88] text-white">
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}