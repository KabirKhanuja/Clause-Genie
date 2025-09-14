export default function DomainCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
      {['Insurance','Law','Government','More'].map((d) => (
        <div key={d} className="card-glow p-4 rounded-xl bg-[#112240]/50 border border-slate-700 text-center text-white cursor-pointer">
          <h3 className="font-bold">{d}</h3>
          <p className="text-slate-400 text-xs">{d === 'More' ? 'Other docs' : d === 'Insurance' ? 'Policy analysis' : d === 'Law' ? 'Legal docs' : 'Regulations'}</p>
        </div>
      ))}
    </div>
  );
}