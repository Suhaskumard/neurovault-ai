import json
import os
import re
from collections.abc import Iterator

import requests

from chat_memory import ChatMemory
from vector_store import HybridVectorStore


SYSTEM_PROMPT = """You are NeuroVault AI, a careful multimodal RAG assistant.
Answer using the provided context when it is relevant.
If the context is insufficient, say what is missing instead of inventing details.
Keep answers clear, practical, and grounded in the uploaded sources."""

SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")


class RAGPipeline:
    def __init__(self, store: HybridVectorStore, memory: ChatMemory):
        self.store = store
        self.memory = memory
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.model = os.getenv("OLLAMA_MODEL", "llama3")

    @staticmethod
    def _context_from_sources(sources: list[dict]) -> str:
        if not sources:
            return "No retrieved context."
        return "\n\n".join(
            f"Source: {source['file']}\nSnippet: {source['snippet']}" for source in sources
        )

    def _build_prompt(self, query: str, sources: list[dict]) -> str:
        memory_context = self.memory.recent_context(turns=2)
        source_context = self._context_from_sources(sources)
        return f"""{SYSTEM_PROMPT}

Recent chat:
{memory_context or "No prior chat."}

Retrieved context:
{source_context}

User question:
{query}

Answer:"""

    @staticmethod
    def _keywords(query: str) -> set[str]:
        stop_words = {
            "a",
            "an",
            "and",
            "are",
            "as",
            "at",
            "be",
            "by",
            "for",
            "from",
            "how",
            "in",
            "is",
            "it",
            "of",
            "on",
            "or",
            "the",
            "this",
            "to",
            "what",
            "when",
            "where",
            "which",
            "who",
            "why",
            "with",
        }
        return {word for word in re.findall(r"\w+", query.lower()) if len(word) > 2 and word not in stop_words}

    @staticmethod
    def _clean_sentence(text: str) -> str:
        cleaned = re.sub(r"\s+", " ", text).strip(" -")
        cleaned = cleaned.replace(" .", ".").replace(" ,", ",")
        return cleaned

    @staticmethod
    def _sentence_quality(sentence: str) -> float:
        score = 0.0
        words = sentence.split()
        word_count = len(words)

        if 8 <= word_count <= 30:
            score += 2.0
        elif 5 <= word_count <= 40:
            score += 1.0

        if re.match(r"^\d+[.)]\s*", sentence):
            score -= 2.0
        if sentence.lower().startswith(("step ", "example prompt", "action :")):
            score -= 1.5
        if sentence.count("-") > 3:
            score -= 1.0
        if any(token in sentence.lower() for token in ["this solution", "the system", "the platform", "the chatbot", "architecture", "workflow"]):
            score += 1.0
        if sentence.endswith("."):
            score += 0.5

        return score

    def _query_is_explanatory(self, query: str) -> bool:
        query_lower = query.lower()
        triggers = [
            "explain",
            "summary",
            "summarize",
            "what is this",
            "what does this mean",
            "tell me about",
            "describe",
        ]
        return any(trigger in query_lower for trigger in triggers)

    def _fallback_answer(self, query: str, sources: list[dict]) -> str:
        if not sources:
            return (
                "I could not find relevant uploaded context yet. Upload documents or images, "
                "then ask again."
            )

        keywords = self._keywords(query)
        candidate_sentences: list[tuple[int, str]] = []
        for source in sources:
            for sentence in SENTENCE_PATTERN.split(source["snippet"]):
                clean_sentence = self._clean_sentence(sentence)
                if not clean_sentence:
                    continue
                score = sum(1 for keyword in keywords if keyword in clean_sentence.lower())
                score += self._sentence_quality(clean_sentence)
                candidate_sentences.append((score, clean_sentence))

        ranked = sorted(candidate_sentences, key=lambda item: item[0], reverse=True)
        best_sentences = []
        for _, sentence in ranked:
            if sentence not in best_sentences:
                best_sentences.append(sentence)
            if len(best_sentences) == 3:
                break

        if not best_sentences:
            best_sentences = [self._clean_sentence(sources[0]["snippet"])]

        source_names = ", ".join(sorted({source["file"] for source in sources}))

        if self._query_is_explanatory(query):
            best_sentences = sorted(best_sentences, key=self._sentence_quality, reverse=True)
            lead = best_sentences[0]
            extras = [sentence for sentence in best_sentences[1:] if sentence and sentence != lead]
            if extras:
                return (
                    f"Here is the main idea from {source_names}: {lead} "
                    f"Key details: {'; '.join(extras[:2])}."
                )
            return f"Here is the main idea from {source_names}: {lead}."

        if len(best_sentences) == 1:
            return f"From {source_names}: {best_sentences[0]}"

        return f"From {source_names}: {best_sentences[0]} Key details: {'; '.join(best_sentences[1:3])}."

    def _ollama_payload(self, prompt: str, stream: bool) -> dict:
        return {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {"temperature": 0.2, "num_ctx": 4096},
        }

    def answer(self, query: str, top_k: int = 3) -> dict:
        search_query = f"{self.memory.recent_context(turns=2)}\n{query}".strip()
        sources = self.store.search(search_query, top_k=top_k)
        prompt = self._build_prompt(query, sources)

        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=self._ollama_payload(prompt, stream=False),
                timeout=120,
            )
            response.raise_for_status()
            answer = response.json().get("response", "").strip()
        except Exception:
            answer = self._fallback_answer(query, sources)

        self.memory.add("user", query)
        self.memory.add("assistant", answer)
        return {"answer": answer, "sources": [{"file": s["file"], "snippet": s["snippet"]} for s in sources]}

    def stream_answer(self, query: str, top_k: int = 3) -> Iterator[str]:
        search_query = f"{self.memory.recent_context(turns=2)}\n{query}".strip()
        sources = self.store.search(search_query, top_k=top_k)
        prompt = self._build_prompt(query, sources)
        full_answer: list[str] = []

        try:
            with requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=self._ollama_payload(prompt, stream=True),
                timeout=120,
                stream=True,
            ) as response:
                response.raise_for_status()
                for line in response.iter_lines():
                    if not line:
                        continue
                    payload = json.loads(line.decode("utf-8"))
                    token = payload.get("response", "")
                    if token:
                        full_answer.append(token)
                        yield f"data: {json.dumps({'token': token})}\n\n"
                    if payload.get("done"):
                        break
        except Exception:
            fallback = self._fallback_answer(query, sources)
            full_answer.append(fallback)
            for word in fallback.split(" "):
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"

        answer = "".join(full_answer).strip()
        self.memory.add("user", query)
        self.memory.add("assistant", answer)
        clean_sources = [{"file": s["file"], "snippet": s["snippet"]} for s in sources]
        yield f"data: {json.dumps({'sources': clean_sources, 'done': True})}\n\n"
