'use client';
import Link from 'next/link';

export default function Header() {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      <div className="flex items-center gap-3 text-white">
        <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[#13a4ec] to-[#00f2ea] flex items-center justify-center text-black font-bold">G</div>
        <h1 className="text-white text-lg font-bold">Clause Genie</h1>
      </div>

      <nav className="flex items-center gap-6">
        <Link href="/" className="text-slate-300 hover:text-[#00f2ea]">Home</Link>
        <Link href="/upload" className="text-slate-300 hover:text-[#00f2ea]">Upload</Link>
        <Link href="/view" className="text-slate-300 hover:text-[#00f2ea]">Document</Link>
        <Link href="/chat" className="text-slate-300 hover:text-[#00f2ea]">Genie</Link>
        <button className="ml-4 rounded-full px-4 py-2 bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-white font-semibold">Get Started</button>
      </nav>
    </header>
  );
}