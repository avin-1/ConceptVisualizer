"""
Manim execution engine for ManimAI.
Writes code to temp files, runs manim subprocess, finds and returns the output .mp4.
"""
import os
import sys
import uuid
import shutil
import tempfile
import subprocess
import asyncio
from pathlib import Path

# Directories relative to this file
BASE_DIR = Path(__file__).parent
VIDEOS_DIR = BASE_DIR / "outputs" / "videos"
MEDIA_DIR = BASE_DIR / "outputs" / "media"

# Scene files go to the OS temp dir so they are NEVER inside the project tree.
# This prevents uvicorn's WatchFiles from detecting them and reloading the server
# mid-render, which would kill the manim subprocess.
SCENES_DIR = Path(tempfile.gettempdir()) / "manimai_scenes"

# Create directories on import
SCENES_DIR.mkdir(parents=True, exist_ok=True)
VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

MANIM_TIMEOUT = 180  # seconds


def _get_manim_cmd() -> list[str]:
    """
    Resolve the manim executable: prefer the venv's own Scripts/manim.exe,
    then fall back to `python -m manim` using the same interpreter as this server.
    """
    venv_manim = BASE_DIR / ".venv" / "Scripts" / "manim.exe"
    if venv_manim.exists():
        return [str(venv_manim)]
    return [sys.executable, "-m", "manim"]


MANIM_CMD = _get_manim_cmd()


def _clean_env() -> dict:
    """
    Return a copy of os.environ with invalid PATH entries removed.
    MiKTeX scans every PATH directory and raises a fatal error if it encounters
    an entry that is a file (not a directory) — e.g. 'C:\\win_flex.exe' left
    behind by a bad Chocolatey install.  We strip those here so manim/latex
    always get a clean PATH regardless of the system state.
    """
    env = os.environ.copy()
    path_entries = env.get("PATH", "").split(os.pathsep)
    clean_entries = [p for p in path_entries if p and Path(p).is_dir()]
    env["PATH"] = os.pathsep.join(clean_entries)
    return env


def run_manim_sync(code: str) -> dict:
    """
    Synchronously run Manim on the given Python code.
    Returns dict: {success, video_id, video_path, error}
    """
    job_id = str(uuid.uuid4())
    scene_file = SCENES_DIR / f"scene_{job_id}.py"
    output_video = VIDEOS_DIR / f"{job_id}.mp4"

    try:
        # Write code to temp file (outside project tree — no uvicorn reload triggered)
        scene_file.write_text(code, encoding="utf-8")

        # Run manim
        # -ql = low quality/fast, --disable_caching = fresh render every time
        # --media_dir = where to put output files
        result = subprocess.run(
            MANIM_CMD + [
                "-ql",
                "--disable_caching",
                "--media_dir", str(MEDIA_DIR),
                str(scene_file),
                "MainScene",
            ],
            capture_output=True,
            text=True,
            timeout=MANIM_TIMEOUT,
            cwd=str(BASE_DIR),
            env=_clean_env(),
        )

        if result.returncode != 0:
            return {
                "success": False,
                "video_id": None,
                "video_path": None,
                "error": f"Manim render failed:\n{result.stderr[-3000:]}",
            }

        # Find the output mp4 — Manim puts it in media/videos/<scene_name>/480p15/
        mp4_file = _find_output_mp4(job_id, scene_file.stem)
        if not mp4_file:
            return {
                "success": False,
                "video_id": None,
                "video_path": None,
                "error": "Render succeeded but could not locate output .mp4 file.",
            }

        # Move to our flat videos directory
        shutil.move(str(mp4_file), str(output_video))

        return {
            "success": True,
            "video_id": job_id,
            "video_path": str(output_video),
            "error": None,
        }

    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "video_id": None,
            "video_path": None,
            "error": f"Manim render timed out after {MANIM_TIMEOUT} seconds.",
        }
    except Exception as e:
        return {
            "success": False,
            "video_id": None,
            "video_path": None,
            "error": str(e),
        }
    finally:
        # Clean up temp scene file
        if scene_file.exists():
            scene_file.unlink()


async def run_manim_async(code: str) -> dict:
    """
    Async wrapper — runs the blocking Manim subprocess in a thread pool
    so the event loop stays free during the render (20-60s).
    """
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, run_manim_sync, code)


def _find_output_mp4(job_id: str, scene_stem: str) -> Path | None:
    """
    Manim outputs to media/videos/<scene_filename_without_ext>/<quality>/MainScene.mp4
    We search for it recursively.
    """
    # Primary search: expected manim output path
    search_root = MEDIA_DIR / "videos"
    if search_root.exists():
        for mp4 in search_root.rglob("MainScene.mp4"):
            return mp4
        # Sometimes named differently
        for mp4 in search_root.rglob("*.mp4"):
            if "partial_movie" not in str(mp4):
                return mp4

    # Fallback: search entire media dir
    for mp4 in MEDIA_DIR.rglob("MainScene.mp4"):
        return mp4

    return None


def get_video_path(video_id: str) -> Path | None:
    """Return the path to a video by its ID, or None if not found."""
    path = VIDEOS_DIR / f"{video_id}.mp4"
    return path if path.exists() else None


def cleanup_old_videos(max_count: int = 20) -> None:
    """Keep only the N most recent videos to avoid filling disk."""
    videos = sorted(VIDEOS_DIR.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old_video in videos[max_count:]:
        old_video.unlink()
