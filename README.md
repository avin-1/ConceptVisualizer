# ManimAI: Autonomous AI Director for Mathematical Animations

![ManimAI Architecture](https://img.shields.io/badge/Architecture-Multi--Agent-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python-green)
![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-blue)
![LLM](https://img.shields.io/badge/LLMs-Llama_3.3_70B%20%7C%20Llama_4_Scout-orange)

ManimAI is a cutting-edge, agentic video generation system that transforms vague natural language prompts into production-ready, 3Blue1Brown-style educational animations. Powered by the open-source **Manim Community** library and a sophisticated multi-agent LLM pipeline, ManimAI autonomously directs, codes, renders, and debugs mathematical visualizations.

## 🎬 Showcase

[**👉 Click here to watch ManimAI in action!**](./manim_animation_a5ea5736.mp4)

<video src="./manim_animation_a5ea5736.mp4" controls="controls" muted="muted" width="100%"></video>

*(Note: If the video player above doesn't render in your local Markdown previewer, please click the link above or open `manim_animation_a5ea5736.mp4` directly in the root directory. GitHub will automatically render the video once pushed!)*

---

## 🧠 System Architecture

ManimAI operates on an advanced **Planner-Critic** paradigm designed to eliminate common visual hallucinations and LLM logic errors.

### 1. The Director Agent (Planner)
Before a single line of code is written, a high-speed inference model (`meta-llama/llama-4-scout-17b-16e-instruct`) evaluates the user prompt to infer the target audience, educational level, and narrative progression. 
- It generates a **strict animation specification** acting as a storyboard.
- It enforces temporal consistency, object persistence, and standardizes coordinate/color spaces.
- It explicitly defines pre-computed Python constants (e.g., precise node arrays and edge weights) to prevent downstream models from inventing non-existent API attributes.

### 2. The Code Generator Agent
A high-capacity coding model (`llama-3.3-70b-versatile`) acts as the implementation layer. It takes the Director's structured specification and translates it directly into flawless Manim Python code, ensuring zero logic-drift and strict adherence to the defined storyboard.

### 3. Autonomous Debugging & Self-Healing Loop (Critic)
If the rendering subprocess encounters an exception (e.g., `AttributeError` from an invalid Mobject method, or `ValueError` due to coordinate shape mismatches), the error trace and offending code are piped back to an expert Debugger Agent. The system automatically patches the code and re-triggers the render pipeline until the animation is successfully generated.

---

## ⚡ High-Performance Engineering

- **Fully Asynchronous Networking**: LLM requests via Groq are handled non-blockingly using `AsyncGroq`, ensuring the FastAPI event loop is never tied up during high-latency generation phases.
- **Background Rendering**: Heavy, CPU-bound Manim rendering tasks are offloaded to background thread executors, maintaining real-time responsiveness.
- **Server-Sent Events (SSE)**: The frontend receives low-latency, real-time chunked streaming updates describing the current operational step (e.g., Directing, Coding, Fixing, Rendering).
- **Engineered Sandboxing**: 
  - Uvicorn hot-reload interference is mitigated by staging all dynamically generated Python scripts to protected OS temp directories (`%TEMP%\manimai_scenes`).
  - Aggressive `PATH` purification logic ensures that global system artifacts (e.g., Chocolatey installs or rogue `flex` binaries) do not contaminate Manim's MiKTeX pipeline.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js & npm (for the React frontend)
- [Manim Community Edition](https://docs.manim.community/) dependencies (FFmpeg, LaTeX/MiKTeX)
- A Groq API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository_url>
   cd Animations
   ```

2. **Setup the Backend**
   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
   *Create a `.env` file in the `backend/` directory with your API key:*
   ```env
   GROQ_API_KEY=your_api_key_here
   ```

3. **Setup the Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the System

Start the backend server (FastAPI):
```bash
cd backend
uvicorn main:app --reload
```

Start the frontend development server:
```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:5173` to start creating animations!

---

*Built for those who believe learning should be visual, intuitive, and beautiful.*
