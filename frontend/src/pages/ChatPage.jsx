import { useEffect, useRef, useState } from "react";

import { chat, clearIndex, getHealth, reindexUploads, streamChat, uploadFiles } from "../api";
import ChatBubble from "../components/ChatBubble";
import Sidebar from "../components/Sidebar";

const STORAGE_KEY = "neurovault-chat-sessions";

const welcomeMessage = {
  role: "assistant",
  content:
    "Upload documents or images, then ask what you want to know. I will answer with the strongest retrieved sources.",
  sources: []
};

function createChatSession(id, title = "New chat") {
  return {
    id,
    title,
    messages: [welcomeMessage],
  };
}

function makeChatTitle(query) {
  const trimmed = query.trim();
  if (!trimmed) return "New chat";
  return trimmed.length > 36 ? `${trimmed.slice(0, 36)}...` : trimmed;
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [topK, setTopK] = useState(3);
  const [status, setStatus] = useState("Ready for PDF, TXT, DOCX, PNG, JPG, WEBP, BMP, and TIFF.");
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollRef = useRef(null);
  const composerFileRef = useRef(null);
  const recognitionRef = useRef(null);
  const [chats, setChats] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [createChatSession(`chat-${Date.now()}`)];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length ? parsed : [createChatSession(`chat-${Date.now()}`)];
    } catch {
      return [createChatSession(`chat-${Date.now()}`)];
    }
  });
  const [currentChatId, setCurrentChatId] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed[0]?.id ? parsed[0].id : null;
    } catch {
      return null;
    }
  });

  const currentChat = chats.find((item) => item.id === currentChatId) ?? chats[0];
  const messages = currentChat?.messages ?? [welcomeMessage];

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentChatId && chats[0]?.id) {
      setCurrentChatId(chats[0].id);
    }
  }, [chats, currentChatId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop?.();
    };
  }, []);

  useEffect(() => {
    async function loadHealth() {
      try {
        const health = await getHealth();
        if (!health.indexed_chunks) {
          setStatus(
            health.ollama_available
              ? "No indexed files yet. Upload a document or image to start."
              : "No indexed files yet, and Ollama is offline. Upload files and start Ollama for full answers."
          );
          return;
        }

        setStatus(
          health.ollama_available
            ? `${health.indexed_chunks} chunks indexed across ${health.uploaded_files} file(s).`
            : `${health.indexed_chunks} chunks indexed across ${health.uploaded_files} file(s). Ollama is offline, so fallback answers are active.`
        );
      } catch {
        setStatus("Backend connection failed. Check FastAPI on port 8000.");
      }
    }

    loadHealth();
  }, []);

  function updateLastAssistant(updater) {
    setChats((current) => {
      const activeId = currentChat?.id ?? currentChatId;
      return current.map((chatSession) => {
        if (chatSession.id !== activeId) return chatSession;
        const nextMessages = [...chatSession.messages];
        const last = nextMessages[nextMessages.length - 1];
        nextMessages[nextMessages.length - 1] = updater(last);
        return { ...chatSession, messages: nextMessages };
      });
    });
  }

  function updateCurrentChatMessages(updater) {
    setChats((current) =>
      current.map((chatSession) =>
        chatSession.id === (currentChat?.id ?? currentChatId)
          ? { ...chatSession, messages: updater(chatSession.messages), title: chatSession.title }
          : chatSession
      )
    );
  }

  function renameCurrentChat(title) {
    setChats((current) =>
      current.map((chatSession) => {
        if (chatSession.id !== (currentChat?.id ?? currentChatId)) return chatSession;
        const shouldRename = !chatSession.title || chatSession.title === "New chat";
        return shouldRename ? { ...chatSession, title } : chatSession;
      })
    );
  }

  function createAndSelectChat() {
    const nextChat = createChatSession(`chat-${Date.now()}`);
    setChats((current) => [nextChat, ...current]);
    setCurrentChatId(nextChat.id);
    return nextChat.id;
  }

  function handleNewChat() {
    createAndSelectChat();
    setInput("");
    setStatus("New chat started. Upload files or ask a question.");
    setMenuOpen(false);
  }

  function handleSelectChat(chatId) {
    setCurrentChatId(chatId);
    setInput("");
    setMenuOpen(false);
    const selected = chats.find((chatSession) => chatSession.id === chatId);
    if (selected) {
      setStatus(`Opened chat: ${selected.title}`);
    }
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setStatus("Link copied to clipboard.");
      setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setStatus("Could not copy the link from this browser.");
    }
  }

  function handleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setStatus("Speech recognition is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      recognitionRef.current = recognition;
      setIsListening(true);
      setStatus("Listening… speak now.");
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      setStatus(`Mic error: ${event.error || "speech recognition failed"}`);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
      setStatus((currentStatus) =>
        currentStatus === "Listening… speak now." ? "Voice input captured. Edit or send your message." : currentStatus
      );
    };

    recognition.start();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const query = input.trim();
    if (!query || isLoading) return;

    setInput("");
    setIsLoading(true);
    renameCurrentChat(makeChatTitle(query));
    updateCurrentChatMessages((currentMessages) => [
      ...currentMessages,
      { role: "user", content: query },
      { role: "assistant", content: "", sources: [] }
    ]);

    try {
      await streamChat({
        query,
        topK,
        onToken: (token) => {
          updateLastAssistant((message) => ({ ...message, content: `${message.content}${token}` }));
        },
        onSources: (sources) => {
          updateLastAssistant((message) => ({ ...message, sources }));
        }
      });
    } catch (streamError) {
      try {
        const result = await chat(query, topK);
        updateLastAssistant(() => ({
          role: "assistant",
          content: result.answer,
          sources: result.sources || []
        }));
      } catch (err) {
        updateLastAssistant(() => ({
          role: "assistant",
          content: err?.response?.data?.detail || streamError.message || "I could not complete that request.",
          sources: []
        }));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleClear() {
    setIsLoading(true);
    try {
      const result = await clearIndex();
      setChats((current) =>
        current.map((chatSession) =>
          chatSession.id === (currentChat?.id ?? currentChatId)
            ? { ...chatSession, messages: [welcomeMessage] }
            : chatSession
        )
      );
      setStatus(
        result?.uploaded_files_preserved
          ? `Index cleared. ${result.uploaded_files_preserved} uploaded file(s) are still available for reindexing.`
          : "Index cleared."
      );
    } catch (err) {
      setStatus(err?.response?.data?.detail || err.message || "Clear failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReindex() {
    setIsLoading(true);
    try {
      const result = await reindexUploads();
      handleUploaded(result);
      if (!result?.uploaded?.length) {
        setStatus("No uploaded files found to reindex.");
      }
    } catch (err) {
      setStatus(err?.response?.data?.detail || err.message || "Reindex failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleUploaded(result) {
    const uploaded = Array.isArray(result?.uploaded) ? result.uploaded : [];
    const indexed = uploaded.map((file) => `${file.file}: ${file.chunks} chunks`).join(" | ");
    const fallback =
      typeof result?.files_processed === "number"
        ? `${result.files_processed} file(s), ${result.total_chunks || 0} chunks indexed`
        : "";
    setStatus(indexed || fallback || "Upload finished.");
  }

  async function handleComposerFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsLoading(true);
    setStatus("Uploading files...");
    try {
      const result = await uploadFiles(files);
      handleUploaded(result);
    } catch (err) {
      setStatus(err?.response?.data?.detail || err.message || "Upload failed.");
    } finally {
      setIsLoading(false);
      if (composerFileRef.current) composerFileRef.current.value = "";
    }
  }

  return (
    <div className="flex h-full flex-col bg-transparent text-[#ececec] md:flex-row">
      <Sidebar
        chats={chats}
        currentChatId={currentChat?.id}
        topK={topK}
        setTopK={setTopK}
        onClear={handleClear}
        onReindex={handleReindex}
        onUploaded={handleUploaded}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        status={status}
      />

      <main className="relative flex min-h-0 flex-1 flex-col bg-transparent animate-fade-in">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-white/5 glass-panel px-3 md:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-xl font-semibold text-zinc-100 hover:bg-white/6"
          >
            NeuroVault AI
            <span className="text-sm text-zinc-400">v</span>
          </button>
          {menuOpen && (
            <div className="absolute left-4 top-16 z-20 w-64 rounded-2xl border border-white/10 bg-[#0a0a0c]/90 p-2 shadow-2xl shadow-black/80 backdrop-blur-xl md:left-8 animate-slide-up">
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10"
              >
                Start new chat
              </button>
              <button
                type="button"
                onClick={() => composerFileRef.current?.click()}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-100 hover:bg-white/10"
              >
                Upload from composer
              </button>
              <p className="px-3 py-2 text-xs leading-5 text-zinc-400">{status}</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-100 hover:bg-white/6"
            >
              {shareCopied ? "Copied" : "Share"}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-lg px-3 py-2 text-lg leading-none text-zinc-300 hover:bg-white/6"
            >
              ...
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-0 pb-44 pt-8">
          {messages.length === 1 && messages[0].content === welcomeMessage.content && (
            <div className="mx-auto flex w-full max-w-[960px] items-center justify-between gap-6 px-6 pb-2">
              <div>
                <h1 className="text-[30px] font-semibold tracking-tight text-white">Ask your documents anything</h1>
                <p className="mt-2 max-w-[620px] text-sm leading-6 text-zinc-400">
                  Upload reports, PDFs, DOCX files, or images and get grounded answers with retrieved source context.
                </p>
              </div>
              <div className="hidden h-20 w-20 shrink-0 rounded-2xl border border-emerald-300/15 bg-gradient-to-br from-emerald-400/15 to-sky-400/10 shadow-[0_0_40px_rgba(16,185,129,0.08)] md:block" />
            </div>
          )}
          {messages.map((message, index) => (
            <ChatBubble key={`${message.role}-${index}`} message={message} />
          ))}
          {isLoading && (
            <div className="mx-auto flex w-full max-w-[960px] items-center gap-4 px-6 text-sm text-zinc-400">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/20 bg-gradient-to-br from-[#131313] to-[#1d1d1d] text-sm font-semibold text-white">
                N
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span>Thinking through your files…</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#050505] via-[#050505]/90 to-transparent px-4 pb-8 pt-10"
        >
          <div className="mx-auto flex max-w-[960px] items-end gap-3 rounded-[32px] border border-white/10 bg-[#0a0a0c]/70 p-2.5 shadow-[0_0_40px_rgba(0,0,0,0.3)] backdrop-blur-3xl transition-all focus-within:shadow-[0_0_40px_rgba(16,185,129,0.15)] focus-within:border-emerald-500/30">
            <button
              type="button"
              onClick={() => composerFileRef.current?.click()}
              className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-2xl text-zinc-300 hover:bg-white/[0.08]"
              aria-label="Attach file"
            >
              +
            </button>
            <input
              ref={composerFileRef}
              type="file"
              multiple
              accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
              onChange={handleComposerFiles}
              className="hidden"
            />
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              placeholder="Ask anything"
              rows="1"
              className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-3.5 text-base text-zinc-100 outline-none placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={handleMic}
              className={`mb-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm sm:flex ${
                isListening
                  ? "border-emerald-300/40 bg-emerald-400/15 text-emerald-200"
                  : "border-white/8 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.08]"
              }`}
              aria-label="Voice input"
              title={isListening ? "Stop listening" : "Voice input"}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16a4 4 0 0 0 4-4V8a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 1 1-14 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="mb-1 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 px-6 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none transition-all"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
          <p className="mx-auto mt-3 max-w-[960px] text-center text-xs text-zinc-500">
            Answers may need verification against the original documents.
          </p>
        </form>
      </main>
    </div>
  );
}
