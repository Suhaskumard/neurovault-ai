export default function SourceViewer({ sources }) {
  return (
    <div className="mt-5 space-y-2 pt-2 border-t border-white/5">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-500/80">Retrieved Sources</p>
      {sources.map((source, index) => (
        <details key={`${source.file}-${index}`} className="group rounded-xl border border-white/5 bg-[#0a0a0c]/80 p-3 shadow-lg transition-all hover:border-emerald-500/20 data-[open]:border-emerald-500/30 data-[open]:bg-white/5">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-300 marker:text-emerald-500 hover:text-emerald-300 transition-colors">{source.file}</summary>
          <div className="mt-3 overflow-x-auto rounded-lg bg-black/40 p-3 shadow-inner">
            <p className="text-[11px] leading-relaxed text-zinc-400 group-open:animate-fade-in font-mono whitespace-pre-wrap">{source.snippet}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
