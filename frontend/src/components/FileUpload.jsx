import { useRef, useState } from "react";

import { uploadFiles } from "../api";

export default function FileUpload({ onUploaded }) {
  const inputRef = useRef(null);
  const [selected, setSelected] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!selected.length) return;
    setIsUploading(true);
    setError("");
    setProgress(0);
    try {
      const result = await uploadFiles(selected, setProgress);
      onUploaded(result);
      setSelected([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-zinc-200">Knowledge</label>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.docx,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
        onChange={(event) => setSelected(Array.from(event.target.files || []))}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-gradient-to-br from-[#2f2f2f] to-[#252525] px-3 py-3 text-left text-sm text-zinc-100 hover:border-emerald-300/20 hover:bg-[#343434] hover:shadow-[0_10px_24px_rgba(16,185,129,0.06)]"
      >
        <div>
          <div className="font-medium text-white">Upload files</div>
          <div className="mt-1 text-xs text-zinc-400">PDF, TXT, DOCX, PNG, JPG</div>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-lg leading-none text-zinc-300">+</span>
      </button>
      {selected.length > 0 && (
        <div className="max-h-28 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-[#171717] p-2 text-xs text-zinc-400">
          {selected.map((file) => (
            <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
              <p className="truncate text-zinc-300">{file.name}</p>
              <span className="shrink-0 text-[11px] text-zinc-500">{Math.max(1, Math.round(file.size / 1024))} KB</span>
            </div>
          ))}
        </div>
      )}
      {isUploading && (
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!selected.length || isUploading}
        className="w-full rounded-xl bg-gradient-to-r from-[#f1f5f9] to-[#dbeafe] px-3 py-2.5 text-sm font-semibold text-[#111827] hover:from-white hover:to-[#e5f3ff] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-zinc-500"
      >
        {isUploading ? "Indexing..." : "Upload"}
      </button>
    </div>
  );
}
