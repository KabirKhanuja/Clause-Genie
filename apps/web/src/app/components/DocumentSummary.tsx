export default function DocumentSummary() {
  const bullets = [
    'Key Clause: Coverage limits and exclusions.',
    'Obligation: Submit claim within 30 days.',
    'Risk: Exclusion for pre-existing damage (see Clause 7.2).'
  ];
  return (
    <div className="text-slate-300">
      <ol className="list-decimal list-inside space-y-3">
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ol>
      <div className="mt-6">
        <button className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-black font-semibold">Chat with Genie</button>
      </div>
    </div>
  );
}