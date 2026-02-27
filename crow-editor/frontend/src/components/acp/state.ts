/* Crow IDE ACP State - Based on marimo's ACP implementation */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { capitalize } from "lodash-es";
import { isPlatformWindows, jotaiJsonStorage, generateUUID } from "./adapters";
import type { TypedString } from "./adapters";
import type { ExternalAgentSessionId, SessionSupportType } from "./types";

// Types
export type TabId = TypedString<"TabId">;
export type ExternalAgentId = "karla" | "claude" | "gemini" | "codex" | "opencode" | "openhands" | "crow" | "crow-agent";

// No agents support loading sessions, so we limit to 1, otherwise
// this is confusing to the user when switching between sessions
const MAX_SESSIONS = 1;

export interface AgentSession {
  tabId: TabId;
  agentId: ExternalAgentId;
  title: string;
  createdAt: number;
  lastUsedAt: number;
  // Store the actual agent session ID for resumption
  externalAgentSessionId: ExternalAgentSessionId | null;
  // Selected model for this session (null = agent default)
  selectedModel: string | null;
}

export interface AgentSessionState {
  sessions: AgentSession[];
  activeTabId: TabId | null;
}

// Constants
const STORAGE_KEY = "crow_ide:acp:sessions:v1";
const WORKSPACE_KEY = "crow_ide:workspace:v1";
const RECENT_WORKSPACES_KEY = "crow_ide:recent_workspaces:v1";

// Workspace Atoms
export const workspaceAtom = atomWithStorage<string | null>(
  WORKSPACE_KEY,
  null,  // null = prompt user to select workspace on first launch
  jotaiJsonStorage as unknown as Parameters<typeof atomWithStorage<string | null>>[2],
);

export const recentWorkspacesAtom = atomWithStorage<string[]>(
  RECENT_WORKSPACES_KEY,
  [],
  jotaiJsonStorage as unknown as Parameters<typeof atomWithStorage<string[]>>[2],
);

// Session Atoms
export const agentSessionStateAtom = atomWithStorage<AgentSessionState>(
  STORAGE_KEY,
  {
    sessions: [],
    activeTabId: null,
  },
  jotaiJsonStorage as unknown as Parameters<typeof atomWithStorage<AgentSessionState>>[2],
);

export const selectedTabAtom = atom(
  (get) => {
    const state = get(agentSessionStateAtom) as AgentSessionState;
    if (!state.activeTabId) {
      return null;
    }
    return (
      state.sessions.find((session: AgentSession) => session.tabId === state.activeTabId) ||
      null
    );
  },
  (_get, set, activeTabId: TabId | null) => {
    set(agentSessionStateAtom, {
      ...(_get(agentSessionStateAtom) as AgentSessionState),
      activeTabId: activeTabId,
    });
  },
);

// Utilities
function generateTabId(): TabId {
  // Our tab ID for internal session management
  return `tab_${generateUUID()}` as TabId;
}

export function truncateTitle(title: string, maxLength = 20): string {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength - 3)}...`;
}

export function addSession(
  state: AgentSessionState,
  session: {
    agentId: ExternalAgentId;
    firstMessage?: string;
    model?: string | null;
  },
): AgentSessionState {
  const sessionSupport = getAgentSessionSupport(session.agentId);

  const now = Date.now();
  const title = session.firstMessage
    ? truncateTitle(session.firstMessage.trim())
    : `New ${session.agentId} session`;
  const tabId = generateTabId();

  if (sessionSupport === "single") {
    // For single session agents, replace any existing session for this agent
    const existingSessions = state.sessions.filter(
      (s) => s.agentId === session.agentId,
    );
    const otherSessions = state.sessions.filter(
      (s) => s.agentId !== session.agentId,
    );

    if (existingSessions.length > 0) {
      // Replace the existing session (overwrite it)
      const existingSession = existingSessions[0];
      const updatedSession: AgentSession = {
        agentId: session.agentId,
        title,
        createdAt: now,
        lastUsedAt: now,
        tabId: existingSession.tabId, // Keep the same ID to maintain tab reference
        externalAgentSessionId: null, // Clear the external session ID
        selectedModel: session.model ?? existingSession.selectedModel ?? null,
      };

      return {
        ...state,
        sessions: [...otherSessions.slice(0, MAX_SESSIONS - 1), updatedSession],
        activeTabId: updatedSession.tabId,
      };
    }
  }

  // For multiple session agents or when no existing session exists
  return {
    ...state,
    sessions: [
      ...state.sessions.slice(0, MAX_SESSIONS - 1),
      {
        agentId: session.agentId,
        tabId,
        title,
        createdAt: now,
        lastUsedAt: now,
        externalAgentSessionId: null,
        selectedModel: session.model ?? null,
      },
    ],
    activeTabId: tabId,
  };
}

export function removeSession(
  state: AgentSessionState,
  sessionId: TabId,
): AgentSessionState {
  const filteredSessions = state.sessions.filter((s) => s.tabId !== sessionId);
  const newActiveTabId =
    state.activeTabId === sessionId
      ? filteredSessions.length > 0
        ? filteredSessions[filteredSessions.length - 1].tabId
        : null
      : state.activeTabId;

  return {
    sessions: filteredSessions,
    activeTabId: newActiveTabId,
  };
}

export function updateSessionTitle(
  state: AgentSessionState,
  title: string,
): AgentSessionState {
  const selectedTab = state.activeTabId;
  if (!selectedTab) {
    return state;
  }
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.tabId === selectedTab
        ? { ...session, title: truncateTitle(title) }
        : session,
    ),
  };
}

export function updateSessionLastUsed(
  state: AgentSessionState,
  sessionId: TabId,
): AgentSessionState {
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.tabId === sessionId
        ? { ...session, lastUsedAt: Date.now() }
        : session,
    ),
  };
}

/**
 * Update the sessionId for the currently selected tab
 */
export function updateSessionExternalAgentSessionId(
  state: AgentSessionState,
  externalAgentSessionId: ExternalAgentSessionId,
): AgentSessionState {
  const selectedTab = state.activeTabId;
  if (!selectedTab) {
    return state;
  }
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.tabId === selectedTab
        ? { ...session, externalAgentSessionId, lastUsedAt: Date.now() }
        : session,
    ),
  };
}

export function getSessionsByAgent(
  sessions: AgentSession[],
  agentId: ExternalAgentId,
): AgentSession[] {
  return sessions
    .filter((session) => session.agentId === agentId)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
}

export function getAllAgentIds(): ExternalAgentId[] {
  return ["karla", "claude", "gemini", "codex", "opencode", "openhands", "crow", "crow-agent"];
}

export function getAgentDisplayName(agentId: ExternalAgentId): string {
  return capitalize(agentId);
}

export function getAgentWebSocketUrl(agentId: ExternalAgentId, cwd?: string): string {
  // Route through crow_ide server for session persistence
  // Server proxies to agent while logging all messages to SQLite
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  // Build base URL with agent type
  const baseUrl = `${wsProtocol}//${window.location.host}/acp?agent=${agentId}`;

  // Add cwd if provided - this tells the server where to start the ACP process
  const cwdParam = cwd ? `&cwd=${encodeURIComponent(cwd)}` : '';

  // For karla, openhands, crow, and crow-agent, don't include URL - server will spawn directly from cwd
  if (agentId === "karla" || agentId === "openhands" || agentId === "crow" || agentId === "crow-agent") {
    return `${baseUrl}${cwdParam}`;
  }

  // For other agents, include the URL to proxy to
  const config = AGENT_CONFIG[agentId];
  const targetUrl = encodeURIComponent(config.webSocketUrl);
  return `${baseUrl}&url=${targetUrl}${cwdParam}`;
}

