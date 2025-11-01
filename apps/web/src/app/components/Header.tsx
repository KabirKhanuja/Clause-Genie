'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="z-30 relative">
      <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg glow-btn flex items-center justify-center font-bold text-black">G</div>
          <div className="text-white font-semibold">Clause Genie</div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-slate-300">
          <Link href="/" className="hover:text-white transition">Home</Link>
          <Link href="/upload" className="hover:text-white transition">Upload</Link>
          <Link href="/view" className="hover:text-white transition">Document</Link>
          <Link href="/chat" className="hover:text-white transition">Genie</Link>
          <button className="ml-4 px-4 py-2 rounded-full text-black glow-btn">Get Started</button>
        </nav>

        <div className="md:hidden">
          <button onClick={()=>setOpen(!open)} className="p-2 rounded-md bg-white/5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 12h16M4 18h16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden bg-[#051125]/80 border-t border-slate-700/40 px-4 py-4">
          <Link href="/" className="block py-2 text-slate-200">Home</Link>
          <Link href="/upload" className="block py-2 text-slate-200">Upload</Link>
          <Link href="/view" className="block py-2 text-slate-200">Document</Link>
          <Link href="/chat" className="block py-2 text-slate-200">Genie</Link>
        </div>
      )}
    </header>
  );
}