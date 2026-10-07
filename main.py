"""
Root ASGI entrypoint delegating to backend.main
Allows running `uvicorn main:app` directly from the Major-Project repository root.
"""
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parent / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from backend.main import app

__all__ = ["app"]
