"use client";

import { useEffect, useState } from "react";

export default function DocumentViewer({ sessionId }: { sessionId?: string }) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "http://localhost:4000" : "");

  useEffect(() => {
    function readHash() {
      const h = (window.location.hash || "").replace("#doc-", "");
      if (h) setSelectedDocId(h);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  // if sessionId changes, we clear the selection so we don't carry over old hash/doc
  useEffect(() => {
    setSelectedDocId(null);
    // also will clear hash to avoid accidental selection
    if (typeof window !== "undefined") {
      if ((window.location.hash || "").startsWith("#doc-")) window.location.hash = "";
    }
  }, [sessionId]);


  useEffect(() => {
    if (!sessionId || !selectedDocId) return;
    let cancelled = false;
    setLoading(true);
    setText(null);
    setError(null);
    setStatusMsg(null);

    // dedicated doc endpoint
    const docUrl = `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/doc/${encodeURIComponent(selectedDocId)}`;

    fetch(docUrl)
      .then(async (res) => {
        if (res.status === 404) {
          const sres = await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`);
          if (!sres.ok) throw new Error("Failed to fetch session fallback");
          const sjson = await sres.json();
          const doc = (sjson?.docs || []).find((d: any) => d.docId === selectedDocId);
          if (!doc) throw new Error("Document not found in session");
          setText(doc.preview || "No preview available");
          setStatusMsg(doc.status === "parsed" ? null : "Parsing in progress — try again in a moment");
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch doc (${res.status})`);
        const json = await res.json();
        // Expect {text: "...", docId, parsedAt?}
        setText(json?.text || json?.fullText || "");
        setStatusMsg(json?.parsedAt ? `Parsed: ${new Date(json.parsedAt).toLocaleString()}` : null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load document");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, selectedDocId]);

  async function copyText() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMsg("Copied to clipboard");
      setTimeout(() => setStatusMsg(null), 2000);
    } catch (e) {
      setStatusMsg("Copy failed");
      setTimeout(() => setStatusMsg(null), 2000);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl text-white font-semibold">{selectedDocId ? `Document: ${selectedDocId}` : "Select a document"}</h2>
          {statusMsg && <div className="text-sm text-slate-400">{statusMsg}</div>}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={copyText} disabled={!text} className="px-3 py-1 rounded bg-[#0f1724] text-slate-200 text-sm border border-slate-700">Copy text</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded bg-[#071126] p-4 text-slate-200 text-sm whitespace-pre-wrap">
        {loading && <div className="text-slate-400">Loading document…</div>}
        {error && <div className="text-red-400">{error}</div>}
        {!loading && !error && !text && <div className="text-slate-400">No document selected or no preview available yet.</div>}
        {!loading && text && <div>{text}</div>}
      </div>
    </div>
  );
}