import React, { useState } from "react";

export default function DomainCards() {
  const items = [
    { title: 'Insurance', sub: 'Policy analysis' },
    { title: 'Law', sub: 'Legal docs' },
    { title: 'Government', sub: 'Regulations' },
    { title: 'More', sub: 'Other docs' },
  ];
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto px-8 mt-12 grid grid-cols-2 md:grid-cols-4 gap-6">
      {items.map((i) => {
        const isHover = hovered === i.title;
        const titleStyle: React.CSSProperties = {
          transition: 'color 160ms ease, text-shadow 160ms ease',
          color: isHover ? '#13a4ec' : 'rgba(230,238,248,0.9)',
          textShadow: isHover ? '0 4px 18px rgba(19,164,236,0.95), 0 0 28px rgba(0,242,234,0.12)' : 'none',
        };

        return (
          <div
            key={i.title}
            onMouseEnter={() => setHovered(i.title)}
            onMouseLeave={() => setHovered(null)}
            className="rounded-xl p-6 domain-btn cursor-pointer hover:scale-[1.02]"
          >
            <div className="font-semibold" style={titleStyle}>{i.title}</div>
            <div className="text-slate-400 text-xs mt-2">{i.sub}</div>
          </div>
        );
      })}
    </div>
  );
}