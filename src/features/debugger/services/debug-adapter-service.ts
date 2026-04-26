import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  DebugAdapterLaunch,
  DebugAdapterSessionInfo,
  DebugProcessOutput,
  DebugProtocolMessage,
  DebugSessionEnded,
} from "@/features/debugger/types/debugger";

interface DebuggerEventHandlers {
  onMessage?: (payload: DebugProtocolMessage) => void;
  onOutput?: (payload: DebugProcessOutput) => void;
  onSessionEnded?: (payload: DebugSessionEnded) => void;
}

export async function startDebugAdapterSession(
  launch: DebugAdapterLaunch,
): Promise<DebugAdapterSessionInfo> {
  return await invoke<DebugAdapterSessionInfo>("debug_start_session", { launch });
}

export async function sendDebugAdapterRequest(
  sessionId: string,
  command: string,
  argumentsPayload?: unknown,
): Promise<number> {
  return await invoke<number>("debug_send_request", {
    sessionId,
    command,
    arguments: argumentsPayload,
  });
}

export async function sendDebugAdapterRawMessage(
  sessionId: string,
  message: unknown,
): Promise<void> {
  await invoke("debug_send_raw_message", { sessionId, message });
}

export async function stopDebugAdapterSession(sessionId: string): Promise<void> {
  await invoke("debug_stop_session", { sessionId });
}

export async function listDebugAdapterSessions(): Promise<DebugAdapterSessionInfo[]> {
  return await invoke<DebugAdapterSessionInfo[]>("debug_list_sessions");
}

export async function subscribeDebuggerEvents(
  handlers: DebuggerEventHandlers,
): Promise<UnlistenFn> {
  const unlistenFns = await Promise.all([
    listen<DebugProtocolMessage>("debugger_message", (event) => {
      handlers.onMessage?.(event.payload);
    }),
    listen<DebugProcessOutput>("debugger_output", (event) => {
      handlers.onOutput?.(event.payload);
    }),
    listen<DebugSessionEnded>("debugger_session_ended", (event) => {
      handlers.onSessionEnded?.(event.payload);
    }),
  ]);

  return () => {
    for (const unlisten of unlistenFns) {
      unlisten();
    }
  };
}
