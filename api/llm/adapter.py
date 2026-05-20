"""
Abstract LLM adapter. Select provider via LLM_PROVIDER env var:
  openai    → OpenAI API (or any OpenAI-compatible endpoint, e.g. Qwen)
  anthropic → Anthropic Claude API
  google    → Google Generative AI (Gemini)

Set LLM_BASE_URL to override the API endpoint (useful for Qwen/local models).
"""

import json
import os
from abc import ABC, abstractmethod
from typing import Any

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")


class LLMAdapter(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str:
        """Return the model's text response."""


class OpenAICompatibleAdapter(LLMAdapter):
    """Works with OpenAI and any OpenAI-compatible endpoint (Qwen, Together, etc.)."""

    def __init__(self):
        import httpx
        self._client = httpx.AsyncClient(timeout=120)
        self._base = (LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        self._model = LLM_MODEL
        self._headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
        }

    async def complete(self, system: str, user: str) -> str:
        resp = await self._client.post(
            f"{self._base}/chat/completions",
            headers=self._headers,
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": 0.2,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


class AnthropicAdapter(LLMAdapter):
    def __init__(self):
        import anthropic
        self._client = anthropic.AsyncAnthropic(api_key=LLM_API_KEY)
        self._model = LLM_MODEL or "claude-sonnet-4-6"

    async def complete(self, system: str, user: str) -> str:
        msg = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text


class GoogleAdapter(LLMAdapter):
    def __init__(self):
        import google.generativeai as genai
        genai.configure(api_key=LLM_API_KEY)
        self._model = genai.GenerativeModel(LLM_MODEL or "gemini-1.5-flash")

    async def complete(self, system: str, user: str) -> str:
        import asyncio
        prompt = f"{system}\n\n{user}"
        resp = await asyncio.to_thread(self._model.generate_content, prompt)
        return resp.text


_adapter: LLMAdapter | None = None


def get_adapter() -> LLMAdapter:
    global _adapter
    if _adapter is None:
        if LLM_PROVIDER == "anthropic":
            _adapter = AnthropicAdapter()
        elif LLM_PROVIDER == "google":
            _adapter = GoogleAdapter()
        else:
            _adapter = OpenAICompatibleAdapter()
    return _adapter


async def llm_complete(system: str, user: str) -> str:
    return await get_adapter().complete(system, user)


def extract_json(text: str) -> Any:
    """Extract the first JSON object or array from LLM output."""
    text = text.strip()
    start = text.find("{") if "{" in text else text.find("[")
    if start == -1:
        raise ValueError("No JSON found in LLM output")
    # find matching bracket
    bracket = text[start]
    close = "}" if bracket == "{" else "]"
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == bracket:
            depth += 1
        elif ch == close:
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("Unbalanced JSON in LLM output")
