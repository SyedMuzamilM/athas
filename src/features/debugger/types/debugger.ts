export type DebuggerRuntime = "bun" | "node" | "python" | "rust" | "go" | "custom";

export type DebugSessionStatus = "idle" | "running";

export interface DebugBreakpoint {
  id: string;
  filePath: string;
  line: number;
  enabled: boolean;
  createdAt: number;
}

export interface DebugLaunchConfig {
  id: string;
  name: string;
  runtime: DebuggerRuntime;
  program?: string;
  cwd?: string;
  args?: string[];
  command?: string;
  env?: Record<string, string>;
  source: "generated" | "workspace" | "user";
}

export interface DebugSession {
  id: string;
  name: string;
  configId: string;
  command: string;
  cwd?: string;
  startedAt: number;
  status: DebugSessionStatus;
}

export interface DebuggableFile {
  path: string;
  name: string;
  language?: string;
}
