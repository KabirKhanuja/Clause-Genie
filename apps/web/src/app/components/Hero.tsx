'use client';
import AnimatedBg from './AnimatedBg';
import { useState } from 'react';

const DOMAINS = ['Insurance','Law','Government','More'];

export default function Hero() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <section className="relative overflow-hidden">
      <AnimatedBg />
      {/* gradient blobs */}
      <div aria-hidden className="blob" style={{ width: 420, height: 420, left: '8%', top: '12%', background: 'radial-gradient(circle at 30% 30%, rgba(19,164,236,0.85), rgba(138,43,226,0.4))', animation: 'blob 10s linear infinite' }} />
      <div aria-hidden className="blob" style={{ width: 360, height: 360, right: '6%', bottom: '14%', background: 'radial-gradient(circle at 70% 70%, rgba(0,242,234,0.65), rgba(138,43,226,0.28))', animation: 'blob 14s linear infinite' }} />

      <div className="max-w-7xl mx-auto px-8 py-28 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-white text-5xl md:text-6xl font-extrabold leading-tight drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
              Wanna understand and break down your complex documents? <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#13a4ec] to-[#8a2be2]">Ask Genie ✨</span>
            </h1>
            <p className="mt-6 text-slate-300 max-w-xl">
              Upload contracts, policies or reports and get clause-level insights, visual diagrams and contextual answers — all in one ephemeral session.
            </p>

            <div className="mt-8 flex gap-3 flex-wrap">
              {DOMAINS.map((d) => (
                <button
                  key={d}
                  onClick={() => setPicked(d)}
                  className={`domain-btn px-5 py-3 text-white font-medium ${picked === d ? 'ring-2 ring-offset-2 ring-[#13a4ec]/40 scale-105' : ''}`}
                  aria-pressed={picked === d}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="mt-6 flex gap-3 items-center">
              <button className="glow-btn px-5 py-3 rounded-full font-semibold text-black">Upload Document</button>
              <a className="text-sm text-slate-400 ml-3">Try demo documents • Session-only</a>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-md relative">
              <div className="panel p-6 rounded-2xl card-glow">
                <h4 className="text-slate-300 text-sm mb-3">Quick summary</h4>
                <div className="text-white font-semibold text-lg">Upload a doc → Ask the Genie → Get clause-level answers</div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#061026]/50">
                    <div className="text-slate-300 text-xs">Average parse</div>
                    <div className="text-white font-bold">~3s</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#061026]/50">
                    <div className="text-slate-300 text-xs">Languages</div>
                    <div className="text-white font-bold">Multi</div>
                  </div>
                </div>

                <div className="mt-4 text-slate-400 text-sm">Tip: Try “Does this policy cover theft?” after uploading.</div>
              </div>

              <img alt="genie" src="/genie-illustration.png" className="absolute right-[-40px] top-[-70px] w-44 opacity-95 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}