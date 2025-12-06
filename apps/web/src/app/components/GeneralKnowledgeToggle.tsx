import React from "react";

type Props = {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  size?: "sm" | "md";
};

export default function GeneralKnowledgeToggle({ enabled, onToggle, size = "md" }: Props) {
  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const paddingClass = size === "sm" ? "px-2 py-0.5" : "px-3 py-1";
  const textClass = size === "sm" ? "text-[11px]" : "text-sm";
  
  return (
    <button
      onClick={() => onToggle(!enabled)}
      aria-pressed={enabled}
      title={enabled ? "General knowledge: ON" : "General knowledge: OFF"}
      className={`flex items-center gap-1.5 ${paddingClass} rounded-full border transition-all duration-150 select-none
        ${enabled ? 'bg-linear-to-r from-teal-400 to-cyan-500 text-black shadow-[0_6px_20px_rgba(34,197,94,0.18)]' : 'bg-slate-800 text-slate-200 border-slate-700'}`}
    >
      <span className={`${dotSize} rounded-full ${enabled ? 'bg-white' : 'bg-slate-600'}`} />
      <span className={`${textClass} font-medium`}>{enabled ? "General: ON" : "General: OFF"}</span>
    </button>
  );
}