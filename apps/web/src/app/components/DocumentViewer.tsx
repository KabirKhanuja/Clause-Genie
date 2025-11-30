"use client";

import { useEffect, useState } from "react";

export default function DocumentViewer({ sessionId }: { sessionId?: string }) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFull, setShowFull] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'parsed' | 'original'>('parsed');
  const [fileAvailable, setFileAvailable] = useState<boolean | null>(null);
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
    const ac = new AbortController();
    let mounted = true;

    setLoading(true);
    setText(null);
    setError(null);
    setStatusMsg(null);
    setDownloadUrl(null);

    const docUrl = `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/doc/${encodeURIComponent(selectedDocId)}`;

    (async () => {
      try {
        const res = await fetch(docUrl, { signal: ac.signal });
        if (res.status === 404) {
          // fallback to session endpoint
          const sres = await fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`, { signal: ac.signal });
          if (!sres.ok) throw new Error("Failed to fetch session fallback");
          const sjson = await sres.json();
          const doc = (sjson?.docs || []).find((d: any) => d.docId === selectedDocId);
          if (!doc) throw new Error("Document not found in session");
          if (!mounted) return;
          setText(doc.preview || "No preview available");
          setStatusMsg(doc.status === "parsed" ? null : "Parsing in progress — try again in a moment");
          return;
        }
        if (!res.ok) throw new Error(`Failed to fetch doc (${res.status})`);
        const json = await res.json();
        if (!mounted) return;
        // accept possible download URL from backend (optional)
        setText(json?.text || json?.fullText || "");
        setStatusMsg(json?.parsedAt ? `Parsed: ${new Date(json.parsedAt).toLocaleString()}` : null);
        if (json?.downloadUrl) setDownloadUrl(json.downloadUrl);

        // after we have basic doc info, probe for original file availability
        try {
          const fileUrl = `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/doc/${encodeURIComponent(selectedDocId)}/file`;
          const fres = await fetch(fileUrl, { method: 'GET' });
          setFileAvailable(fres.ok);
        } catch {
          setFileAvailable(false);
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        if (!mounted) return;
        setError(err?.message || "Failed to load document");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ac.abort();
    };
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
          <div className="inline-flex rounded-md bg-[#0b1220] p-1">
            <button
              onClick={() => setViewMode('original')}
              className={`px-3 py-1 rounded ${viewMode === 'original' ? 'bg-[#0f1724] text-white' : 'text-slate-300'}`}
              disabled={fileAvailable === false}
              title={fileAvailable === false ? 'Original file not available' : 'Show original document'}
            >
              Document
            </button>
            <button
              onClick={() => setViewMode('parsed')}
              className={`px-3 py-1 rounded ${viewMode === 'parsed' ? 'bg-[#0f1724] text-white' : 'text-slate-300'}`}
              title="Show parsed text"
            >
              Parsed
            </button>
          </div>

          <button onClick={copyText} disabled={!text} className="px-3 py-1 rounded bg-[#0f1724] text-slate-200 text-sm border border-slate-700">Copy text</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded bg-[#071126] p-4 text-slate-200 text-sm whitespace-pre-wrap">
        {loading && <div className="text-slate-400">Loading document…</div>}
        {error && <div className="text-red-400">{error}</div>}

        {!loading && !error && viewMode === 'parsed' && (
          <>
            {!text && <div className="text-slate-400">No document selected or no preview available yet.</div>}
            {text && <div>{text}</div>}
          </>
        )}

        {!loading && !error && viewMode === 'original' && (
          <>
            {fileAvailable === null && <div className="text-slate-400">Checking for original file…</div>}
            {fileAvailable === false && <div className="text-slate-400">Original file not available (it may have been deleted or moved).</div>}
            {fileAvailable === true && (
              <>
                {/* embed for pdfs/images; iframe works for many file types */}
                <div className="w-full h-[70vh] rounded overflow-hidden bg-black">
                  <iframe
                    title="original-doc-preview"
                    src={`${API_BASE}/api/session/${encodeURIComponent(sessionId || "")}/doc/${encodeURIComponent(selectedDocId || "")}/file`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}