import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000
});

export async function uploadFiles(files, onProgress) {
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("files", file));
  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!event.total || !onProgress) return;
      onProgress(Math.round((event.loaded * 100) / event.total));
    }
  });
  return response.data;
}

export async function clearIndex() {
  const response = await api.post("/clear");
  return response.data;
}

export async function reindexUploads() {
  const response = await api.post("/reindex");
  return response.data;
}

export async function getHealth() {
  const response = await api.get("/health");
  return response.data;
}

export async function chat(query, topK) {
  const response = await api.post("/chat", { query, top_k: topK });
  return response.data;
}

export async function streamChat({ query, topK, onToken, onSources }) {
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK })
  });

  if (!response.ok || !response.body) {
    throw new Error("Streaming failed.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      const line = event.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const payload = JSON.parse(line.slice(6));
      if (payload.token) onToken(payload.token);
      if (payload.sources) onSources(payload.sources);
    }
  }
}
