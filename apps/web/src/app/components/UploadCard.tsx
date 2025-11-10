'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadCard() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected).slice(0, 8); // limit to 8
    setFiles((prev) => [...prev, ...arr]);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('ring-2');
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add('ring-2');
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('ring-2');
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function uploadToServer(formData: FormData) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setProgress(pct);
        }
      };
      xhr.onload = () => {
        // @ts-ignore
        const status = xhr.status;
        if (status >= 200 && status < 300) {
          try {
            const json = JSON.parse(xhr.responseText);
            resolve(new Response(JSON.stringify(json), { status }));
          } catch (err) {
            resolve(new Response(xhr.responseText, { status }));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText || status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  }

  async function handleUpload(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }
    setUploading(true);
    setProgress(0);

    const form = new FormData();
    files.forEach((f) => form.append('files', f));

    try {
      const res = await uploadToServer(form);
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      const sessionId = data.sessionId;
      if (sessionId) router.push(`/view?sessionId=${encodeURIComponent(sessionId)}`);
      else router.push('/view');
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleUpload} className="p-6 rounded-2xl bg-[#081226]/60 border border-slate-700">
      <label className="block mb-4 text-slate-300">Drag & drop or click to upload</label>

      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={openFilePicker}
        role="button"
        tabIndex={0}
        className="mb-4 p-6 border-2 border-dashed border-slate-700 rounded-md text-slate-200 cursor-pointer flex flex-col items-center justify-center"
        style={{ minHeight: 140 }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx"
          multiple
          onChange={onInputChange}
          className="hidden"
        />
        <div className="text-sm text-slate-400">Drop files here, or click to browse</div>
        <div className="mt-3 text-xs text-slate-500">Accepted: .pdf, .png, .jpg, .jpeg, .docx (max {"50MB"} per file)</div>
      </div>

      {files.length > 0 && (
        <div className="mb-4">
          <div className="text-slate-300 mb-2">Files to upload</div>
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between bg-[#061026]/40 p-2 rounded">
                <div>
                  <div className="text-white text-sm font-medium">{f.name}</div>
                  <div className="text-slate-400 text-xs">{Math.round(f.size / 1024)} KB</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-300 text-sm">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

      {uploading && (
        <div className="mb-4">
          <div className="text-slate-300 text-sm mb-1">Uploading: {progress}%</div>
          <div className="w-full bg-slate-700 rounded h-2 overflow-hidden">
            <div style={{ width: `${progress}%` }} className="h-2 bg-gradient-to-r from-[#13a4ec] to-[#00f2ea]" />
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button disabled={uploading} className="px-4 py-2 rounded-full bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-black font-semibold" type="submit">{uploading ? 'Uploading...' : 'Upload Document'}</button>
        <button type="button" onClick={() => setFiles([])} disabled={uploading} className="px-4 py-2 rounded-full border border-slate-700 text-slate-300">Clear</button>
      </div>
    </form>
  );
}