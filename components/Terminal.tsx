'use client';

import React, { useImperativeHandle, useRef, useEffect, forwardRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export interface TerminalHandle {
  writeToTerminal(text: string): void;
  clearTerminal(): void;
  setOnCommand(handler: (cmd: string) => void): void;

  // 🔥 NEW — required for interactive program execution
  enableProgramInput(handler: (stdin: string) => void): void;
  disableProgramInput(): void;
}

interface TerminalProps {
  output?: string;
}

const TerminalComponent = forwardRef<TerminalHandle, TerminalProps>(({ output }, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // 🔥 interactive stdin flags
  const programInputMode = useRef(false);
  const onProgramInput = useRef<((stdin: string) => void) | null>(null);

  // 🔥 command input preserved
  const commandBufferRef = useRef<string>("");
  const commandHandlerRef = useRef<((cmd: string) => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#0f172a",
        foreground: "#f8fafc",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    const safeFit = () => {
      try {
        const dims = (fitAddon as any).proposeDimensions?.();
        if (dims && dims.cols > 0 && dims.rows > 0) fitAddon.fit();
      } catch {}
    };

    term.write("$ "); // initial prompt
    setTimeout(safeFit, 120);

    // =========================
    // 🔥 UNIVERSAL INPUT HANDLER
    // =========================
    term.onData((data: string) => {
      const key = data.charCodeAt(0);

      // ======================================
      // 🔥 If code is running → input = stdin
      // ======================================
      if (programInputMode.current) {
        if (key === 13) { // ENTER
          const value = commandBufferRef.current.trim();
          commandBufferRef.current = "";
          term.write("\r\n");
          onProgramInput.current?.(value);   // <-- send input to piston
          return;
        }
        commandBufferRef.current += data;
        term.write(data);
        return;
      }

      // ===========================
      // Normal Terminal Command Mode
      // ===========================
      if (key === 13) { // ENTER
        const cmd = commandBufferRef.current.trim();
        commandBufferRef.current = "";
        term.write("\r\n");
        commandHandlerRef.current?.(cmd);
        term.write("$ ");
        return;
      }

      if (key === 127) { // BACKSPACE
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          term.write("\b \b");
        }
        return;
      }

      // normal character
      commandBufferRef.current += data;
      term.write(data);
    });

    const ro = new ResizeObserver(() => safeFit());
    ro.observe(containerRef.current);
    resizeObserverRef.current = ro;

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      resizeObserverRef.current?.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // =======================
  // METHODS EXPOSED OUTWARD
  // =======================
  useImperativeHandle(ref, () => ({
    writeToTerminal: (text: string) => {
      termRef.current?.write(text);
    },

    clearTerminal: () => {
      termRef.current?.clear();
      commandBufferRef.current = "";
      termRef.current?.write("$ ");
    },

    setOnCommand: (handler: (cmd: string) => void) => {
      commandHandlerRef.current = handler;
    },

    // ===================================================
    // 🔥 Required for interactive programs (C, Python etc)
    // ===================================================
    enableProgramInput: (handler) => {
      programInputMode.current = true;
      onProgramInput.current = handler;
    },

    disableProgramInput: () => {
      programInputMode.current = false;
      onProgramInput.current = null;
    },
  }), []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black rounded-md overflow-hidden text-white bg-white dark:bg-slate-900"
    />
  );
});

export default TerminalComponent;
