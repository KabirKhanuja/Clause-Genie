export default function Hero() {
  return (
    <section className="px-8 py-24">
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-white text-4xl md:text-5xl font-extrabold leading-tight">
            Wanna understand and break down your complex documents? Ask Genie ✨
          </h2>
          <p className="mt-6 text-slate-300 text-lg">Upload contracts, policies or reports and get clause-level insights, visual diagrams and contextual answers — all in one session.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="p-6 rounded-2xl bg-[#0f1724]/50 border border-slate-700 card-glow">
            <p className="text-slate-300">Choose a domain to get started</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {['Insurance','Law','Government','More'].map((d) => (
                <div key={d} className="rounded-lg p-3 bg-[#112240]/60 cursor-pointer text-white text-center font-medium">
                  {d}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-[#081226]/40 border border-slate-700">
            <p className="text-slate-400 text-sm">Try a demo document or upload your own. Session context is ephemeral.</p>
          </div>
        </div>
      </div>
    </section>
  );
}