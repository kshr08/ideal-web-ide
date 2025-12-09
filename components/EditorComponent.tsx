'use client';
import React, { useState, useRef, useEffect } from "react";
import { ModeToggleBtn } from "./mode-toggle-btn";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import Editor from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import SelectLanguages, { selectedLanguageOptionProps } from "./SelectLanguages";
import { codeSnippets, languageOptions } from "@/config/config";
import { compileCode } from "@/actions/compile";
import dynamic from "next/dynamic";
import type { TerminalHandle } from "./Terminal";
import FileSystemPanel from "./FileSystemPanel";


const TerminalComponent = dynamic(() => import("./Terminal"), { ssr: false });

export default function EditorComponent() {
  const { theme } = useTheme();
  const [sourceCode, setSourceCode] = useState(codeSnippets["c"]);
  const [languageOption, setLanguageOption] = useState(languageOptions[0]);
  const editorRef = useRef<any>(null);
  const terminalRef = useRef<TerminalHandle | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string>("");
  const autosaveTimerRef = useRef<number | null>(null);
  const [breakpoints, setBreakpoints] = useState<number[]>([]);
const breakpointDecorationsRef = useRef<string[]>([]);


  // buffer for shell input (not strictly required now, but kept if you want later)
  const cmdBufferRef = useRef<string>("");

  // track shell current dir relative to selected root
  const currentDirRef = useRef<string>("");

  // ---------- helper: join relative path ----------
  const joinPath = (file: string) => {
    const cwd = currentDirRef.current || "";
    if (!cwd) return file || "";
    if (!file) return cwd;
    return `${cwd.replace(/\/+$/, "")}/${file.replace(/^\/+/, "")}`;
  };

  // ---------- shell handler ----------
  async function handleShellCommand(cmdRaw: string) {
    const cmdLine = (cmdRaw || "").trim();
    if (!cmdLine) return "";

    if (!window.listDirectory) return "❌ No folder opened.";

    // split words preserving quoted segments
    const parts = cmdLine.match(/("[^"]+"|'[^']+'|\S+)/g) || [];
    const main = (parts[0] || "").toLowerCase();
    const args = parts.slice(1).map(a => a.replace(/^['"]|['"]$/g, ""));

    // navigation (bash 'cd', powershell 'Set-Location')
    if (main === "cd" || main === "set-location") {
      const dir = args[0];
      if (!dir) return `📂 ${currentDirRef.current || "/"}`;
      if (dir === "..") {
        const c = currentDirRef.current;
        currentDirRef.current = c && c.includes("/") ? c.split("/").slice(0, -1).join("/") : "";
        return `📂 Now in: /${currentDirRef.current}`;
      }
      const candidate = joinPath(dir);
      try {
        const list = await window.listDirectory?.(candidate);
        if (!list) return "❌ Not a directory";
        currentDirRef.current = candidate;
        return `📂 Now in: /${currentDirRef.current}`;
      } catch {
        return "❌ Directory does not exist.";
      }
    }

    if (main === "pwd" || main === "get-location") {
      return "/" + (currentDirRef.current || "");
    }

    // clear
    if (["clear", "cls", "clear-host"].includes(main)) {
      terminalRef.current?.clearTerminal();
      return "";
    }

    // list (ls / dir / Get-ChildItem)
    if (["ls", "dir", "get-childitem"].includes(main)) {
      const list = await window.listDirectory?.(currentDirRef.current || "");
      return list?.map((f: any) => (f.type === "dir" ? "📁 " : "📄 ") + f.name).join("\n") || "";
    }

    // mkdir / New-Item -ItemType Directory
    if (["mkdir", "new-item"].includes(main)) {
      const name = args[0];
      if (!name) return "❌ Usage: mkdir <folder>";
      await window.createDirectory?.(joinPath(name));
      return `📁 Folder created: ${name}`;
    }

    // touch / ni
    if (["touch", "ni"].includes(main)) {
      const name = args[0];
      if (!name) return "❌ Usage: touch <file>";
      await window.writeFile?.(joinPath(name), "");
      return `📄 File created: ${name}`;
    }

    // rm / remove-item
    if (["rm", "remove-item"].includes(main)) {
      const name = args[0];
      if (!name) return "❌ Usage: rm <target>";
      const path = joinPath(name);
      await window.deletePath?.(path);
      return `🗑 Deleted: ${name}`;
    }

    // cat / Get-Content
    if (["cat", "get-content"].includes(main)) {
      const name = args[0];
      if (!name) return "❌ Usage: cat <file>";
      try {
        return (await window.readFile?.(joinPath(name))) || "";
      } catch {
        return "❌ File not found.";
      }
    }

    // cp / copy-item
    if (["cp", "copy-item"].includes(main)) {
      const [src, dest] = args;
      if (!src || !dest) return "❌ Usage: cp <src> <dest>";
      const content = await window.readFile?.(joinPath(src));
      await window.writeFile?.(joinPath(dest), content || "");
      return `📄 Copied to: ${dest}`;
    }

    // mv / move-item
    // mv / move-item
// mv / move-item  (Fixed — prevents duplicate file after move)
if (["mv", "move-item"].includes(main)) {
  const [src, dest] = args;
  if (!src || !dest) return "❌ Usage: mv <src> <dest>";

  const srcPath = joinPath(src);
  const destPath = joinPath(dest);

  await window.movePath?.(srcPath, destPath);

  // Compute final file location
  const newPath = `${destPath.replace(/\/+$/,"")}/${srcPath.split("/").pop()}`;

  // If file currently open → update path + stop autosave from rewriting old file
  if (currentFilePath === srcPath) {
    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setCurrentFilePath(newPath);
  }

  return `🚚 Moved to: ${newPath}`;
}



    // echo => support echo "text" > file  (basic)
    if (main === "echo") {
      const opIndex = args.findIndex(a => a === ">" || a === ">>");
      if (opIndex === -1) {
        return args.join(" ");
      }
      const contentParts = args.slice(0, opIndex);
      const operator = args[opIndex];
      const file = args[opIndex + 1];
      if (!file) return "❌ Usage: echo <text> > file";
      const content = contentParts.join(" ");
      const path = joinPath(file);
      if (operator === ">") {
        await window.writeFile?.(path, content + "\n");
      } else {
        const old = await window.readFile?.(path);
        await window.writeFile?.(path, (old || "") + content + "\n");
      }
      return `✍️ Wrote to ${file}`;
    }

    return `❌ Unknown command: ${cmdLine}`;
  }

  // =============================================================
  // TERMINAL BINDING – uses setOnCommand (one handler, full line)
  // =============================================================
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    term.setOnCommand(async (cmd: string) => {
      cmd = (cmd || "").trim();
      if (!cmd) {
        term.writeToTerminal("$ ");
        return;
      }

      const out = await handleShellCommand(cmd);

      // auto open file if you ever use "open <file>" style in future
      if (String(out).startsWith("📝 Opening")) {
        const file = cmd.split(/\s+/)[1];

        if (currentFilePath && window.writeFile) {
          await window.writeFile(currentFilePath, sourceCode).catch(() => {});
        }

        setCurrentFilePath(file);

        const content = await window.readFile?.(file);
        if (content != null) {
          setSourceCode(content);
          const ext = file.split(".").pop()?.toLowerCase();
          if (ext === "js")  setLanguageOption(languageOptions.find(l => l.language === "JavaScript")!);
          if (ext === "py")  setLanguageOption(languageOptions.find(l => l.language === "Python")!);
          if (ext === "c")   setLanguageOption(languageOptions.find(l => l.language === "C")!);
        }
      }

      term.writeToTerminal(String(out) + "\r\n$ ");
    });
  }, [currentFilePath, sourceCode, languageOption, sourceCode]);

  // ---------- onOpenFile for FileSystemPanel ----------
  useEffect(() => {
    const handler = async (e: any) => {
      const { path, content } = e.detail;

      if (currentFilePath && window.writeFile) {
        try {
          await window.writeFile(currentFilePath, sourceCode);
          console.log("💾 Auto-saved previous file:", currentFilePath);
        } catch (err) {
          console.warn("Auto-save failed:", err);
        }
      }

      setCurrentFilePath(path);

      const ext = path.split(".").pop()?.toLowerCase();
      if (ext === "py") setLanguageOption(languageOptions.find(l => l.language.toLowerCase() === "python") ?? languageOptions[0]);
      else if (ext === "js") setLanguageOption(languageOptions.find(l => l.language.toLowerCase() === "javascript") ?? languageOptions[0]);
      else if (ext === "c") setLanguageOption(languageOptions.find(l => l.language.toLowerCase() === "c") ?? languageOptions[0]);

      if (content !== undefined) {
        setSourceCode(content);
      } else {
        const text = await window.readFile?.(path);
        if (text !== undefined) setSourceCode(text);
      }

      setTimeout(() => editorRef.current?.focus?.(), 50);

      if ((window as any).__autosaveTimer) {
        clearTimeout((window as any).__autosaveTimer);
      }
      (window as any).__autosaveTimer = setTimeout(async () => {
        try {
          if (window.writeFile) {
            await window.writeFile(path, sourceCode);
            console.log("💾 Auto-saved:", path);
          }
        } catch (err) {
          console.warn("Autosave failed:", err);
        }
      }, 1200);
    };

    window.addEventListener("fs-open-file", handler);
    return () => window.removeEventListener("fs-open-file", handler);
  }, [currentFilePath, sourceCode]);

  // ---------- editor mount & handlers ----------
  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    editor.focus();

    editor.updateOptions({ contextmenu: false });

    editor.onKeyDown((e: any) => {
      const key = e.code?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (
        (ctrl && key === "keyc") ||
        (ctrl && key === "keyv") ||
        (ctrl && key === "keyx") ||
        (ctrl && key === "keya") ||
        (ctrl && shift && key === "keyc") ||
        (ctrl && shift && key === "keyv")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    editor.onDidPaste(() => {
      setTimeout(() => {
        const val = editor.getValue();
        editor.setValue(val);
      }, 0);
    });

    try {
      // @ts-ignore
      if (editor.onDropIntoEditor) {
        // @ts-ignore
        editor.onDropIntoEditor((e: any) => {
          try { e.event.preventDefault(); e.event.stopPropagation(); } catch {}
        });
      }
    } catch {}

    editor.updateOptions({
      selectionClipboard: false,
      dragAndDrop: false,
    });

    window.addEventListener("copy", (e) => {
      try {
        if ((document.activeElement as any)?.monacoEditor === editorRef.current || document.activeElement === editorRef.current._domElement) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch {}
    });

    window.addEventListener("paste", (e) => {
      try {
        if ((document.activeElement as any)?.monacoEditor === editorRef.current || document.activeElement === editorRef.current._domElement) {
          e.preventDefault();
          e.stopPropagation();
        }
      } catch {}
    });

    // CTRL+ENTER → AI code generation from "// ai: ..." or "# ai: ..."
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, async () => {
      const pos = editor.getPosition();
      if (!pos) return;

      const model = editor.getModel();
      if (!model) return;

      const line = model.getLineContent(pos.lineNumber).trim();
      const lang = languageOption.language.toLowerCase();

      const text = line.trim().toLowerCase();

      let prefix1 = "// ai:";
      let prefix2 = "//ai:";

      if (lang === "python") {
        prefix1 = "# ai:";
        prefix2 = "#ai:";
      }

      if (!(text.startsWith(prefix1) || text.startsWith(prefix2))) {
        console.log("IGNORED — line is not AI command");
        return;
      }

      const prompt = text.replace(prefix1, "").replace(prefix2, "").trim();
      if (!prompt) {
        console.log("No AI prompt text found");
        return;
      }

      const insertAt = pos.lineNumber + 1;

      model.pushEditOperations([], [{
        range: new monaco.Range(insertAt, 1, insertAt, 1),
        text: `${lang === "python" ? "#" : "//"}  Generating...\n`
      }], null);

      try {
        const res = await fetch("https://ruthann-unrevelling-hans.ngrok-free.dev/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            ext: languageOption.language.toLowerCase()
          })
        });

        const generated = await res.text();

        model.pushEditOperations([], [{
          range: new monaco.Range(insertAt, 1, insertAt, 999),
          text: `${generated.trim()}\n`
        }], null);
      } catch {
        model.pushEditOperations([], [{
          range: new monaco.Range(insertAt, 1, insertAt, 999),
          text: `${lang === "python" ? "#" : "//"} ❌ AI request failed\n`
        }], null);
      }
    });

        // --------------------------------------------
    // Breakpoints: click on gutter to toggle
    // --------------------------------------------
    editor.updateOptions({ glyphMargin: true });

    editor.onMouseDown((e: any) => {
      if (
        e.target?.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        e.target?.position?.lineNumber
      ) {
        const line = e.target.position.lineNumber;

        setBreakpoints(prev => {
          const has = prev.includes(line);
          const next = has ? prev.filter(l => l !== line) : [...prev, line];

          // Update Monaco decorations
          const decorations = next.map(l => ({
            range: new monaco.Range(l, 1, l, 1),
            options: {
              glyphMarginClassName: "ideal-breakpoint-glyph",
            },
          }));

          breakpointDecorationsRef.current = editor.deltaDecorations(
            breakpointDecorationsRef.current,
            decorations
          );

          return next;
        });
      }
    });

  }

  function handleOnChange(value?: string) {
    if (value !== undefined) {
      setSourceCode(value);

      if (currentFilePath) {
        if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = window.setTimeout(async () => {
          try {
            await window.writeFile?.(currentFilePath, value);
          } catch {}
        }, 800) as unknown as number;
      }
    }
  }

  function onSelect(value: selectedLanguageOptionProps) {
    setLanguageOption(value);
    setSourceCode(codeSnippets[value.language] ?? sourceCode);
  }

  // ---------- run code with terminal-based input ----------
  // ---------- run code with terminal-based input ----------
  async function handleRun() {
    const term = terminalRef.current;
    if (!term) return;

    const termHandle = term as TerminalHandle;

    termHandle.clearTerminal();
    termHandle.writeToTerminal("▶ Running code...\r\n");

    const lang = languageOption.language.toLowerCase();
    const code = sourceCode;
    let transformedCode = code;
    console.log("IDEAL breakpoints:", breakpoints);

    // ------------------------------------------------------------------
    // 1. Detect input calls in the source code
    // ------------------------------------------------------------------
    const inputCalls: { type: string; prompt?: string }[] = [];
    const cPrompts: string[] = []; // keep prompts we infer for C to optionally clean later
if (lang === "python") {
  const re = /input\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    let prompt = m[1]?.replace(/["']/g, "").trim();
    if (!prompt) prompt = `Input (${inputCalls.length + 1})`; // fallback name
    inputCalls.push({ type: "python", prompt });
  }
}

else if (lang === "javascript") {
  const re = /prompt\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    let prompt = m[1]?.replace(/["']/g, "").trim();
    if (!prompt) prompt = `Input (${inputCalls.length + 1})`; // fallback
    inputCalls.push({ type: "js", prompt });
  }
  
} else if (lang === "c" || lang === "cpp") {
      // Very simple static analysis:
      // For each line with scanf("fmt", ...), look at the previous line;
      // if it has printf("..."), use that text as a prompt.
      const lines = code.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const scanfMatch = line.match(/scanf\s*\(\s*"([^"]*)"/);
        if (!scanfMatch) continue;

        // Count how many values scanf expects (%d %f %s %c etc.)
        const formats = scanfMatch[1].match(/%[dfsc]/g) || ["%d"];

        let prompt: string | undefined;
        const prev = i > 0 ? lines[i - 1] : "";
        const printfMatch = prev.match(/printf\s*\(\s*"([^"]*)"/);
        if (printfMatch) {
          prompt = printfMatch[1];
          cPrompts.push(prompt);
        }

        formats.forEach(() => {
          inputCalls.push({ type: "scanf", prompt });
        });
      }
    }

    // ------------------------------------------------------------------
// 1.5 For JavaScript with prompt(), inject a Node-side prompt shim
// ------------------------------------------------------------------
if (lang === "javascript" && inputCalls.some(c => c.type === "js")) {
  const promptShim = `
const fs = require('fs');

// Read entire stdin once and split into lines
const __idealInputData = fs.readFileSync(0, 'utf8').split(/\\r?\\n/);
let __idealInputIndex = 0;

// Browser-like prompt() for Node
function prompt(msg) {
  // We already show prompts in IDEAL terminal UI,
  // so we do NOT print anything here to avoid duplicates.
  const value = __idealInputData[__idealInputIndex++] ?? "";
  return value.trim();
}
`;

  transformedCode = promptShim + "\n" + code;
}


    // ------------------------------------------------------------------
    // 2. Single execution helper (Piston call)
    // ------------------------------------------------------------------
    async function runOnce(stdin: string) {
      termHandle.writeToTerminal("\r\n⌛ Running program...\r\n\n");

      const requestData = {
        language: lang,
        version: languageOption.version,
        files: [{ name: `main.${lang}`, content: transformedCode }],
        stdin,
      };

      try {
        const result = await compileCode(requestData);
        const run = result?.run || {};

        let out =
          (run.output ?? run.stdout ?? "") +
          (run.stderr ? `\n${run.stderr}` : "");

        // Clean up duplicate prompts a bit for Python/JS
        if (lang === "python" || lang === "javascript") {
          out = out
            .replace(/\r/g, "")
            .replace(/\s\s+/g, " ")
            .trim();
        }

        // For C, optionally remove the printf prompts we already showed
        if (lang === "c" || lang === "cpp") {
          for (const p of cPrompts) {
            if (!p) continue;
            const esc = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            out = out.replace(new RegExp(esc, "g"), "");
          }
          out = out.replace(/\r/g, "").trim();
        }

        termHandle.writeToTerminal(out + "\r\n$ ");
      } catch (e) {
        console.error(e);
        termHandle.writeToTerminal("\r\n🚨 Execution failed.\r\n$ ");
      }
    }

    // ------------------------------------------------------------------
    // 3. No inputs detected → just run once
    // ------------------------------------------------------------------
    if (inputCalls.length === 0) {
      await runOnce("");
      return;
    }

    // ------------------------------------------------------------------
    // 4. Collect all inputs interactively, then call runOnce(stdin)
    // ------------------------------------------------------------------
    const answers: string[] = [];
    let idx = 0;

    const askNext = () => {
      if (idx >= inputCalls.length) {
        termHandle.disableProgramInput();
        void runOnce(answers.join("\n"));
        return;
      }

      const call = inputCalls[idx];
      let promptText = call.prompt;

      if (!promptText) {
        if (lang === "c" || lang === "cpp") {
          promptText = `Input ${idx + 1} (scanf):`;
        } else {
          promptText = `Input ${idx + 1}:`;
        }
      }

      termHandle.writeToTerminal(
        (idx === 0 ? "" : "\r\n") + promptText + " "
      );

      termHandle.enableProgramInput((userInput: string) => {
        answers.push(userInput);
        idx += 1;
        askNext();
      });
    };

    askNext();
  }




  // ---------- render ----------
  return (
    <div className="min-h-screen dark:bg-slate-900 rounded-2xl shadow-2xl py-6 px-8">
      <div className="flex items-center justify-between pb-3">
        <h2 className="scroll-m-20 pb-2 text-3xl font-semibold tracking-tight">IDEAL</h2>
        <div className="flex items-center space-x-2">
          <ModeToggleBtn />
          <div className="w-[230px]">
            <SelectLanguages onSelect={onSelect} selectedLanguageOption={languageOption} />
          </div>
        </div>
      </div>

      <div className="bg-slate-400 dark:bg-slate-950 p-3 h-[90vh]">
        <ResizablePanelGroup
          direction="horizontal"
          className="w-full h-full border rounded-lg overflow-hidden"
        >
          <ResizablePanel defaultSize={22} minSize={15} maxSize={40}>
            <div className="h-full w-full overflow-hidden">
              <FileSystemPanel />
            </div>
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel defaultSize={78}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70} minSize={30}>
                <Editor
                  theme={theme === "dark" ? "vs-dark" : "vs-light"}
                  height="100%"
                  defaultLanguage={languageOption.language}
                  defaultValue={sourceCode}
                  onMount={handleEditorDidMount}
                  value={sourceCode}
                  onChange={handleOnChange}
                  options={{
                    glyphMargin: true,
                    fontSize: 14,
                  }}
                />
              </ResizablePanel>

              <ResizableHandle />

              <ResizablePanel defaultSize={30}>
                <div className="h-full w-full bg-slate-300 dark:bg-slate-900">
                  <div className="flex items-center justify-between bg-slate-300 dark:bg-slate-950 px-6 py-2">
                    <h2>Terminal</h2>
                    <Button
                      size="sm"
                      onClick={handleRun}
                      className="hover:bg-green-200 hover:text-black"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      <span>Run</span>
                    </Button>
                  </div>

                  <div className="h-[calc(100%-40px)] w-full p-2 bg-black text-white rounded-md bg-slate-300 dark:bg-slate-900">
                    <TerminalComponent ref={terminalRef} output={""} />
                  </div>
                </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
