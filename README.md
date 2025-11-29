# 🚀 IDEAL — Intelligent Development Environment with AI Lead  
**AI-Integrated Web IDE · Multi-Language Execution · Native FS + Cloud Execution · DB-Synced Projects**

IDEAL (**Intelligent Development Environment with AI Lead**) is a modern browser-based IDE designed to be lightweight, intelligent and fully extensible.  
It integrates **Code-Llama-2 LLM** for AI-assisted coding and supports execution of C, C++, Python, JavaScript and more through the **Piston API** runtime.  
The IDE includes a filesystem with **real local disk integration (FSAA)** + **IndexedDB fallback**, allowing users to code even without folder permissions.

🔗 Live Deployment → **https://ideal-web-ide.vercel.app/**

---

## ✨ Core Features

| Feature | Status | Powered By |
|---|---|---|
| AI-assisted code generation via comments | ✅ | CodeLlama-2 |
| Multi-language run support | ✅ | Piston API |
| Browser terminal execution | ✅ | Xterm.js |
| Local Filesystem access | ✅ | File System Access API |
| Offline mode (IndexedDB sync) | 🟡 experimental | Custom DB layer |
| Undo/Redo FS operations | 🔥 | Inbuilt FS layer |
| Breakpoint markers in editor | 🟢 | Monaco Editor |

---

## 🏗 Tech Stack

| Layer | Tools Used |
|---|---|
| Frontend UI | Next.js 16 + React 19 + TypeScript |
| Editor | Monaco Editor |
| Terminal | Xterm.js |
| Execution Backend | Piston API |
| AI Code Generation | CodeLlama-2 |
| Storage | IndexedDB + FS Access API |
| Styling | TailwindCSS |

---

## 📂 Repository Structure

```bash
.
├── app/                  # Next.js App Router
├── components/           # UI + Editor + FS + Terminal
├── actions/compile.ts    # Piston API execution handler
├── config/config.ts      # Language execution config (EXTEND HERE)
├── public/fs/            # FS + IndexedDB DB layer (db.js / fs_bridge.js)
├── types/global.d.ts     # Extended window bindings
├── README.md             # ← You are reading this
└── ...

🛠 Developer Manual
1️⃣ Clone & install dependencies
git clone <your_repo_url>
cd my-app
npm install

2️⃣ Run development mode
npm run dev


Open ↗ http://localhost:3000

3️⃣ How The Filesystem Works
Mode	Behavior
Folder not selected	Uses IndexedDB (auto-save project)
Folder selected	Real Native FS read/write
On permission grant	DB → FS sync allowed

Core logic → public/fs/fs_bridge.js
IndexedDB store → public/fs/db.js

4️⃣ Adding New Programming Languages

📍 Edit → config/config.ts

Example:

export const LANGUAGES = {
  cpp: { runtime: "gcc", compile: "g++", ext: "cpp" },
  java: { runtime: "java", compile: "javac", ext: "java" },

  rust: {
    compile: "rustc",
    run: "./main",
    ext: "rs"
  }


After adding → Language automatically appears in SelectLanguages.tsx.

📡 Terminal + Execution
File	What it handles
components/Terminal.tsx	Xterm.js shell output
actions/compile.ts	Sends code to Piston API
EditorComponent.tsx	Run triggers + logs

Multiple run-inputs supported.

📦 Deployment
Deploy on Vercel
npm run build
vercel deploy

Deploy on Netlify (SSR mode)

netlify.toml

[build]
base = "my-app"
command = "npm run build"
publish = ".netlify/build"

[[plugins]]
package = "@netlify/plugin-nextjs"

🔥 Future Upgrades
Feature	Priority
Cloud sync (Supabase/GitHub)	HIGH
Debugger + Step Execution	HIGH
Live interview mode	MEDIUM
Plugin marketplace	LOW