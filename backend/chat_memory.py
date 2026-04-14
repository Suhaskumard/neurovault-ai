from collections import deque
from threading import Lock


class ChatMemory:
    def __init__(self, max_messages: int = 20):
        self._messages = deque(maxlen=max_messages)
        self._lock = Lock()

    def add(self, role: str, content: str) -> None:
        with self._lock:
            self._messages.append({"role": role, "content": content})

    def recent_context(self, turns: int = 2) -> str:
        with self._lock:
            recent = list(self._messages)[-(turns * 2):]
        return "\n".join(f"{msg['role']}: {msg['content']}" for msg in recent)

    def clear(self) -> None:
        with self._lock:
            self._messages.clear()
