export default function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`mx-auto flex w-full max-w-[960px] gap-4 px-5 md:px-6 animate-slide-up ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-white/10">
          NV
        </div>
      )}
      <div
        className={`${
          isUser
            ? "max-w-[78%] rounded-3xl rounded-tr-md border border-white/10 bg-gradient-to-br from-zinc-800 to-zinc-900 px-5 py-3.5 shadow-2xl shadow-black/50"
            : "max-w-[820px] rounded-3xl rounded-tl-md border border-white/5 bg-[#0a0a0c]/60 backdrop-blur-xl px-6 pb-6 pt-5 shadow-xl"
        } text-[15.5px] leading-7 text-zinc-100`}
      >
        {!isUser && (
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            NeuroVault
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.content || " "}</p>
      </div>
    </div>
  );
}
