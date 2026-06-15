"""
Groq API client for ManimAI.
Handles both conversational chat and Manim code generation.

All functions are async using AsyncGroq so the FastAPI event loop
is never blocked during network I/O.
"""
import os
import re
from groq import AsyncGroq
from dotenv import load_dotenv
from prompt_templates import (
    CHAT_SYSTEM_PROMPT,
    CODE_GENERATION_SYSTEM_PROMPT,
    DIRECTOR_AGENT_SYSTEM_PROMPT,
    get_code_generation_user_prompt,
    get_director_user_prompt,
    get_code_from_spec_user_prompt,
    CODE_FIX_SYSTEM_PROMPT,
)

load_dotenv()

# Single shared async client (connection-pooled internally by httpx)
client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

# Fast, conversational model for chat
CHAT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Director Agent: fast model — it only produces a structured text spec
DIRECTOR_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Code generation model — non-thinking, strong at code
CODE_MODEL = "llama-3.3-70b-versatile"



async def chat_with_ai(messages: list[dict]) -> dict:
    """
    Send conversation messages to Groq for chat response.
    Returns dict with 'content' and 'ready_to_generate' flag.
    """
    groq_messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        *messages,
    ]

    response = await client.chat.completions.create(
        model=CHAT_MODEL,
        messages=groq_messages,
        temperature=0.7,
        max_tokens=1024,
    )

    content = response.choices[0].message.content or ""

    # Check for ready signal
    ready_to_generate = '"ready_to_generate": true' in content

    # Clean the JSON signal from visible content
    clean_content = re.sub(r'\{[^}]*"ready_to_generate"[^}]*\}', "", content).strip()

    return {
        "content": clean_content,
        "ready_to_generate": ready_to_generate,
    }


async def refine_animation_spec(messages: list[dict], topic: str) -> str:
    """
    Director Agent: transforms a vague user request into a detailed,
    production-ready animation specification.

    Uses the fast model since it only produces structured text (no code).
    The spec is then handed to generate_manim_code_from_spec().
    """
    user_prompt = get_director_user_prompt(messages, topic)

    response = await client.chat.completions.create(
        model=DIRECTOR_MODEL,
        messages=[
            {"role": "system", "content": DIRECTOR_AGENT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        max_tokens=2048,
    )
    return response.choices[0].message.content or ""


async def generate_manim_code_from_spec(spec: str, topic: str) -> str:
    """
    Generate Manim code from a Director Agent animation specification.
    The spec provides exact storyboard, data values, colors, and layout —
    which drastically reduces hallucination compared to an open-ended prompt.
    """
    user_prompt = get_code_from_spec_user_prompt(spec, topic)

    for attempt in range(3):
        response = await client.chat.completions.create(
            model=CODE_MODEL,
            messages=[
                {"role": "system", "content": CODE_GENERATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.15 if attempt == 0 else 0.35,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content or ""
        code = _strip_thinking_blocks(raw)
        code = _strip_code_fences(code)
        code = _extract_python_code(code)

        if "class MainScene" in code and "from manim import" in code and "def construct" in code:
            return code

        user_prompt += (
            f"\n\nAttempt {attempt + 1} failed validation. "
            "Output ONLY Python code starting with 'from manim import *'."
        )

    return code


async def generate_manim_code(messages: list[dict], topic: str) -> str:
    """
    Generate Manim Python code from conversation context.
    Returns raw Python code string. Retries up to 2 times if code looks invalid.
    """
    user_prompt = get_code_generation_user_prompt(messages, topic)

    for attempt in range(3):
        response = await client.chat.completions.create(
            model=CODE_MODEL,
            messages=[
                {"role": "system", "content": CODE_GENERATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2 if attempt == 0 else 0.4,
            max_tokens=4096,
        )

        raw = response.choices[0].message.content or ""

        # Pipeline: tagged think blocks → code fences → bare code heuristic
        code = _strip_thinking_blocks(raw)
        code = _strip_code_fences(code)
        code = _extract_python_code(code)

        # Basic validation
        if "class MainScene" in code and "from manim import" in code and "def construct" in code:
            return code

        # Retry with stronger instruction
        user_prompt += (
            f"\n\nAttempt {attempt + 1} failed validation. "
            "Output ONLY the raw Python code with no prose, no explanation, no markdown. "
            "The code MUST start with 'from manim import *' on line 1."
        )

    return code


async def fix_manim_code(broken_code: str, error: str) -> str:
    """
    Given broken Manim code and its runtime error, ask the LLM to fix it.
    Returns corrected Python code.
    """
    prompt = (
        f"The following Manim code produced this error when rendered:\n\n"
        f"ERROR:\n{error[-2000:]}\n\n"
        f"BROKEN CODE:\n{broken_code}\n\n"
        "Fix the code so it runs without errors. "
        "Output ONLY the corrected Python code, starting with 'from manim import *'."
    )

    for attempt in range(2):
        response = await client.chat.completions.create(
            model=CODE_MODEL,
            messages=[
                {"role": "system", "content": CODE_FIX_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content or ""
        code = _strip_thinking_blocks(raw)
        code = _strip_code_fences(code)
        code = _extract_python_code(code)
        if "class MainScene" in code and "from manim import" in code:
            return code
        prompt += "\nStill invalid. Fix again — output ONLY Python code."

    return code


# ─── Text processing helpers ─────────────────────────────────────────────────

def _strip_thinking_blocks(text: str) -> str:
    """Remove <think>...</think> reasoning blocks emitted by thinking models."""
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    return text.strip()


def _strip_code_fences(text: str) -> str:
    """Extract contents of the first ```python … ``` (or ``` … ```) fence."""
    match = re.search(r'```(?:python)?\s*\n(.*?)```', text, flags=re.DOTALL)
    if match:
        return match.group(1).strip()
    # No fences — strip any stray backtick lines
    text = re.sub(r'^```(?:python)?\s*$', '', text, flags=re.MULTILINE)
    return text.strip()


def _extract_python_code(text: str) -> str:
    """
    Last-resort extractor: find 'from manim import' and return everything from
    that line onward. Strips any prose the model emitted before the code block,
    even without markdown fences or think tags.
    """
    lines = text.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("from manim import") or stripped.startswith("import manim"):
            return "\n".join(lines[i:]).strip()
    return text
