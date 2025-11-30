"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  loading?: boolean;
};

export default function ChatWindow({ sessionId }: { sessionId?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  // helper to read selected doc from hash (same pattern as other components)
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
        // will include chat history or other flags later
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
        pushMessage({ id: `a-${Date.now()}`, role: "assistant", text: answer });
        if (json.citations && Array.isArray(json.citations)) {
          json.citations.forEach((c: any, i: number) =>
            pushMessage({ id: `c-${Date.now()}-${i}`, role: "assistant", text: `— source: ${c}` })
          );
        }
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
              <div className="text-white font-semibold">Clause Genie</div>
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
              <div key={m.id} className={`p-3 rounded ${m.role === "user" ? "bg-[#052033] text-slate-200 self-end" : "bg-[#0f1724] text-slate-200 self-start"}`}>
                <div className="text-sm whitespace-pre-wrap">{m.text}</div>
                {m.loading && <div className="text-xs text-slate-400 mt-1">…</div>}
              </div>
            ))}
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