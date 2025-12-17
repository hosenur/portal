import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "@/layouts/app-layout";
import "@xterm/xterm/css/xterm.css";

type TerminalStatus = "connecting" | "connected" | "disconnected" | "error";

export default function TerminalPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [logs, setLogs] = useState<string[]>(["Page loaded"]);
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
    const logMessage = `[${timestamp}] ${message}`;
    console.log("[Terminal]", message);
    setLogs((prev) => [...prev.slice(-50), logMessage]);
  }, []);

  // Set ready when component mounts
  useEffect(() => {
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    addLog("useEffect triggered, isReady: true");

    if (typeof window === "undefined") {
      addLog("SSR detected, skipping");
      return;
    }

    if (!terminalRef.current) {
      addLog("terminalRef still not ready, waiting...");
      return;
    }

    if (initialized.current) {
      addLog("Already initialized");
      return;
    }

    initialized.current = true;
    addLog("Starting initialization...");

    let mounted = true;
    let socket: ReturnType<typeof import("socket.io-client").io> | null = null;
    let terminal: import("@xterm/xterm").Terminal | null = null;

    const initTerminal = async () => {
      try {
        addLog("Importing xterm...");
        const { Terminal } = await import("@xterm/xterm");

        addLog("Importing fit addon...");
        const { FitAddon } = await import("@xterm/addon-fit");

        addLog("Importing socket.io-client...");
        const { io } = await import("socket.io-client");

        if (!mounted || !terminalRef.current) {
          addLog("Component unmounted");
          return;
        }

        addLog("Creating terminal...");
        terminal = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          theme: {
            background: "#0a0a0a",
            foreground: "#d4d4d4",
            cursor: "#d4d4d4",
          },
        });

        const fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.open(terminalRef.current);
        fitAddon.fit();
        addLog("Terminal opened");

        terminal.writeln("Connecting to container terminal...");

        // Initialize Socket.IO endpoint
        addLog("Fetching /api/terminal/ws...");
        const initRes = await fetch("/api/terminal/ws");
        addLog(`Fetch response: ${initRes.status}`);

        // Connect to Socket.IO
        addLog("Creating socket connection...");
        socket = io(window.location.origin, {
          path: "/api/terminal/ws",
          transports: ["polling", "websocket"],
          timeout: 10000,
          forceNew: true,
        });

        addLog("Socket created, setting up listeners...");

        socket.on("connect", () => {
          addLog(`Connected! ID: ${socket?.id}`);
          terminal?.writeln(`Socket connected (${socket?.id})`);
        });

        socket.on("connected", (data: { containerId: string }) => {
          addLog(`Container connected: ${data.containerId}`);
          setStatus("connected");
          terminal?.writeln(`Container: ${data.containerId}`);
          terminal?.writeln("");
          terminal?.focus();
        });

        socket.on("output", (data: string) => {
          terminal?.write(data);
        });

        socket.on("log", (msg: string) => addLog(`Server: ${msg}`));

        socket.on("error", (data: { message: string }) => {
          addLog(`Error: ${data.message}`);
          setStatus("error");
          setErrorMessage(data.message);
          terminal?.writeln(`\r\n\x1b[31mError: ${data.message}\x1b[0m`);
        });

        socket.on("disconnected", () => {
          addLog("Docker disconnected");
          setStatus("disconnected");
        });

        socket.on("disconnect", (reason) => {
          addLog(`Socket disconnected: ${reason}`);
          setStatus("disconnected");
        });

        socket.on("connect_error", (err) => {
          addLog(`Connect error: ${err.message}`);
          setStatus("error");
          setErrorMessage(err.message);
        });

        terminal.onData((data) => {
          if (socket?.connected) {
            socket.emit("input", data);
          }
        });

        // Check state after delay
        setTimeout(() => {
          addLog(
            `Socket connected: ${socket?.connected}, id: ${socket?.id || "none"}`,
          );
        }, 3000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`Error: ${msg}`);
        console.error(err);
        setStatus("error");
        setErrorMessage(msg);
      }
    };

    initTerminal();

    return () => {
      mounted = false;
      socket?.disconnect();
      terminal?.dispose();
    };
  }, [addLog, isReady]);

  return (
    <AppLayout>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">Terminal</h1>
            <StatusIndicator status={status} />
          </div>
          {(status === "error" || status === "disconnected") && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-fg hover:bg-primary/90"
            >
              Reconnect
            </button>
          )}
        </div>

        {status === "error" && errorMessage && (
          <div className="bg-danger/10 px-4 py-2 text-danger text-sm">
            {errorMessage}
          </div>
        )}

        <div
          ref={terminalRef}
          className="flex-1 bg-[#0a0a0a] p-2"
          style={{ minHeight: "300px" }}
        />

        {/* Debug logs panel */}
        <div className="border-t border-border bg-muted/30 max-h-48 overflow-auto">
          <div className="px-4 py-2 text-xs font-semibold text-muted-fg border-b border-border flex justify-between items-center">
            <span>Debug Logs ({logs.length})</span>
            <button
              type="button"
              onClick={() => setLogs([])}
              className="text-xs text-muted-fg hover:text-foreground"
            >
              Clear
            </button>
          </div>
          <div className="p-2 font-mono text-xs text-muted-fg space-y-0.5">
            {logs.map((log, i) => (
              <div key={`${i}-${log}`} className="whitespace-pre-wrap">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatusIndicator({ status }: { status: TerminalStatus }) {
  const colors = {
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    disconnected: "bg-gray-500",
    error: "bg-red-500",
  };

  const texts = {
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
    error: "Error",
  };

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-fg">
      <span className={`size-2 rounded-full ${colors[status]}`} />
      <span>{texts[status]}</span>
    </div>
  );
}
