/* Crow IDE ACP Agent Panel - Main component based on marimo's implementation */

import { useAtom } from "jotai";
import { capitalize } from "lodash-es";
import {
  BotMessageSquareIcon,
  ClockIcon,
  Loader2,
  PaperclipIcon,
  RefreshCwIcon,
  SendIcon,
  SquareIcon,
  StopCircleIcon,
} from "lucide-react";
import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useAcpClient } from "use-acp";
import type { ContentBlock, RequestPermissionResponse } from "@zed-industries/agent-client-protocol";
import { Button } from "../ui/button";
import { Tooltip, TooltipProvider } from "../ui/tooltip";
import { cn, Logger, getCrowCwd, readTextFile, writeTextFile } from "./adapters";
import { ConnectionStatus, PermissionRequest } from "./common";
import { AgentDocs } from "./agent-docs";
import { AgentSelector } from "./agent-selector";
import { ModelSelector } from "./model-selector";
import ScrollToBottomButton from "./scroll-to-bottom-button";
import { SessionHistory } from "./session-history";
import { SessionTabs } from "./session-tabs";
import {
  agentSessionStateAtom,
  type AgentSessionState,
  type ExternalAgentId,
  getAgentWebSocketUrl,
  selectedTabAtom,
  updateSessionExternalAgentSessionId,
  updateSessionTitle,
  workspaceAtom,
} from "./state";
import { AgentThread } from "./thread";
import { ReadyToChatBlock } from "./blocks";
import { getAgentPrompt } from "./prompt";
import { TodoPanel } from "./todo-panel";
import type {
  AgentConnectionState,
  AgentPendingPermission,
  AvailableCommands,
  ExternalAgentSessionId,
  NotificationEvent,
  PlanNotificationEvent,
  SessionModelState,
} from "./types";
import { FileAttachmentList } from "./file-attachment";
import { convertFilesToResourceLinks, SUPPORTED_ATTACHMENT_TYPES } from "./context-utils";
import "./agent-panel.css";

const logger = Logger.get("agents");

interface AgentTitleProps {
  currentAgentId?: ExternalAgentId;
}

const AgentTitle = memo<AgentTitleProps>(({ currentAgentId }) => (
  <span className="text-sm font-medium">{capitalize(currentAgentId)}</span>
));
AgentTitle.displayName = "AgentTitle";

interface ConnectionControlProps {
  connectionState: AgentConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
}

const ConnectionControl = memo<ConnectionControlProps>(
  ({ connectionState, onConnect, onDisconnect }) => {
    const isConnected = connectionState.status === "connected";

    return (
      <Button
        variant="outline"
        size="xs"
        onClick={isConnected ? onDisconnect : onConnect}
        disabled={connectionState.status === "connecting"}
      >
        {isConnected ? "Disconnect" : "Connect"}
      </Button>
    );
  }
);
ConnectionControl.displayName = "ConnectionControl";

interface HeaderInfoProps {
  currentAgentId?: ExternalAgentId;
  connectionStatus: string;
  shouldShowConnectionControl?: boolean;
}

const HeaderInfo = memo<HeaderInfoProps>(
  ({ currentAgentId, connectionStatus, shouldShowConnectionControl }) => (
    <div className="flex items-center gap-2">
      <BotMessageSquareIcon className="h-4 w-4 text-gray-400" />
      {currentAgentId && <AgentTitle currentAgentId={currentAgentId} />}
      {shouldShowConnectionControl && (
        <ConnectionStatus status={connectionStatus} />
      )}
    </div>
  )
);
HeaderInfo.displayName = "HeaderInfo";

interface AgentPanelHeaderProps {
  connectionState: AgentConnectionState;
  currentAgentId?: ExternalAgentId;
  onConnect: () => void;
  onDisconnect: () => void;
  onRestartThread?: () => void;
  onShowHistory?: () => void;
  hasActiveSession?: boolean;
  shouldShowConnectionControl?: boolean;
}

