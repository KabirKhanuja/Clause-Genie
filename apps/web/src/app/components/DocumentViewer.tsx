"use client";

import { useEffect, useState } from "react";

// replace the existing exported scrollToChunk function with this implementation
export function scrollToChunk(chunkId: string, snippet: string) {
  const container = document.getElementById("doc-viewer");
  if (!container) return false;

  // if no snippet, nothing to search for
  if (!snippet || snippet.trim().length < 5) {
    // we at least scroll to top so user sees the doc
    container.scrollIntoView({ behavior: "smooth", block: "start" });
    return false;
  }

  const fullText = container.innerText || "";
  const needleFull = snippet.trim();
  const maxLen = Math.min(160, needleFull.length);
  const tryCandidates: string[] = [];
  for (let len = maxLen; len >= 20; len -= 20) {
    tryCandidates.push(needleFull.slice(0, len).trim());
  }
  if (needleFull.length > 40) {
    const mid = Math.floor(needleFull.length / 2);
    tryCandidates.push(needleFull.slice(Math.max(0, mid - 30), Math.min(needleFull.length, mid + 30)).trim());
  }

  const textLower = fullText.toLowerCase();

  function doHighlight(candidate: string): boolean {
    if (!candidate || candidate.length < 6) return false;
    const candLower = candidate.toLowerCase();
    const idx = textLower.indexOf(candLower);
    if (idx === -1) return false;

    let offset = 0;
    if (!container) return false;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      const nodeText = (node.nodeValue || "");
      const nodeLen = nodeText.length;
      if (offset + nodeLen >= idx) {
        const relStart = idx - offset;
        const relEnd = relStart + candidate.length;
        const before = nodeText.slice(0, relStart);
        const matchText = nodeText.slice(relStart, relEnd);
        const after = nodeText.slice(relEnd);

        const span = document.createElement("span");
        span.className = "highlight-chunk";
        span.textContent = matchText;

        const frag = document.createDocumentFragment();
        if (before.length) frag.appendChild(document.createTextNode(before));
        frag.appendChild(span);
        if (after.length) frag.appendChild(document.createTextNode(after));

        if (node.parentNode) {
          node.parentNode.replaceChild(frag, node);
          // scroll to the highlight
          span.scrollIntoView({ behavior: "smooth", block: "center" });
          // remove highlight after 4s
          setTimeout(() => {
            span.style.transition = "background 1s ease";
            span.style.background = "transparent";
            // optionally unwrap span after a delay (leave for simplicity)
          }, 4000);
          return true;
        }
        return false;
      }
      offset += nodeLen;
      node = walker.nextNode();
    }
    return false;
  }

  for (const candidate of tryCandidates) {
    if (!candidate) continue;
    try {
      const ok = doHighlight(candidate);
      if (ok) return true;
    } catch (e) {
    }
  }

  try {
    if (doHighlight(needleFull)) return true;
  } catch (e) {}

  return false;
}

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
        setText(json?.text || json?.fullText || "");
        setStatusMsg(json?.parsedAt ? `Parsed: ${new Date(json.parsedAt).toLocaleString()}` : null);
        if (json?.downloadUrl) setDownloadUrl(json.downloadUrl);

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
      <style jsx>{`
        .highlight-chunk {
          background: rgba(255, 230, 0, 0.45);
          padding: 2px 4px;
          border-radius: 4px;
          transition: background 1.5s ease;
        }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl text-white font-semibold">{selectedDocId ? `Document: ${selectedDocId}` : "Select a document"}</h2>
          {statusMsg && <div className="text-sm text-slate-400">{statusMsg}</div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md bg-transparent p-1 border border-transparent">
            <button
              onClick={() => {
                if (fileAvailable === false) {
                  setStatusMsg('Original file not available — may have been deleted or moved.');
                  setTimeout(() => setStatusMsg(null), 2500);
                  return;
                }
                setViewMode('original');
              }}
              className={`px-3 py-1 rounded-l-md font-medium text-sm transition ${
                viewMode === 'original'
                  ? 'bg-white/8 text-white shadow-inner'
                  : 'bg-transparent text-slate-300 hover:bg-white/5'
              }`}
              title={fileAvailable === false ? 'Original file not available' : 'Show original document'}
            >
              Document
            </button>

            <button
              onClick={() => setViewMode('parsed')}
              className={`px-3 py-1 rounded-r-md font-medium text-sm transition ${
                viewMode === 'parsed'
                  ? 'bg-white/8 text-white shadow-inner'
                  : 'bg-transparent text-slate-300 hover:bg-white/5'
              }`}
              title="Show parsed text"
            >
              Parsed
            </button>
          </div>

          <button
            onClick={copyText}
            disabled={!text}
            className="ml-3 px-3 py-1 rounded bg-[#0f1724] text-slate-200 text-sm border border-slate-700 shadow-sm"
          >
            Copy text
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded bg-[#071126] p-4 text-slate-200 text-sm whitespace-pre-wrap">
        {loading && <div className="text-slate-400">Loading document…</div>}
        {error && <div className="text-red-400">{error}</div>}

        {!loading && !error && viewMode === 'parsed' && (
          <>
            {!text && (
              <div className="text-slate-400">
                No document selected or no preview available yet.
              </div>
            )}
            {text && (
              <div id="doc-viewer">
                {text}
              </div>
            )}
          </>
        )}

        {!loading && !error && viewMode === 'original' && (
          <>
            {fileAvailable === null && selectedDocId && (
              <div className="text-slate-400">Checking if the original file is still available…</div>
            )}
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