'use client';
import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadCard() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);

  // file size formatting 
  const formatSize = (bytes: number | undefined) => {
    if (bytes == null) return '';
    const kb = Math.round(bytes / 1024);
    const mb = bytes / (1024 * 1024);
    return `${kb.toLocaleString()} KB (${mb.toFixed(2)} MB)`;
  };

  function handleFiles(selected: FileList | null) {
    if (!selected) return;
    const arr = Array.from(selected).slice(0, 8); 
    setFiles((prev) => {
      const next = [...prev, ...arr];
      setSelectedIndex(Math.max(0, prev.length));
      return next;
    });
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
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setSelectedIndex((cur) => {
        if (next.length === 0) return 0;
        if (index === cur) return 0;
        if (index < cur) return Math.max(0, cur - 1);
        return cur;
      });
      return next;
    });
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function uploadToServer(formData: FormData) {
    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('POST', 'http://localhost:4000/api/upload');

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          setProgress(pct);
        }
      };

      xhr.onload = () => {
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
      // revoke preview URL when upload completes
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }

  // Manage preview URL for selected file
  useEffect(() => {
    if (!files || files.length === 0) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      if (previewText) setPreviewText(null);
      return;
    }

    const f = files[Math.max(0, Math.min(selectedIndex, files.length - 1))];
    if (!f) return;
    // revoke previous
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // reset prior text preview
    if (previewText) setPreviewText(null);

    // for DOCX files, attempt a lightweight client-side preview (extract text from the .docx)
    const isDocx = f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || f.name.toLowerCase().endsWith('.docx');
    if (isDocx) {
      // create an object URL only for consistency, but we will show text preview
      setPreviewUrl(null);
      (async () => {
        try {
          const JSZip = (await import('jszip')).default;
          const zip = await JSZip.loadAsync(f);
          const docXmlFile = zip.file('word/document.xml');
          if (docXmlFile) {
            const docXml = await docXmlFile.async('string');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(docXml, 'application/xml');
            const textNodes = xmlDoc.getElementsByTagName('w:t');
            let text = '';
            for (let i = 0; i < textNodes.length; i++) {
              text += (textNodes[i].textContent || '') + ' ';
            }
            text = text.trim().replace(/\s+/g, ' ').slice(0, 300);
            if (text) setPreviewText(text);
            else setPreviewText('Preview not available');
          } else {
            setPreviewText('Preview not available');
          }
        } catch (err) {
          setPreviewText('Preview not available');
        }
      })();
      return;
    }

    // create new preview URL for browsers to render (images, pdf)
    try {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
    } catch (e) {
      setPreviewUrl(null);
    }

    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (previewText) setPreviewText(null);
    };
  }, [files, selectedIndex]);

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

          <div className="flex gap-4">
            <ul className="space-y-2 w-1/2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  onClick={() => setSelectedIndex(i)}
                  className={`flex items-center justify-between bg-[#061026]/40 p-2 rounded cursor-pointer min-w-0 ${i === selectedIndex ? 'ring-2 ring-[#13a4ec]' : ''}`}
                >
                  <div className="min-w-0 mr-4">
                    <div title={f.name} className="text-white text-sm font-medium truncate">{f.name}</div>
                    <div className="text-slate-400 text-xs">{formatSize(f.size)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={(ev) => { ev.stopPropagation(); removeFile(i); }} className="text-slate-300 text-sm">Remove</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="w-1/2 bg-[#061026]/20 p-3 rounded flex items-center justify-center">
              {/* Preview pane */}
              {previewUrl || previewText ? (
                (() => {
                  const f = files[Math.max(0, Math.min(selectedIndex, files.length - 1))];
                  if (!f) return <div className="text-slate-400">No preview</div>;
                  if (previewText) {
                    return <div className="text-slate-200 text-sm whitespace-pre-wrap max-h-48 overflow-auto">{previewText}</div>;
                  }
                  if (f.type && f.type.startsWith('image/')) {
                    return <img src={previewUrl as string} alt={f.name} className="max-h-48 object-contain rounded" />;
                  }
                  if (f.type === 'application/pdf') {
                    return (
                      <embed src={previewUrl as string} type="application/pdf" width="100%" height="220px" />
                    );
                  }
                  return <div className="text-slate-400 text-center">Preview not available for this file type</div>;
                })()
              ) : (
                <div className="text-slate-400">Select a file to preview</div>
              )}
            </div>
          </div>
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