interface AgentConfig {
  port: number;
  command: string;
  webSocketUrl: string;
  sessionSupport: SessionSupportType;
}

const AGENT_CONFIG: Record<ExternalAgentId, AgentConfig> = {
  karla: {
    port: 3000,
    command: "karla-acp",
    webSocketUrl: "ws://localhost:3000/message",
    sessionSupport: "single",
  },
  claude: {
    port: 3017,
    command: "npx @zed-industries/claude-code-acp",
    webSocketUrl: "ws://localhost:3017/message",
    sessionSupport: "single",
  },
  gemini: {
    port: 3019,
    command: "npx @google/gemini-cli --experimental-acp",
    webSocketUrl: "ws://localhost:3019/message",
    sessionSupport: "single",
  },
  codex: {
    port: 3021,
    command: "npx @zed-industries/codex-acp",
    webSocketUrl: "ws://localhost:3021/message",
    sessionSupport: "single",
  },
  opencode: {
    port: 3023,
    command: "npx opencode-ai acp",
    webSocketUrl: "ws://localhost:3023/message",
    sessionSupport: "single",
  },
  openhands: {
    port: 3025,
    command: "uv run --directory OpenHands-CLI openhands acp",
    webSocketUrl: "ws://localhost:3025/message",
    sessionSupport: "single",
  },
  crow: {
    port: 3027,
    command: "uv run --project crow crow acp",
    webSocketUrl: "ws://localhost:3027/message",
    sessionSupport: "single",
  },
  "crow-agent": {
    port: 3029,
    command: "uv run --directory crow-agent crow-agent acp",
    webSocketUrl: "ws://localhost:3029/message",
    sessionSupport: "single",
  },
};

export function getAgentSessionSupport(
  agentId: ExternalAgentId,
): SessionSupportType {
  return AGENT_CONFIG[agentId].sessionSupport;
}

export function getAgentConnectionCommand(agentId: ExternalAgentId): string {
  const port = AGENT_CONFIG[agentId].port;
  const command = AGENT_CONFIG[agentId].command;
  const wrappedCommand = isPlatformWindows() ? `cmd /c ${command}` : command;
  return `npx stdio-to-ws "${wrappedCommand}" --port ${port}`;
}

/**
 * Update the selected model for the currently active session
 */
export function updateSessionModel(
  state: AgentSessionState,
  model: string | null,
): AgentSessionState {
  const selectedTab = state.activeTabId;
  if (!selectedTab) {
    return state;
  }
  return {
    ...state,
    sessions: state.sessions.map((session) =>
      session.tabId === selectedTab
        ? { ...session, selectedModel: model }
        : session,
    ),
  };
}

// Workspace utilities
const MAX_RECENT_WORKSPACES = 5;

export function addRecentWorkspace(
  recentWorkspaces: string[],
  workspace: string,
): string[] {
  // Remove if already exists, add to front, limit to max
  const filtered = recentWorkspaces.filter((w) => w !== workspace);
  return [workspace, ...filtered].slice(0, MAX_RECENT_WORKSPACES);
}

export function getWorkspaceBasename(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

export function shortenWorkspacePath(path: string): string {
  // Replace home directory with ~
  const home = "/home/thomas";  // TODO: Get from server
  if (path.startsWith(home)) {
    return "~" + path.slice(home.length);
  }
  return path;
}
