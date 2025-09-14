'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadCard() {
  const [file, setFile] = useState<File | null>(null);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    // For now mock: navigate to /view
    // Later: call /api/upload and pass file
    router.push('/view');
  }

  return (
    <form onSubmit={handleUpload} className="p-6 rounded-2xl bg-[#081226]/60 border border-slate-700">
      <label className="block mb-4 text-slate-300">Drag & drop or click to upload</label>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.docx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="mb-4 text-sm text-slate-200"
      />
      <div className="flex gap-3">
        <button className="px-4 py-2 rounded-full bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-black font-semibold" type="submit">Upload Document</button>
        <button type="button" onClick={() => setFile(null)} className="px-4 py-2 rounded-full border border-slate-700 text-slate-300">Clear</button>
      </div>
    </form>
  );
}