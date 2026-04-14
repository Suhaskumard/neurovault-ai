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
        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-zinc-100 hover:border-emerald-500/40 hover:bg-white/10 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] transition-all group cursor-pointer"
      >
        <div>
          <div className="font-medium text-white transition-colors group-hover:text-emerald-100">Upload files</div>
          <div className="mt-1 text-[11px] text-zinc-400">PDF, TXT, DOCX, PNG, JPG</div>
        </div>
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-lg leading-none text-zinc-300 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 group-hover:border-emerald-500/30 transition-all">+</span>
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
        <div className="h-2 overflow-hidden rounded-full bg-white/5 inset-shadow-sm">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-sky-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <button
        type="button"
        onClick={handleUpload}
        disabled={!selected.length || isUploading}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none transition-all"
      >
        {isUploading ? "Indexing..." : "Upload"}
      </button>
    </div>
  );
}
