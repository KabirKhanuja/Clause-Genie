import React from "react";

interface Citation {
  docId: string;
  chunkId: string;
  score?: number;
  snippet?: string;
}

interface CitationChipProps {
  index: number;
  citation: Citation;
  onClick?: (c: Citation) => void;
}

export default function CitationChip({ index, citation, onClick }: CitationChipProps) {
  const label = `[${index}]`;
  const tip = citation.snippet ? citation.snippet.slice(0, 200) : `${citation.docId}#${citation.chunkId}`;

  return (
    <button
      onClick={() => onClick && onClick(citation)}
      className="
        px-3 py-1 
        text-xs 
        rounded-full 
        bg-gray-800/60 
        text-gray-200 
        hover:bg-gray-700 
        border border-gray-600
        transition
        shadow-sm
      "
      title={tip}
      aria-label={`Citation ${index}`}
      data-docid={citation.docId}
      data-chunkid={citation.chunkId}
    >
      {label}
    </button>
  );
}