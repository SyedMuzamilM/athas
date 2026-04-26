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
  type?: string;
  request?: "launch" | "attach";
  program?: string;
  cwd?: string;
  args?: string[];
  command?: string;
  env?: Record<string, string>;
  adapterCommand?: string;
  adapterArgs?: string[];
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

export interface DebugAdapterLaunch {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface DebugAdapterSessionInfo {
  id: string;
  command: string;
  args: string[];
  cwd?: string;
}

export interface DebugProtocolMessage {
  sessionId: string;
  message: unknown;
}

export interface DebugProcessOutput {
  sessionId: string;
  stream: "stdout" | "stderr" | string;
  data: string;
}

export interface DebugSessionEnded {
  sessionId: string;
  reason: string;
}
