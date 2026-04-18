import json
import os
import re
from collections.abc import Iterator

import requests

from chat_memory import ChatMemory
from vector_store import HybridVectorStore


SYSTEM_PROMPT = """You are NeuroVault AI, a careful multimodal RAG assistant.
Answer using the retrieved context when it is relevant.
Write naturally, clearly, and helpfully in a ChatGPT-like style.
Prefer a short direct answer first, then concise bullet points when they improve readability.
If the user asks for a summary, give a brief lead sentence followed by 3 short bullet points.
If the user asks for an explanation, study help, or a solution to a problem, give a fuller answer with clear steps.
When the context supports it, explain the reasoning in simple language.
Do not copy raw snippets or mention 'retrieved context' unless necessary.
If the context is insufficient, say what is missing instead of inventing details.
Never answer from general guesswork when the uploaded material does not support the answer."""

SENTENCE_PATTERN = re.compile(r"(?<=[.!?])\s+")


class RAGPipeline:
    def __init__(self, store: HybridVectorStore, memory: ChatMemory):
        self.store = store
        self.memory = memory
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
        self.model = os.getenv("OLLAMA_MODEL", "llama3")
        self.low_capacity_model = self.model.lower().startswith("tinyllama")

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
        answer_style = self._answer_style_hint(query)
        return f"""{SYSTEM_PROMPT}

Recent chat:
{memory_context or "No prior chat."}

Retrieved context:
{source_context}

User question:
{query}

Answer style:
{answer_style}

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
        cleaned = (
            cleaned.replace("â", "-")
            .replace("â", "-")
            .replace("COâ", "CO2")
            .replace("â", "2")
            .replace("\u0014", " ")
        )
        cleaned = re.sub(r"^[\W_]+", "", cleaned)
        cleaned = re.sub(r"^\d+[.)]\s*", "", cleaned)
        cleaned = re.sub(r"\s*-\s*", " - ", cleaned)
        cleaned = re.sub(r"\b([A-Za-z]{1,4})\s-\s(\d+)\b", r"\1-\2", cleaned)
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
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

    @staticmethod
    def _query_is_broad_overview(query: str) -> bool:
        query_lower = query.lower()
        triggers = [
            "each topic",
            "all topics",
            "every topic",
            "all documents",
            "all files",
            "everything",
            "all the topics",
        ]
        return any(trigger in query_lower for trigger in triggers)

    @staticmethod
    def _query_is_problem_solving(query: str) -> bool:
        query_lower = query.lower()
        triggers = [
            "solve",
            "solution",
            "how to",
            "help me",
            "fix",
            "problem",
            "issue",
            "why",
            "explain",
            "teach me",
        ]
        return any(trigger in query_lower for trigger in triggers)

    def _answer_style_hint(self, query: str) -> str:
        if self._query_is_summary(query):
            return "Give a brief introduction, then 3 short bullet points."
        if self._query_is_problem_solving(query):
            return (
                "Give a detailed but readable answer. Start with the direct answer, then explain step by step. "
                "Use short sections or bullets when helpful."
            )
        return "Give a natural, moderately detailed answer grounded in the uploaded material."

    @staticmethod
    def _query_is_summary(query: str) -> bool:
        query_lower = query.lower()
        triggers = [
            "summary",
            "summarize",
            "bullet",
            "main points",
            "key points",
            "short points",
            "briefly",
            "overview",
        ]
        return any(trigger in query_lower for trigger in triggers)

    @staticmethod
    def _title_case_name(file_name: str) -> str:
        name = re.sub(r"\.[A-Za-z0-9]+$", "", file_name).replace("_", " ").replace("-", " ").strip()
        return name[:1].upper() + name[1:] if name else file_name

    def _select_best_sentences(self, query: str, sources: list[dict], limit: int = 4) -> list[str]:
        keywords = self._keywords(query)
        candidate_sentences: list[tuple[float, str]] = []

        for source in sources:
            for sentence in SENTENCE_PATTERN.split(source["snippet"]):
                clean_sentence = self._clean_sentence(sentence)
                if not clean_sentence:
                    continue
                score = sum(1 for keyword in keywords if keyword in clean_sentence.lower())
                score += self._sentence_quality(clean_sentence)
                candidate_sentences.append((score, clean_sentence))

        ranked = sorted(candidate_sentences, key=lambda item: item[0], reverse=True)
        best_sentences: list[str] = []
        for _, sentence in ranked:
            normalized = sentence.lower()
            if any(normalized == existing.lower() for existing in best_sentences):
                continue
            best_sentences.append(sentence)
            if len(best_sentences) == limit:
                break

        return best_sentences

    def _overview_answer(self) -> tuple[str, list[dict]]:
        files = self.store.list_files()
        if not files:
            return (
                "I could not find any indexed files yet. Upload documents or images first.",
                [],
            )

        overview_lines: list[str] = []
        overview_sources: list[dict] = []

        for file_name in files[:5]:
            file_sources = self.store.representative_chunks(file_name, limit=3)
            overview_sources.extend(file_sources[:1])
            best_sentences = self._select_best_sentences(file_name, file_sources, limit=2)
            if not best_sentences:
                continue
            summary = best_sentences[0]
            overview_lines.append(f"- {self._title_case_name(file_name)}: {summary}")

        if not overview_lines:
            return (
                "I found uploaded files, but I could not extract enough readable text to summarize them yet.",
                overview_sources,
            )

        answer = "Here is a short explanation of the uploaded material:\n\n" + "\n".join(overview_lines)
        return answer, overview_sources

    def _context_is_relevant(self, query: str, sources: list[dict]) -> bool:
        if not sources:
            return False

        keywords = self._keywords(query)
        if not keywords:
            return True

        combined_text = " ".join(source["snippet"].lower() for source in sources)
        matches = sum(1 for keyword in keywords if keyword in combined_text)
        return matches >= max(1, min(2, len(keywords)))

    def _fallback_answer(self, query: str, sources: list[dict]) -> str:
        if not sources:
            return (
                "I could not find relevant uploaded context yet. Upload documents or images, "
                "then ask again."
            )

        best_sentences = self._select_best_sentences(query, sources, limit=4)

        if not best_sentences:
            best_sentences = [self._clean_sentence(sources[0]["snippet"])]

        primary_source = self._title_case_name(sources[0]["file"])

        if self._query_is_summary(query):
            bullet_points = "\n".join(f"- {sentence}" for sentence in best_sentences[:3])
            return f"Here is a clear summary of {primary_source}:\n\n{bullet_points}"

        if self._query_is_explanatory(query):
            lead = best_sentences[0]
            extras = best_sentences[1:3]
            if extras:
                extra_points = "\n".join(f"- {sentence}" for sentence in extras)
                return f"{lead}\n\nKey points:\n{extra_points}"
            return lead

        if len(best_sentences) == 1:
            return best_sentences[0]

        detail_points = "\n".join(f"- {sentence}" for sentence in best_sentences[1:3])
        return f"{best_sentences[0]}\n\nKey points:\n{detail_points}"

    def _ollama_payload(self, prompt: str, stream: bool) -> dict:
        return {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": 0.15,
                "num_ctx": 4096,
                "num_predict": 700,
                "top_p": 0.9,
            },
        }

    def answer(self, query: str, top_k: int = 3) -> dict:
        if self._query_is_broad_overview(query):
            answer, sources = self._overview_answer()
            self.memory.add("user", query)
            self.memory.add("assistant", answer)
            return {"answer": answer, "sources": sources}

        search_query = f"{self.memory.recent_context(turns=2)}\n{query}".strip()
        sources = self.store.search(search_query, top_k=top_k)
        prompt = self._build_prompt(query, sources)

        if not self._context_is_relevant(query, sources):
            answer = self._fallback_answer(query, sources)
        else:
            try:
                response = requests.post(
                    f"{self.ollama_base_url}/api/generate",
                    json=self._ollama_payload(prompt, stream=False),
                    timeout=120,
                )
                response.raise_for_status()
                answer = response.json().get("response", "").strip() or self._fallback_answer(query, sources)
            except Exception:
                answer = self._fallback_answer(query, sources)

        self.memory.add("user", query)
        self.memory.add("assistant", answer)
        return {"answer": answer, "sources": [{"file": s["file"], "snippet": s["snippet"]} for s in sources]}

    def stream_answer(self, query: str, top_k: int = 3) -> Iterator[str]:
        if self._query_is_broad_overview(query):
            answer, sources = self._overview_answer()
            self.memory.add("user", query)
            self.memory.add("assistant", answer)
            for word in answer.split(" "):
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"
            yield f"data: {json.dumps({'sources': sources, 'done': True})}\n\n"
            return

        search_query = f"{self.memory.recent_context(turns=2)}\n{query}".strip()
        sources = self.store.search(search_query, top_k=top_k)
        prompt = self._build_prompt(query, sources)
        full_answer: list[str] = []

        if not self._context_is_relevant(query, sources):
            fallback = self._fallback_answer(query, sources)
            full_answer.append(fallback)
            for word in fallback.split(" "):
                yield f"data: {json.dumps({'token': word + ' '})}\n\n"
        else:
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
