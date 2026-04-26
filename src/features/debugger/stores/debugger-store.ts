import { create } from "zustand";
import { createSelectors } from "@/utils/zustand-selectors";
import type {
  DebugBreakpoint,
  DebugLaunchConfig,
  DebugSession,
} from "@/features/debugger/types/debugger";

const BREAKPOINTS_STORAGE_KEY = "athas-debugger-breakpoints";
const USER_CONFIGS_STORAGE_KEY = "athas-debugger-user-configs";

interface DebuggerState {
  breakpoints: DebugBreakpoint[];
  workspaceConfigs: DebugLaunchConfig[];
  userConfigs: DebugLaunchConfig[];
  activeConfigId: string | null;
  activeSession: DebugSession | null;
  actions: {
    hydrate: () => void;
    setWorkspaceConfigs: (configs: DebugLaunchConfig[]) => void;
    setActiveConfigId: (configId: string | null) => void;
    toggleBreakpoint: (filePath: string, line: number) => void;
    setBreakpointEnabled: (breakpointId: string, enabled: boolean) => void;
    removeBreakpoint: (breakpointId: string) => void;
    clearBreakpoints: () => void;
    startSession: (session: DebugSession) => void;
    stopSession: () => void;
    getBreakpointsForFile: (filePath: string) => DebugBreakpoint[];
  };
}

const loadBreakpoints = (): DebugBreakpoint[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(BREAKPOINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is DebugBreakpoint =>
        item &&
        typeof item.id === "string" &&
        typeof item.filePath === "string" &&
        typeof item.line === "number" &&
        typeof item.enabled === "boolean" &&
        typeof item.createdAt === "number",
    );
  } catch {
    return [];
  }
};

const loadUserConfigs = (): DebugLaunchConfig[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(USER_CONFIGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DebugLaunchConfig[];
  } catch {
    return [];
  }
};

const saveBreakpoints = (breakpoints: DebugBreakpoint[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BREAKPOINTS_STORAGE_KEY, JSON.stringify(breakpoints));
};

const createBreakpointId = (filePath: string, line: number) =>
  `bp_${filePath.replace(/[^a-zA-Z0-9]/g, "_")}_${line}`;

export const useDebuggerStore = createSelectors(
  create<DebuggerState>()((set, get) => ({
    breakpoints: loadBreakpoints(),
    workspaceConfigs: [],
    userConfigs: loadUserConfigs(),
    activeConfigId: null,
    activeSession: null,
    actions: {
      hydrate: () => {
        set({
          breakpoints: loadBreakpoints(),
          userConfigs: loadUserConfigs(),
        });
      },

      setWorkspaceConfigs: (configs) => {
        set({ workspaceConfigs: configs });
      },

      setActiveConfigId: (configId) => {
        set({ activeConfigId: configId });
      },

      toggleBreakpoint: (filePath, line) => {
        set((state) => {
          const existing = state.breakpoints.find(
            (breakpoint) => breakpoint.filePath === filePath && breakpoint.line === line,
          );

          const nextBreakpoints = existing
            ? state.breakpoints.filter((breakpoint) => breakpoint.id !== existing.id)
            : [
                ...state.breakpoints,
                {
                  id: createBreakpointId(filePath, line),
                  filePath,
                  line,
                  enabled: true,
                  createdAt: Date.now(),
                },
              ];

          saveBreakpoints(nextBreakpoints);
          return { breakpoints: nextBreakpoints };
        });
      },

      setBreakpointEnabled: (breakpointId, enabled) => {
        set((state) => {
          const nextBreakpoints = state.breakpoints.map((breakpoint) =>
            breakpoint.id === breakpointId ? { ...breakpoint, enabled } : breakpoint,
          );
          saveBreakpoints(nextBreakpoints);
          return { breakpoints: nextBreakpoints };
        });
      },

      removeBreakpoint: (breakpointId) => {
        set((state) => {
          const nextBreakpoints = state.breakpoints.filter(
            (breakpoint) => breakpoint.id !== breakpointId,
          );
          saveBreakpoints(nextBreakpoints);
          return { breakpoints: nextBreakpoints };
        });
      },

      clearBreakpoints: () => {
        saveBreakpoints([]);
        set({ breakpoints: [] });
      },

      startSession: (session) => {
        set({ activeSession: session });
      },

      stopSession: () => {
        set((state) => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, status: "idle" }
            : state.activeSession,
        }));
      },

      getBreakpointsForFile: (filePath) => {
        return get().breakpoints.filter((breakpoint) => breakpoint.filePath === filePath);
      },
    },
  })),
);