const AgentPanelHeader = memo<AgentPanelHeaderProps>(
  ({
    connectionState,
    currentAgentId,
    onConnect,
    onDisconnect,
    onRestartThread,
    onShowHistory,
    hasActiveSession,
    shouldShowConnectionControl,
  }) => (
    <div className="flex border-b border-gray-700 px-3 py-2 justify-between shrink-0 items-center bg-gray-900">
      <HeaderInfo
        currentAgentId={currentAgentId}
        connectionStatus={connectionState.status}
        shouldShowConnectionControl={shouldShowConnectionControl}
      />
      <div className="flex items-center gap-2">
        {onShowHistory && (
          <Button
            variant="outline"
            size="xs"
            onClick={onShowHistory}
            title="View session history"
          >
            <ClockIcon className="h-3 w-3 mr-1" />
            History
          </Button>
        )}

        {hasActiveSession &&
          connectionState.status === "connected" &&
          onRestartThread && (
            <Button
              variant="outline"
              size="xs"
              onClick={onRestartThread}
              title="Restart thread (create new session)"
            >
              <RefreshCwIcon className="h-3 w-3 mr-1" />
              Restart
            </Button>
          )}

        {shouldShowConnectionControl && (
          <ConnectionControl
            connectionState={connectionState}
            onConnect={onConnect}
            onDisconnect={onDisconnect}
          />
        )}
      </div>
    </div>
  )
);
AgentPanelHeader.displayName = "AgentPanelHeader";

interface EmptyStateProps {
  currentAgentId?: ExternalAgentId;
  connectionState: AgentConnectionState;
  onConnect: () => void;
  onDisconnect: () => void;
  onShowHistory: () => void;
}

