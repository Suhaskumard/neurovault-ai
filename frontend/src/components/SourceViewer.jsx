export default function SourceViewer({ sources }) {
  return (
    <div className="mt-5 space-y-2 pt-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">Sources</p>
      {sources.map((source, index) => (
        <details key={`${source.file}-${index}`} className="rounded-xl border border-white/8 bg-[#232323] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
          <summary className="cursor-pointer text-xs font-medium text-zinc-200 marker:text-zinc-500">{source.file}</summary>
          <p className="mt-2 text-xs leading-5 text-zinc-300">{source.snippet}</p>
        </details>
      ))}
    </div>
  );
}
