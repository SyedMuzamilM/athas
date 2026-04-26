import { subscribeDebuggerEvents } from "@/features/debugger/services/debug-adapter-service";
import { useDebuggerStore } from "@/features/debugger/stores/debugger-store";

let unsubscribeDebuggerEvents: (() => void) | null = null;
let pendingSubscription: Promise<void> | null = null;

export function initializeDebuggerEventBridge(): Promise<void> {
  if (unsubscribeDebuggerEvents) return Promise.resolve();
  if (pendingSubscription) return pendingSubscription;

  pendingSubscription = subscribeDebuggerEvents({
    onMessage: (message) => useDebuggerStore.getState().actions.recordAdapterMessage(message),
    onOutput: (output) => useDebuggerStore.getState().actions.recordAdapterOutput(output),
    onSessionEnded: (event) => useDebuggerStore.getState().actions.recordSessionEnded(event),
  })
    .then((unlisten) => {
      unsubscribeDebuggerEvents = unlisten;
    })
    .finally(() => {
      pendingSubscription = null;
    });

  return pendingSubscription;
}

export function disposeDebuggerEventBridge() {
  unsubscribeDebuggerEvents?.();
  unsubscribeDebuggerEvents = null;
}
