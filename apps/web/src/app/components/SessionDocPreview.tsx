"use client";

import { useEffect, useState, useRef } from "react";

type DocMeta = {
  docId: string;
  originalname?: string;
  mimetype?: string;
  parsedAt?: string;
  status?: string;
  size?: number;
  preview?: string;
  text?: string | null;
};

export default function SessionDocPreview({ sessionId }: { sessionId?: string }) {
  const [docId, setDocId] = useState<string | null>(null);
  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"parsed" | "document">("parsed");
  const [error, setError] = useState<string | null>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? "http://localhost:4000" : "");

  useEffect(() => {
    function readHash() {
      const h = (window.location.hash || "").replace("#doc-", "");
      setDocId(h || null);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  useEffect(() => {
    if (!docId || !sessionId) {
      setMeta(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}/doc/${encodeURIComponent(docId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch doc (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setMeta({
          docId: json.docId,
          originalname: json.originalname,
          mimetype: json.mimetype,
          parsedAt: json.parsedAt,
          status: json.status,
          size: json.size,
          preview: json.text ? json.text.slice(0, 500) : json.preview || null,
          text: json.text || null
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load document preview");
        setMeta(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [sessionId, docId]);

  // memoize original file URL to avoid iframe reloads when toggling view
  useEffect(() => {
    if (sessionId && meta?.docId) {
      const url = `${API_BASE}/api/session/${encodeURIComponent(sessionId)}/doc/${encodeURIComponent(meta.docId)}/file`;
      setIframeSrc(url);
    } else {
      setIframeSrc(null);
    }
  }, [API_BASE, sessionId, meta?.docId]);

  function highlightedHtml(text: string | null, q?: string) {
    if (!text) return "";
    if (!q) return escapeHtml(text);
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${esc})`, "ig");
    const html = escapeHtml(text).replace(re, "<mark class='bg-yellow-300/40 text-black rounded'>$1</mark>");
    return html;
  }

  function escapeHtml(str: string) {
    return String(str).replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    } as any)[s]);
  }

  if (!sessionId) {
    return <div className="text-sm text-slate-400">No session selected.</div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div>
          <div className="text-sm text-slate-400">Preview</div>
          <div className="text-white font-medium">{meta?.originalname || docId || "No document"}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("document")}
            className={`px-3 py-1 rounded ${view === "document" ? "bg-[#0f1724] text-white" : "bg-transparent text-slate-300 border border-transparent hover:bg-[#071126]"}`}
          >
            Document
          </button>
          <button
            onClick={() => setView("parsed")}
            className={`px-3 py-1 rounded ${view === "parsed" ? "bg-[#0f1724] text-white" : "bg-transparent text-slate-300 border border-transparent hover:bg-[#071126]"}`}
          >
            Parsed
          </button>
        </div>
      </div>

      <div className="rounded bg-[#061026]/30 border border-slate-700 p-3 min-h-[200px] max-h-[68vh] overflow-hidden relative">
        {loading && <div className="text-slate-400 p-4">Loading preview…</div>}
        {error && <div className="text-sm text-red-400 p-4">{error}</div>}

        {!loading && !meta && <div className="text-slate-400 p-4">Select a document to preview</div>}

        {/* Parsed view (always mounted — hidden with CSS instead of unmounted) */}
        <div
          style={{
            display: view === "parsed" ? "block" : "none",
            overflow: "auto",
            height: "100%"
          }}
          className="prose prose-sm text-slate-200 p-3"
        >
          <div
            style={{ whiteSpace: "pre-wrap", fontFamily: "ui-sans-serif, system-ui, -apple-system" }}
            dangerouslySetInnerHTML={{
              __html: highlightedHtml(meta?.text || meta?.preview || "", undefined)
            }}
          />
        </div>

        {/* Document view (always mounted — iframe NEVER unmounts) */}
        <div
          style={{
            display: view === "document" ? "block" : "none",
            height: "100%"
          }}
        >
          {meta?.mimetype?.startsWith("image/") ? (
            <img
              src={iframeSrc || ""}
              alt={meta?.originalname}
              className="max-w-full rounded shadow block mx-auto"
              style={{ maxHeight: "68vh", width: "auto" }}
            />
          ) : meta?.mimetype === "application/pdf" ||
            meta?.originalname?.toLowerCase().endsWith(".pdf") ? (
            <iframe
              src={iframeSrc || ""}
              title={meta?.originalname || "Document"}
              style={{ width: "100%", height: "68vh", border: "none" }}
            />
          ) : (
            <div className="p-3">
              <div className="text-slate-400 mb-2">Original file preview not available.</div>
              <a
                className="inline-block px-3 py-2 bg-[#0f1724] text-slate-200 rounded"
                href={`${API_BASE}/api/session/${sessionId}/doc/${meta?.docId}/file`}
                target="_blank"
                rel="noreferrer"
              >
                Open / Download original
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}