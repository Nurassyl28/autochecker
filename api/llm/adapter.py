"""
Abstract LLM adapter. Select provider via LLM_PROVIDER env var:
  openai    → OpenAI API (or any OpenAI-compatible endpoint, e.g. Qwen)
  anthropic → Anthropic Claude API
  google    → Google Generative AI (Gemini)

Set LLM_BASE_URL to override the API endpoint (useful for Qwen/local models).
Set LLM_MODELS to a comma-separated list for automatic fallback when a model
is rate-limited or unavailable (e.g. openrouter free-tier models).
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai")
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4o")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "")

# Comma-separated list of models to try in order (first one is primary).
# If LLM_MODELS is not set, falls back to LLM_MODEL.
_raw_models = os.environ.get("LLM_MODELS", "")
LLM_MODELS: list[str] = (
    [m.strip() for m in _raw_models.split(",") if m.strip()]
    if _raw_models
    else [LLM_MODEL]
)


class LLMAdapter(ABC):
    @abstractmethod
    async def complete(self, system: str, user: str) -> str:
        """Return the model's text response."""


class OpenAICompatibleAdapter(LLMAdapter):
    """Works with OpenAI and any OpenAI-compatible endpoint (Qwen, Together, etc.).
    Tries each model in LLM_MODELS in order; skips on 404/429/503.
    """

    def __init__(self):
        import httpx
        self._client = httpx.AsyncClient(timeout=120)
        self._base = (LLM_BASE_URL or "https://api.openai.com/v1").rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
            # Required by OpenRouter (returns 404 without it)
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "Autochecker",
        }

    async def complete(self, system: str, user: str) -> str:
        last_error: Exception | None = None

        for model in LLM_MODELS:
            try:
                resp = await self._client.post(
                    f"{self._base}/chat/completions",
                    headers=self._headers,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": user},
                        ],
                        "temperature": 0,
                    },
                )

                if resp.status_code in (404, 429, 503):
                    logger.warning(
                        "Model %s returned %s, trying next fallback",
                        model, resp.status_code,
                    )
                    last_error = Exception(
                        f"Model {model} returned HTTP {resp.status_code}"
                    )
                    continue

                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                if content is None:
                    # Reasoning-only models return content=null
                    logger.warning("Model %s returned null content, trying next", model)
                    last_error = Exception(f"Model {model} returned null content")
                    continue

                logger.info("LLM response from model: %s", model)
                return content

            except Exception as exc:
                if "404" in str(exc) or "429" in str(exc) or "503" in str(exc):
                    logger.warning("Model %s failed (%s), trying next", model, exc)
                    last_error = exc
                    continue
                raise

        raise last_error or RuntimeError("All LLM models failed")


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
