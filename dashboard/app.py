"""Dashboard module — points to the v2 API app."""

from api.app import app  # noqa: F401 — this is the single FastAPI instance

__all__ = ["app"]
