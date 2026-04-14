import SourceViewer from "./SourceViewer";

export default function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`mx-auto flex w-full max-w-[960px] gap-4 px-5 md:px-6 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-gradient-to-br from-[#131313] to-[#1d1d1d] text-sm font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.08)]">
          N
        </div>
      )}
      <div
        className={`${
          isUser
            ? "max-w-[78%] rounded-[18px] border border-white/8 bg-gradient-to-br from-[#343434] to-[#2b2b2b] px-5 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
            : "max-w-[820px] rounded-2xl border border-white/[0.03] bg-white/[0.02] px-5 pb-6 pt-4"
        } text-[15.5px] leading-8 text-[#ececec]`}
      >
        {!isUser && <div className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-zinc-500">NeuroVault</div>}
        <p className="whitespace-pre-wrap break-words">{message.content || " "}</p>
        {!isUser && message.sources?.length > 0 && <SourceViewer sources={message.sources} />}
      </div>
    </div>
  );
}