const EmptyState = memo<EmptyStateProps>(
  ({ currentAgentId, connectionState, onConnect, onDisconnect, onShowHistory }) => {
    return (
      <div className="flex flex-col h-full">
        <AgentPanelHeader
          connectionState={connectionState}
          currentAgentId={currentAgentId}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onShowHistory={onShowHistory}
          hasActiveSession={false}
        />
        <SessionTabs />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full space-y-6">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
                <BotMessageSquareIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-100 mb-1">
                  No Agent Sessions
                </h3>
                <p className="text-sm text-gray-400">
                  Create a new session to start a conversation
                </p>
              </div>
              <AgentSelector className="mx-auto" />
            </div>
            {connectionState.status === "disconnected" && (
              <AgentDocs
                className="border-t pt-6"
                title="Connect to an agent"
                description="Start agents by running these commands in your terminal:"
              />
            )}
          </div>
        </div>
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

interface LoadingIndicatorProps {
  isLoading: boolean;
  isRequestingPermission: boolean;
  onStop: () => void;
}

const LoadingIndicator = memo<LoadingIndicatorProps>(
  ({ isLoading, isRequestingPermission, onStop }) => {
    if (!isLoading) {
      return null;
    }

    return (
      <div className="px-3 py-2 border-t border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
            {isRequestingPermission ? (
              <span>Waiting for permission to continue...</span>
            ) : (
              <span>Agent is working...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onStop}
              className="h-6 px-2"
            >
              <StopCircleIcon className="h-3 w-3 mr-1" />
              <span className="text-xs">Stop</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
LoadingIndicator.displayName = "LoadingIndicator";

interface PromptAreaProps {
  isLoading: boolean;
  activeSessionId: ExternalAgentSessionId | null;
  promptValue: string;
  commands: AvailableCommands | undefined;
  onPromptValueChange: (value: string) => void;
  onPromptSubmit: (prompt: string, files?: File[]) => void;
  onStop: () => void;
  sessionModels?: SessionModelState | null;
  onModelChange?: (modelId: string) => void;
  files?: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (file: File) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const PromptArea = memo<PromptAreaProps>(
  ({
    isLoading,
    activeSessionId,
    promptValue,
    onPromptValueChange,
    onPromptSubmit,
    onStop,
    sessionModels,
    onModelChange,
    files,
    onAddFiles,
    onRemoveFile,
    fileInputRef,
  }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const wasLoadingRef = useRef(false);

    // Auto-focus textarea when loading completes
    useEffect(() => {
      if (wasLoadingRef.current && !isLoading) {
        // Loading just finished, focus the textarea
        textareaRef.current?.focus();
      }
      wasLoadingRef.current = isLoading;
    }, [isLoading]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Don't submit while agent is processing
        if (isLoading) return;
        if (promptValue.trim() || (files && files.length > 0)) {
          onPromptSubmit(promptValue, files);
        }
      }
    };

    const handleSendClick = () => {
      if (promptValue.trim() || (files && files.length > 0)) {
        onPromptSubmit(promptValue, files);
      }
    };

    const hasContent = promptValue.trim() || (files && files.length > 0);

    return (
      <div className="border-t border-gray-700 bg-gray-900 flex-shrink-0">
        {/* File attachment pills */}
        {files && files.length > 0 && (
          <div className="px-3 pt-2">
            <FileAttachmentList files={files} onRemove={onRemoveFile} />
          </div>
        )}

        <div
          className={cn(
            "px-3 py-2 min-h-[60px]",
            isLoading && "opacity-50 pointer-events-none"
          )}
        >
          <textarea
            ref={textareaRef}
            value={promptValue}
            onChange={(e) => onPromptValueChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? "Processing..."
                : "Ask anything..."
            }
            className="w-full min-h-[40px] max-h-[120px] p-2 text-sm border border-gray-700 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800 text-gray-100 placeholder-gray-500"
          />
        </div>
        <TooltipProvider>
          <div className="px-3 py-2 border-t border-gray-700 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              {sessionModels && onModelChange && activeSessionId && (
                <ModelSelector
                  sessionModels={sessionModels}
                  onModelChange={onModelChange}
                  disabled={isLoading}
                />
              )}
              {/* File attachment button */}
              <Tooltip content="Attach files">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <PaperclipIcon className="h-4 w-4 text-gray-400" />
                </Button>
              </Tooltip>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) {
                    onAddFiles([...e.target.files]);
                    e.target.value = ""; // Reset to allow selecting same file again
                  }
                }}
                accept={SUPPORTED_ATTACHMENT_TYPES.join(",")}
              />
            </div>
            <div className="flex flex-row gap-2 items-center">
              <span className="text-xs text-gray-500">
                {isLoading ? "" : "Enter to send, Shift+Enter for newline"}
              </span>
              <Tooltip content={isLoading ? "Stop" : "Send message"}>
                <Button
                  variant={isLoading ? "outline" : "default"}
                  size="sm"
                  className={cn(
                    "h-8 px-3 cursor-pointer transition-colors",
                    isLoading
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                      : "bg-purple-600 hover:bg-purple-700 text-white border-purple-600",
                    !hasContent && !isLoading && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={isLoading ? onStop : handleSendClick}
                  disabled={isLoading ? false : !hasContent}
                >
                  {isLoading ? (
                    <>
                      <SquareIcon className="h-4 w-4 mr-1 fill-current" />
                      Stop
                    </>
                  ) : (
                    <>
                      <SendIcon className="h-4 w-4 mr-1" />
                      Send
                    </>
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>
    );
  }
);
PromptArea.displayName = "PromptArea";

interface ChatContentProps {
  hasNotifications: boolean;
  agentId: ExternalAgentId | undefined;
  connectionState: AgentConnectionState;
  sessionId: ExternalAgentSessionId | null;
  notifications: NotificationEvent[];
  isStreaming?: boolean;
  pendingPermission: AgentPendingPermission;
  onResolvePermission: (option: RequestPermissionResponse) => void;
  onRetryConnection?: () => void;
  onRetryLastAction?: () => void;
}

const ChatContent = memo<ChatContentProps>(
  ({
    hasNotifications,
    agentId,
    connectionState,
    notifications,
    isStreaming,
    pendingPermission,
    onResolvePermission,
    onRetryConnection,
    sessionId,
  }) => {
    const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isDisconnected = connectionState.status === "disconnected";

    const handleScroll = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = container;
      const hasOverflow = scrollHeight > clientHeight;
      // Use larger threshold (100px) to prevent button flashing during streaming
      const isAtBottom = hasOverflow
        ? Math.abs(scrollHeight - clientHeight - scrollTop) < 100
        : true;
      setIsScrolledToBottom(isAtBottom);
    }, []);

    const scrollToBottom = useCallback(() => {
      const container = scrollContainerRef.current;
      if (!container) {
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }, []);

    // Track previous notification count to detect new messages
    const prevNotificationCount = useRef(notifications.length);

    // Auto-scroll to bottom when notifications change
    // Be more aggressive: always scroll during streaming or when new content arrives
    useEffect(() => {
      const isNewContent = notifications.length > prevNotificationCount.current;
      prevNotificationCount.current = notifications.length;

      if (notifications.length > 0) {
        // Always scroll during streaming or when new content arrives
        // Only skip if user has scrolled up AND no new content
        if (isStreaming || isNewContent || isScrolledToBottom) {
          const rafId = requestAnimationFrame(() => {
            scrollToBottom();
          });
          return () => cancelAnimationFrame(rafId);
        }
      }
    }, [notifications.length, isStreaming, isScrolledToBottom, scrollToBottom]);

    const renderThread = () => {
      if (hasNotifications) {
        return (
          <AgentThread
            isConnected={connectionState.status === "connected"}
            isStreaming={isStreaming}
            notifications={notifications}
            onRetryConnection={onRetryConnection}
          />
        );
      }

      const isConnected = connectionState.status === "connected";
      if (isConnected) {
        return <ReadyToChatBlock />;
      }

      return (
        <div className="flex items-center justify-center h-full min-h-[200px] flex-col">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
              <BotMessageSquareIcon className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-100 mb-1">
                Waiting for agent
              </h3>
              <p className="text-sm text-gray-400">
                Your AI agent will appear here when active
              </p>
            </div>
          </div>
          {isDisconnected && agentId && (
            <AgentDocs
              className="border-t pt-6 px-5 mt-6"
              title="Make sure you're connected to an agent"
              description="Run this command in your terminal:"
              agents={[agentId]}
            />
          )}
          {isDisconnected && (
            <Button
              variant="outline"
              onClick={onRetryConnection}
              type="button"
              className="mt-4"
            >
              Retry
            </Button>
          )}
        </div>
      );
    };

    return (
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
        {pendingPermission && (
          <div className="p-3 border-b">
            <PermissionRequest
              permission={pendingPermission}
              onResolve={onResolvePermission}
            />
          </div>
        )}

        <div
          ref={scrollContainerRef}
          className="flex-1 bg-gray-900 w-full flex flex-col overflow-y-auto p-2"
          onScroll={handleScroll}
        >
          {sessionId && (
            <div className="text-xs text-gray-400 mb-2 px-2">
              Session ID: {sessionId}
            </div>
          )}
          {renderThread()}
        </div>

        <ScrollToBottomButton
          isVisible={!isScrolledToBottom && hasNotifications}
          onScrollToBottom={scrollToBottom}
        />
      </div>
    );
  }
);
ChatContent.displayName = "ChatContent";

const NO_WS_SET = "_skip_auto_connect_";

const AgentPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | string | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sessionModels, setSessionModels] = useState<SessionModelState | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const isCreatingNewSession = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTab] = useAtom(selectedTabAtom);
  const [sessionState, setSessionState] = useAtom(agentSessionStateAtom);
  const [workspace] = useAtom(workspaceAtom);
  const prevWorkspace = useRef(workspace);

  const wsUrl = selectedTab
    ? getAgentWebSocketUrl(selectedTab.agentId, workspace ?? undefined)
    : NO_WS_SET;

  const acpClient = useAcpClient({
    wsUrl,
    clientOptions: {
      readTextFile: async (request) => {
        logger.debug("Agent requesting file read", { path: request.path });
        try {
          const result = await readTextFile(request.path);
          return { content: result.content };
        } catch (e) {
          logger.error("Failed to read file", { path: request.path, error: e });
          throw e;
        }
      },
      writeTextFile: async (request) => {
        logger.debug("Agent requesting file write", {
          path: request.path,
          contentLength: request.content.length,
        });
        try {
          await writeTextFile(request.path, request.content);
          return {};
        } catch (e) {
          logger.error("Failed to write file", { path: request.path, error: e });
          throw e;
        }
      },
    },
    autoConnect: false,
  });

  const {
    connect,
    disconnect,
    setActiveSessionId,
    connectionState,
    notifications,
    pendingPermission,
    availableCommands,
    resolvePermission,
    activeSessionId,
    agent,
  } = acpClient;

  useEffect(() => {
    agent?.initialize({
      protocolVersion: 1,
      clientCapabilities: {
        fs: {
          readTextFile: true,
          writeTextFile: true,
        },
      },
    });
  }, [agent]);

  // Auto-connect when wsUrl changes (agent selected)
  // Also auto-reconnect when connection drops
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = useRef(1000); // Start with 1 second

  useEffect(() => {
    if (wsUrl === NO_WS_SET) {
      return;
    }

    const attemptConnect = async () => {
      try {
        logger.debug("Connecting to agent", { attempt: reconnectAttempts.current + 1 });
        await connect();
        // Reset on successful connection
        reconnectAttempts.current = 0;
        reconnectDelay.current = 1000;
      } catch (error) {
        logger.error("Failed to connect to agent", { error, attempt: reconnectAttempts.current + 1 });
      }
    };

    attemptConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl]);

  // Auto-reconnect when connection drops unexpectedly
  useEffect(() => {
    if (wsUrl === NO_WS_SET) {
      return;
    }

    if (connectionState.status === "disconnected" && reconnectAttempts.current < maxReconnectAttempts) {
      const timer = setTimeout(() => {
        reconnectAttempts.current += 1;
        logger.info("Auto-reconnecting to agent", {
          attempt: reconnectAttempts.current,
          delay: reconnectDelay.current,
        });
        connect().catch((error) => {
          logger.error("Auto-reconnect failed", { error });
          // Exponential backoff
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        });
      }, reconnectDelay.current);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionState.status, wsUrl]);

  // Handle workspace changes - clear sessions and send /clear to reset agent context
  useEffect(() => {
    if (prevWorkspace.current && workspace !== prevWorkspace.current) {
      logger.info("Workspace changed, clearing sessions", {
        from: prevWorkspace.current,
        to: workspace,
      });

      // Send /clear command to reset agent context if we have an active session
      if (agent && activeSessionId) {
        agent.prompt({
          sessionId: activeSessionId,
          prompt: [{ type: "text", text: "/clear" }],
        }).catch((error) => {
          logger.error("Failed to send /clear command", { error });
        });
      }

      // Clear all sessions - start fresh in new workspace
      setSessionState({
        sessions: [],
        activeTabId: null,
      });
    }
    prevWorkspace.current = workspace;
  }, [workspace, agent, activeSessionId, setSessionState]);

  const handleNewSession = useCallback(async () => {
    if (!agent) {
      return;
    }

    if (activeSessionId) {
      setActiveSessionId(null);
      await agent.cancel({ sessionId: activeSessionId }).catch((error) => {
        logger.error("Failed to cancel active session", { error });
      });
    }

    const currentModel = selectedTab?.selectedModel ?? null;
    logger.debug("Creating new agent session", { model: currentModel });
    isCreatingNewSession.current = true;

    const newSession = await agent
      .newSession({
        cwd: getCrowCwd(),
        mcpServers: [],
        _meta: currentModel ? { model: currentModel } : undefined,
      })
      .finally(() => {
        isCreatingNewSession.current = false;
      });

    if (newSession.models) {
      logger.debug("Session models received", { models: newSession.models });
      setSessionModels(newSession.models);
    }

    setSessionState((prev) =>
      updateSessionExternalAgentSessionId(
        prev as AgentSessionState,
        newSession.sessionId as ExternalAgentSessionId
      )
    );
  }, [agent, activeSessionId, selectedTab, setActiveSessionId, setSessionState]);

  const handleResumeSession = useCallback(
    async (previousSessionId: ExternalAgentSessionId) => {
      if (!agent) {
        return;
      }
      logger.debug("Resuming agent session", { sessionId: previousSessionId });
      if (!agent.loadSession) {
        throw new Error("Agent does not support loading sessions");
      }
      const loadedSession = await agent.loadSession({
        sessionId: previousSessionId,
        cwd: getCrowCwd(),
        mcpServers: [],
      });

      if (loadedSession?.models) {
        logger.debug("Session models received", { models: loadedSession.models });
        setSessionModels(loadedSession.models);
      }

      setSessionState((prev) =>
        updateSessionExternalAgentSessionId(prev as AgentSessionState, previousSessionId)
      );
    },
    [agent, setSessionState]
  );

  // Create or resume a session when connected
  const isConnected = connectionState.status === "connected";
  const tabLastActiveSessionId = selectedTab?.externalAgentSessionId;

  useEffect(() => {
    if (!isConnected || !selectedTab || !agent) {
      return;
    }

    if (activeSessionId && tabLastActiveSessionId) {
      return;
    }

    const createOrResumeSession = async () => {
      const availableSession = tabLastActiveSessionId ?? activeSessionId;
      try {
        if (availableSession) {
          try {
            await handleResumeSession(availableSession);
          } catch (error) {
            logger.error("Failed to resume session", {
              sessionId: availableSession,
              error,
            });
            await handleNewSession();
          }
        } else {
          await handleNewSession();
        }
        setError(null);
      } catch (error) {
        logger.error("Failed to create or resume session:", { error });
        setError(error instanceof Error ? error : String(error));
      }
    };

    createOrResumeSession();
  }, [isConnected, agent, tabLastActiveSessionId, activeSessionId, selectedTab, handleNewSession, handleResumeSession]);

  // Handler for prompt submission
  const handlePromptSubmit = useCallback(
    async (prompt: string, attachedFiles?: File[]) => {
      if (!activeSessionId || !agent || isLoading) {
        return;
      }

      logger.debug("Submitting prompt to agent", { sessionId: activeSessionId, fileCount: attachedFiles?.length || 0 });
      setIsLoading(true);
      setPromptValue("");
      setFiles([]);

      // Update session title with first message if it's still the default
      if (selectedTab?.title.startsWith("New ")) {
        setSessionState((prev) => updateSessionTitle(prev as AgentSessionState, prompt));
      }

      const promptBlocks: ContentBlock[] = [{ type: "text", text: prompt }];

      // Add file attachments as resource_links
      if (attachedFiles && attachedFiles.length > 0) {
        const fileResourceLinks = await convertFilesToResourceLinks(attachedFiles);
        promptBlocks.push(...fileResourceLinks);
        logger.debug("Added file attachments", { count: fileResourceLinks.length });
      }

      // Add system prompt on first message
      const hasGivenRules = notifications.some(
        (notification) =>
          notification.type === "session_notification" &&
          notification.data.update.sessionUpdate === "user_message_chunk"
      );

      if (!hasGivenRules) {
        const cwd = getCrowCwd();
        promptBlocks.push({
          type: "resource",
          resource: {
            uri: "crow_ide_rules.md",
            mimeType: "text/plain",
            text: getAgentPrompt(cwd),
          },
        });
      }

      try {
        await agent.prompt({
          sessionId: activeSessionId,
          prompt: promptBlocks,
        });
      } catch (error) {
        logger.error("Failed to send prompt", { error });
      } finally {
        setIsLoading(false);
      }
    },
    [activeSessionId, agent, isLoading, selectedTab, notifications, setSessionState]
  );

  // Handler for adding files
  const handleAddFiles = useCallback((newFiles: File[]) => {
    if (newFiles.length === 0) {
      return;
    }
    setFiles((prev) => [...prev, ...newFiles]);
    logger.debug("Added files", { count: newFiles.length });
  }, []);

  // Handler for removing files
  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setFiles((prev) => prev.filter((f) => f !== fileToRemove));
    logger.debug("Removed file", { name: fileToRemove.name });
  }, []);

  // Handler for stopping the current operation
  const handleStop = useCallback(async () => {
    if (!activeSessionId || !agent) {
      return;
    }
    await agent.cancel({ sessionId: activeSessionId });
    setIsLoading(false);
  }, [activeSessionId, agent]);

  // Handler for manual connect
  const handleManualConnect = useCallback(() => {
    logger.debug("Manual connect requested", {
      currentStatus: connectionState.status,
    });
    connect();
  }, [connect, connectionState.status]);

  // Handler for manual disconnect
  const handleManualDisconnect = useCallback(() => {
    logger.debug("Manual disconnect requested", {
      sessionId: activeSessionId,
      currentStatus: connectionState.status,
    });
    disconnect();
  }, [disconnect, activeSessionId, connectionState.status]);

  const handleModelChange = useCallback(
    (modelId: string) => {
      logger.debug("Model change requested", {
        modelId,
        sessionId: activeSessionId,
      });

      if (!agent || !activeSessionId) {
        return;
      }

      void agent.setSessionModel?.({
        sessionId: activeSessionId,
        modelId,
      });

      setSessionModels((prev) =>
        prev ? { ...prev, currentModelId: modelId } : null
      );
    },
    [agent, activeSessionId]
  );

  const hasNotifications = notifications.length > 0;
  const hasActiveSessions = sessionState.sessions.length > 0;

  // Extract plan notifications for the sticky TodoPanel
  const planNotifications = useMemo((): PlanNotificationEvent[] => {
    const plans: PlanNotificationEvent[] = [];
    for (const n of notifications) {
      if (n.type === "session_notification") {
        const update = (n.data as { update?: { sessionUpdate?: string } })?.update;
        if (update?.sessionUpdate === "plan") {
          plans.push(update as PlanNotificationEvent);
        }
      }
    }
    return plans;
  }, [notifications]);

  // Show history panel if requested (takes priority over everything)
  if (showHistory) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden crow-agent-panel bg-gray-900 text-gray-100">
        <SessionHistory
          onClose={() => setShowHistory(false)}
          onResumeSession={(sessionId) => {
            logger.debug("Resume session from history", { sessionId });
            handleResumeSession(sessionId as ExternalAgentSessionId);
          }}
        />
      </div>
    );
  }

  if (!hasActiveSessions) {
    return (
      <EmptyState
        currentAgentId={selectedTab?.agentId}
        connectionState={connectionState}
        onConnect={handleManualConnect}
        onDisconnect={handleManualDisconnect}
        onShowHistory={() => setShowHistory(true)}
      />
    );
  }

  const renderBody = () => {
    if (error) {
      return (
        <div className="w-3/4 mx-auto mt-10 p-4 border border-red-200 bg-red-50 rounded">
          <div className="text-red-700 text-sm">
            {error instanceof Error ? error.message : error}
          </div>
          <Button
            variant="linkDestructive"
            size="sm"
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      );
    }

    const isConnecting = connectionState.status === "connecting";
    if (isConnecting) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] flex-col">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400 mt-2">
            Connecting to the agent...
          </span>
        </div>
      );
    }

    const isLoadingSession =
      tabLastActiveSessionId == null && connectionState.status === "connected";
    if (isLoadingSession) {
      return (
        <div className="flex items-center justify-center h-full min-h-[200px] flex-col">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <span className="text-sm text-gray-400 mt-2">
            Creating a new session...
          </span>
        </div>
      );
    }

    return (
      <>
        <ChatContent
          key={activeSessionId}
          agentId={selectedTab?.agentId}
          sessionId={selectedTab?.externalAgentSessionId ?? null}
          hasNotifications={hasNotifications}
          connectionState={connectionState}
          notifications={notifications}
          isStreaming={isLoading}
          pendingPermission={pendingPermission}
          onResolvePermission={(option) => {
            logger.debug("Resolving permission request", {
              sessionId: activeSessionId,
              option,
            });
            resolvePermission(option);
          }}
          onRetryConnection={handleManualConnect}
        />

        <LoadingIndicator
          isLoading={isLoading}
          isRequestingPermission={!!pendingPermission}
          onStop={handleStop}
        />

        <TodoPanel plans={planNotifications} />

        <PromptArea
          isLoading={isLoading}
          activeSessionId={activeSessionId}
          promptValue={promptValue}
          onPromptValueChange={setPromptValue}
          onPromptSubmit={handlePromptSubmit}
          onStop={handleStop}
          commands={availableCommands}
          sessionModels={sessionModels}
          onModelChange={handleModelChange}
          files={files}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
          fileInputRef={fileInputRef}
        />
      </>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden crow-agent-panel bg-gray-900 text-gray-100">
      <AgentPanelHeader
        connectionState={connectionState}
        currentAgentId={selectedTab?.agentId}
        onConnect={handleManualConnect}
        onDisconnect={handleManualDisconnect}
        onRestartThread={handleNewSession}
        onShowHistory={() => setShowHistory(true)}
        hasActiveSession={true}
        shouldShowConnectionControl={wsUrl !== NO_WS_SET}
      />
      <SessionTabs />

      {renderBody()}
    </div>
  );
};

export default AgentPanel;
