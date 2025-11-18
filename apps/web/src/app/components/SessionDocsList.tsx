"use client";

import { useEffect, useState } from "react";

type Doc = {
  docId: string;
  originalname: string;
  size?: number | null;
  mimetype?: string;
  status?: string;
  parsedAt?: string;
  preview?: string;
};

export default function SessionDocsList({ sessionId }: { sessionId?: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (!sessionId) return setDocs(null);
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
        setError(err?.message || "Failed to load session");
        setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  function openDoc(docId: string) {
    try {
      window.location.hash = `doc-${docId}`;
    } catch (e) {
    }
  }

  if (!sessionId) {
    return <div className="text-sm text-slate-400">No session selected. Upload a document first.</div>;
  }

  if (loading) return <div className="text-sm text-slate-400">Loading documents…</div>;
  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (!docs || docs.length === 0) return <div className="text-sm text-slate-400">No documents found for this session yet.</div>;

  return (
    <div className="space-y-3">
      {docs.map((d) => (
        <button
          key={d.docId}
          onClick={() => openDoc(d.docId)}
          className="block w-full text-left p-3 rounded border border-slate-700 bg-[#061026]/40 hover:bg-[#0b1220] transition"
        >
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{d.originalname || d.docId}</div>
              <div className="text-slate-400 text-xs truncate">{d.preview ? `${d.preview.slice(0, 120)}${d.preview.length > 120 ? '…' : ''}` : (d.mimetype || '')}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-slate-300">{d.status || 'uploaded'}</div>
              <div className="text-slate-500">{d.size ? `${(d.size/1024).toFixed(0)} KB` : ''}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}