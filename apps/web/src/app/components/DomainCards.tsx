export default function DomainCards() {
  const items = [
    { title: 'Insurance', sub: 'Policy analysis' },
    { title: 'Law', sub: 'Legal docs' },
    { title: 'Government', sub: 'Regulations' },
    { title: 'More', sub: 'Other docs' },
  ];
  return (
    <div className="max-w-6xl mx-auto px-8 mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
      {items.map(i => (
        <div key={i.title} className="card-glow rounded-xl p-6 domain-btn cursor-pointer hover:scale-[1.02]">
          <div className="text-white font-semibold">{i.title}</div>
          <div className="text-slate-400 text-xs mt-2">{i.sub}</div>
        </div>
      ))}
    </div>
  );
}