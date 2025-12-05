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
  onClick?: () => void;
}

export default function CitationChip({ index, citation, onClick }: CitationChipProps) {
  return (
    <button
      onClick={onClick}
      className="
        px-3 py-1 
        text-xs 
        rounded-full 
        bg-gray-800 
        text-gray-200 
        hover:bg-gray-700 
        border border-gray-600
        transition
      "
      title={citation.snippet}
    >
      [{index}]
    </button>
  );
}