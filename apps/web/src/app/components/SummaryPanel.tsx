"use client";

import { useEffect, useState } from "react";

type Doc = {
  docId: string;
  originalname: string;
  summary?: string;
};

export default function DocSummaryPanel({ sessionId }: { sessionId?: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  // watch hash for selected doc
  useEffect(() => {
    function readHash() {
      const h = (window.location.hash || "").replace("#doc-", "");
      setSelectedDocId(h || null);
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  // fetch docs for summaries
  useEffect(() => {
    if (!sessionId) {
      setDocs(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/session/${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to fetch session (${res.status})`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setDocs(json?.docs || []);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load doc summaries");
        setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, API_BASE]);

  if (!sessionId) return null;

  const current = selectedDocId && docs
    ? docs.find((d) => d.docId === selectedDocId)
    : null;

  // When a document is selected but has no summary yet, request one from the backend
  useEffect(() => {
    if (!sessionId || !selectedDocId || !docs || !API_BASE) return;

    const doc = docs.find((d) => d.docId === selectedDocId);
    if (!doc || doc.summary) return;

    let cancelled = false;

    async function generateSummary() {
      try {
        const res = await fetch(
          `${API_BASE}/api/session/${encodeURIComponent(sessionId!)}/doc/${encodeURIComponent(selectedDocId!)}/summary`,
          { method: "POST" }
        );
        if (!res.ok) return;

        const sessionRes = await fetch(
          `${API_BASE}/api/session/${encodeURIComponent(sessionId!)}`
        );
        if (!sessionRes.ok) return;
        const json = await sessionRes.json();
        if (!cancelled) {
          setDocs(json?.docs || []);
        }
      } catch (e: any) {
        if (!cancelled) {
          console.error("Failed to generate summary", e?.message || e);
        }
      }
    }

    generateSummary();

    return () => {
      cancelled = true;
    };
  }, [sessionId, selectedDocId, docs, API_BASE]);

  return (
    <div className="mb-4 rounded-2xl bg-[#081226]/60 border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-100">
          Document summary
        </h3>
        {loading && (
          <span className="text-xs text-slate-400">Loading…</span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400">{error}</div>
      )}

      {!error && !current && (
        <div className="text-xs text-slate-400">
          Select a document from the right to see its summary.
        </div>
      )}

      {!error && current && (
        <>
          <div className="text-xs text-slate-300 mb-1 truncate">
            {current.originalname || current.docId}
          </div>
          <div className="text-sm text-slate-100 whitespace-pre-wrap">
            {current.summary
              ? current.summary
              : "No summary available yet — parsing may still be in progress."}
          </div>
        </>
      )}
    </div>
  );
}