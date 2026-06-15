"""
ManimAI FastAPI Backend
Provides chat, animation generation, and video serving endpoints.
"""
import json
import asyncio
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from groq_client import (
    chat_with_ai,
    generate_manim_code,
    generate_manim_code_from_spec,
    refine_animation_spec,
    fix_manim_code,
)
from manim_runner import run_manim_async, get_video_path, cleanup_old_videos

app = FastAPI(title="ManimAI", version="1.0.0")

# Allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Pydantic Models ────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]

class GenerateRequest(BaseModel):
    messages: list[Message]
    topic: str


# ─── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ManimAI"}


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Multi-turn chat with the AI tutor.
    Returns the AI's response and whether it's ready to generate.
    """
    try:
        messages = [{"role": m.role, "content": m.content} for m in req.messages]
        result = await chat_with_ai(messages)   # now truly async — no event loop block
        return {
            "content": result["content"],
            "ready_to_generate": result["ready_to_generate"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def generate_endpoint(req: GenerateRequest):
    """
    Full animation generation pipeline:
    1. Generate Manim code via Groq
    2. Run Manim subprocess
    3. Return video ID on success
    
    Uses SSE-style chunked streaming for progress updates.
    """
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    topic = req.topic

    async def progress_stream():
        try:
            # ── Step 1: Director Agent ──────────────────────────────────────
            yield _sse("status", {"step": "directing", "message": "🎬 Animation Director planning the scene..."})
            spec = await refine_animation_spec(messages, topic)

            # ── Step 2: Generate code from spec ────────────────────────────
            yield _sse("status", {"step": "generating_code", "message": "✍️ Writing Manim code from spec..."})
            code = await generate_manim_code_from_spec(spec, topic)
            yield _sse("status", {"step": "code_ready", "message": "✅ Code ready! Starting render..."})

            # ── Step 3: Render (with one auto-fix retry) ───────────────────
            for attempt in range(2):
                is_retry = attempt > 0
                msg = "🔧 Fixing render error, re-rendering..." if is_retry else "🎨 Rendering animation (20-60s)..."
                yield _sse("status", {"step": "rendering", "message": msg})

                result = await run_manim_async(code)

                if result["success"]:
                    break

                if attempt == 0:
                    yield _sse("status", {"step": "fixing", "message": "⚙️ Render error — asking AI to fix..."})
                    code = await fix_manim_code(code, result["error"])
                else:
                    yield _sse("error", {"message": result["error"]})
                    return

            # Cleanup in background — don't delay the done response
            asyncio.get_running_loop().run_in_executor(None, cleanup_old_videos, 20)

            yield _sse("done", {
                "video_id": result["video_id"],
                "message": "Animation ready!",
            })

        except Exception as e:
            yield _sse("error", {"message": str(e)})

    return StreamingResponse(
        progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/video/{video_id}")
async def serve_video(video_id: str):
    """Stream the generated .mp4 video file."""
    # Sanitize video_id to prevent path traversal
    if not video_id.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=400, detail="Invalid video ID")

    video_path = get_video_path(video_id)
    if not video_path:
        raise HTTPException(status_code=404, detail="Video not found")

    return FileResponse(
        path=str(video_path),
        media_type="video/mp4",
        filename=f"manim_animation_{video_id[:8]}.mp4",
        headers={"Accept-Ranges": "bytes"},
    )


# ─── Helpers ────────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
