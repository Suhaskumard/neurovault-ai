import { useState } from "react";

import FileUpload from "./FileUpload";

export default function Sidebar({
  chats,
  currentChatId,
  topK,
  setTopK,
  onClear,
  onReindex,
  onUploaded,
  onNewChat,
  onSelectChat,
  status,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const visibleChats = chats.filter((chat) => chat.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <aside className="hidden h-full w-[320px] shrink-0 flex-col border-r border-white/6 bg-[#171717]/95 text-[#ececec] backdrop-blur md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/20 bg-gradient-to-br from-emerald-400/15 to-sky-400/10 text-sm font-semibold text-white shadow-[0_0_30px_rgba(16,185,129,0.08)]">
          NV
        </div>
        <button
          type="button"
          onClick={onNewChat}
          className="rounded-md px-2 py-1 text-lg leading-none text-zinc-400 hover:bg-[#202020] hover:text-white"
          title="Start a new chat"
        >
          =
        </button>
      </div>

      <div className="space-y-1 px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-100 hover:bg-white/7"
        >
          <span className="text-xl leading-none">+</span>
          New chat
        </button>
        <button
          type="button"
          onClick={() => setIsSearchOpen((value) => !value)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-100 hover:bg-white/7"
        >
          <span className="text-lg leading-none">Q</span>
          Search chats
        </button>
        {isSearchOpen && (
          <input
            autoFocus
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search recents"
            className="mt-2 w-full rounded-lg border border-white/10 bg-[#202020] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-emerald-300/30 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]"
          />
        )}
      </div>

      <div className="mt-3 flex-1 overflow-y-auto border-t border-white/[0.04] px-3 py-4">
        <p className="px-3 pb-2 text-sm font-medium text-zinc-400">Recents</p>
        <div className="space-y-1">
          {visibleChats.map((chat, index) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => onSelectChat(chat.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-zinc-100 hover:bg-white/7 ${
                chat.id === currentChatId || (!currentChatId && index === 0)
                  ? "bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  : ""
              }`}
            >
              <span className="truncate">{chat.title}</span>
              {index < 3 && <span className="text-zinc-500">.</span>}
            </button>
          ))}
          {visibleChats.length === 0 && (
            <div className="rounded-lg px-3 py-3 text-sm text-zinc-500">No matching chats</div>
          )}
        </div>
      </div>

      <div className="space-y-3 border-t border-white/10 p-3">
        <FileUpload onUploaded={onUploaded} />

        <div className="space-y-3 rounded-xl border border-white/8 bg-[#202020] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-200">Top-k</label>
            <span className="rounded-md border border-white/8 bg-[#303030] px-2 py-1 text-xs text-zinc-200">{topK}</span>
          </div>
          <input
            type="range"
            min="3"
            max="5"
            value={topK}
            onChange={(event) => setTopK(Number(event.target.value))}
            className="w-full accent-[#ececec]"
          />
        </div>

        <button
          type="button"
          onClick={onClear}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/7"
        >
          Clear index
        </button>
        <button
          type="button"
          onClick={onReindex}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/7"
        >
          Reindex uploads
        </button>

        <p className="rounded-xl border border-white/8 bg-[#202020] p-3 text-xs leading-5 text-zinc-400 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">{status}</p>

        <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.05]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300/25 to-sky-300/20 text-xs font-semibold">
            SK
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-white">Suhas Kumar</p>
            <p className="text-xs text-zinc-400">Local</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
