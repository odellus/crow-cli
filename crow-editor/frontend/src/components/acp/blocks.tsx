/* Crow IDE ACP Blocks - Message and notification blocks */
import type {
  ContentBlock,
  ToolCallContent,
  ToolCallLocation,
} from "@zed-industries/agent-client-protocol";
import { capitalize } from "lodash-es";
import {
  BotMessageSquareIcon,
  FileAudio2Icon,
  FileIcon,
  FileImageIcon,
  FileJsonIcon,
  FileTextIcon,
  FileVideoCameraIcon,
  RotateCcwIcon,
  WifiIcon,
  WifiOffIcon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { JsonRpcError, mergeToolCalls } from "use-acp";
import { MarkdownRenderer } from "./markdown-renderer";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn, uniqueByTakeLast, Strings } from "./adapters";
import { SimpleAccordion } from "./common";
import type {
  AgentNotificationEvent,
  AgentThoughtNotificationEvent,
  ConnectionChangeNotificationEvent,
  ContentBlockOf,
  CurrentModeUpdateNotificationEvent,
  ErrorNotificationEvent,
  PlanNotificationEvent,
  SessionNotificationEventData,
  ToolCallNotificationEvent,
  ToolCallUpdateNotificationEvent,
  UserNotificationEvent,
} from "./types";
import {
  isAgentMessages,
  isAgentThoughts,
  isPlans,
  isToolCalls,
  isUserMessages,
} from "./utils";

/**
 * Merges consecutive text blocks into a single text block to prevent
 * fragmented display when agent messages are streamed in chunks.
 */
function mergeConsecutiveTextBlocks(
  contentBlocks: ContentBlock[]
): ContentBlock[] {
  if (contentBlocks.length === 0) {
    return contentBlocks;
  }

  const merged: ContentBlock[] = [];
  let currentTextBlock: string | null = null;

  for (const block of contentBlocks) {
    if (block.type === "text") {
      if (currentTextBlock === null) {
        currentTextBlock = block.text;
      } else {
        currentTextBlock += block.text;
      }
    } else {
      if (currentTextBlock !== null) {
        merged.push({ type: "text", text: currentTextBlock });
        currentTextBlock = null;
      }
      merged.push(block);
    }
  }

  if (currentTextBlock !== null) {
    merged.push({ type: "text", text: currentTextBlock });
  }

  return merged;
}

export const ErrorBlock = (props: {
  data: ErrorNotificationEvent["data"];
  onRetry?: () => void;
  onDismiss?: () => void;
}) => {
  const error = props.data;
  let message = props.data.message;

  // Don't show WebSocket connection errors
  if (message.includes("WebSocket")) {
    return null;
  }

  if (error instanceof JsonRpcError) {
    const dataStr =
      typeof error.data === "string" ? error.data : JSON.stringify(error.data);
    message = `${dataStr} (code: ${error.code})`;
  }

  return (
    <div
      className="border border-red-700 bg-red-900/30 rounded-lg p-4 my-2"
      data-block-type="error"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-medium text-red-300">Agent Error</h4>
          </div>
          <div className="text-sm text-red-400 leading-relaxed mb-3">
            {message}
          </div>
          <div className="flex items-center gap-2">
            {props.onRetry && (
              <Button
                size="xs"
                variant="outline"
                onClick={props.onRetry}
                className="text-red-400 border-red-700 hover:bg-red-900/50"
              >
                <RotateCcwIcon className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {props.onDismiss && (
              <Button
                size="xs"
                variant="ghost"
                onClick={props.onDismiss}
                className="text-red-400 hover:bg-red-900/50"
              >
                <XIcon className="h-3 w-3 mr-1" />
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ReadyToChatBlock = () => {
  return (
    <div className="flex-1 flex items-center justify-center h-full min-h-[200px] flex-col">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-blue-900/50 flex items-center justify-center">
          <BotMessageSquareIcon className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-medium text-gray-100 mb-1">
            Agent is connected
          </h3>
          <p className="text-sm text-gray-400">
            You can start chatting with your agent now
          </p>
        </div>
      </div>
    </div>
  );
};

export const ConnectionChangeBlock = (props: {
  data: ConnectionChangeNotificationEvent["data"];
  isConnected: boolean;
  onRetry?: () => void;
  timestamp?: number;
  isOnlyBlock: boolean;
}) => {
  const { status } = props.data;

  if (props.isConnected && props.isOnlyBlock) {
    return <ReadyToChatBlock />;
  }

  const getStatusConfig = () => {
    switch (status) {
      case "connected":
        return {
          icon: <WifiIcon className="h-4 w-4" />,
          title: "Connected to Agent",
          message: "Successfully established connection with the AI agent",
          bgColor: "bg-blue-900/30",
          borderColor: "border-blue-700",
          textColor: "text-blue-300",
          iconColor: "text-blue-400",
        };
      case "disconnected":
        return {
          icon: <WifiOffIcon className="h-4 w-4" />,
          title: "Disconnected from Agent",
          message: "Connection to the AI agent has been lost",
          bgColor: "bg-amber-900/30",
          borderColor: "border-amber-700",
          textColor: "text-amber-300",
          iconColor: "text-amber-400",
        };
      case "connecting":
        return {
          icon: <WifiIcon className="h-4 w-4 animate-pulse" />,
          title: "Connecting to Agent",
          message: "Establishing connection with the AI agent...",
          bgColor: "bg-gray-800",
          borderColor: "border-gray-700",
          textColor: "text-gray-300",
          iconColor: "text-gray-400",
        };
      case "error":
        return {
          icon: <WifiOffIcon className="h-4 w-4" />,
          title: "Connection Error",
          message: "Failed to connect to the AI agent",
          bgColor: "bg-red-900/30",
          borderColor: "border-red-700",
          textColor: "text-red-300",
          iconColor: "text-red-400",
        };
      default:
        return {
          icon: <WifiOffIcon className="h-4 w-4" />,
          title: "Connection Status Changed",
          message: `Agent connection status: ${status}`,
          bgColor: "bg-gray-800",
          borderColor: "border-gray-700",
          textColor: "text-gray-300",
          iconColor: "text-gray-400",
        };
    }
  };

  const config = getStatusConfig();
  const showRetry = status === "disconnected" || status === "error";

  return (
    <div
      className={`border ${config.borderColor} ${config.bgColor} rounded-lg p-3 my-2`}
      data-block-type="connection-change"
      data-status={status}
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`text-sm font-medium ${config.textColor}`}>
              {config.title}
            </h4>
            {props.timestamp && (
              <span className="text-xs text-gray-400">
                {new Date(props.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className={`text-sm ${config.textColor} opacity-90 mb-2`}>
            {config.message}
          </div>
          {showRetry && props.onRetry && (
            <Button
              size="xs"
              variant="outline"
              onClick={props.onRetry}
              className={`${config.textColor} ${config.borderColor}`}
            >
              <RotateCcwIcon className="h-3 w-3 mr-1" />
              Retry Connection
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const AgentThoughtsBlock = (props: {
  startTimestamp: number;
  endTimestamp: number;
  data: AgentThoughtNotificationEvent[];
}) => {
  const startAsSeconds = props.startTimestamp / 1000;
  const endAsSeconds = props.endTimestamp / 1000;
  const totalSeconds = Math.round(endAsSeconds - startAsSeconds) || "1";
  return (
    <div className="text-xs text-gray-400">
      <SimpleAccordion title={`Thought for ${totalSeconds}s`}>
        <div className="flex flex-col gap-2 text-gray-400">
          <ContentBlocks data={props.data.map((item) => item.content)} />
        </div>
      </SimpleAccordion>
    </div>
  );
};

export const PlansBlock = (props: { data: PlanNotificationEvent[] }) => {
  let plans = props.data.flatMap((item) => item.entries);
  plans = uniqueByTakeLast(plans, (item) => item.content);

  const completedCount = plans.filter((p) => p.status === "completed").length;
  const inProgressCount = plans.filter((p) => p.status === "in_progress").length;
  const pendingCount = plans.filter((p) => p.status === "pending").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex h-4 w-4 items-center justify-center rounded bg-green-600 text-white text-[10px] font-bold">
            ✓
          </span>
        );
      case "in_progress":
        // Subtle pulsing dot instead of spinning loader
        return (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-2 w-2 rounded-full bg-blue-400 animate-ping opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-blue-500" />
          </span>
        );
      default:
        return (
          <span className="flex h-4 w-4 items-center justify-center rounded border border-gray-500 bg-gray-700" />
        );
    }
  };

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-xs">
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-gray-200 flex items-center gap-2">
          <WrenchIcon className="h-3.5 w-3.5 text-gray-400" />
          Tasks
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {completedCount > 0 && (
            <span className="text-green-400">{completedCount} done</span>
          )}
          {inProgressCount > 0 && (
            <span className="text-blue-400">{inProgressCount} active</span>
          )}
          {pendingCount > 0 && (
            <span className="text-gray-500">{pendingCount} pending</span>
          )}
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {plans.map((item, index) => (
          <li
            key={`${item.content}-${index}`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded transition-colors",
              item.status === "in_progress" && "bg-blue-900/20 border border-blue-700/30",
              item.status === "completed" && "bg-green-900/10"
            )}
          >
            {getStatusIcon(item.status)}
            <span
              className={cn(
                "text-xs flex-1",
                item.status === "completed" && "line-through text-gray-500",
                item.status === "in_progress" && "text-blue-300 font-medium",
                item.status === "pending" && "text-gray-300"
              )}
            >
              {item.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const UserMessagesBlock = (props: { data: UserNotificationEvent[] }) => {
  return (
    <div className="flex flex-col gap-2 text-gray-300 border border-gray-700 p-2 bg-gray-800 rounded break-words overflow-x-hidden">
      <ContentBlocks data={props.data.map((item) => item.content)} />
    </div>
  );
};

export const AgentMessagesBlock = (props: {
  data: AgentNotificationEvent[];
  isStreaming?: boolean;
}) => {
  const mergedContent = mergeConsecutiveTextBlocks(
    props.data.map((item) => item.content)
  );

  return (
    <div className="flex flex-col gap-2">
      <ContentBlocks data={mergedContent} isStreaming={props.isStreaming} />
    </div>
  );
};

export const ContentBlocks = (props: { data: ContentBlock[]; isStreaming?: boolean }) => {
  const renderBlock = (block: ContentBlock) => {
    if (block.type === "text") {
      return <MarkdownRenderer content={block.text} isStreaming={props.isStreaming} />;
    }
    if (block.type === "image") {
      return <ImageBlock data={block as ContentBlockOf<"image">} />;
    }
    if (block.type === "audio") {
      return <AudioBlock data={block as ContentBlockOf<"audio">} />;
    }
    if (block.type === "resource") {
      return <ResourceBlock data={block as ContentBlockOf<"resource">} />;
    }
    if (block.type === "resource_link") {
      return <ResourceLinkBlock data={block as ContentBlockOf<"resource_link">} />;
    }
    return null;
  };

  return (
    <div>
      {props.data.map((item, index) => (
        <React.Fragment key={`${item.type}-${index}`}>
          {renderBlock(item)}
        </React.Fragment>
      ))}
    </div>
  );
};

export const ImageBlock = (props: { data: ContentBlockOf<"image"> }) => {
  return (
    <img
      src={`data:${props.data.mimeType};base64,${props.data.data}`}
      alt={props.data.uri ?? ""}
      className="max-w-full rounded"
    />
  );
};

export const AudioBlock = (props: { data: ContentBlockOf<"audio"> }) => {
  return (
    <audio
      src={`data:${props.data.mimeType};base64,${props.data.data}`}
      controls={true}
    >
      <track kind="captions" />
    </audio>
  );
};

export const ResourceBlock = (props: { data: ContentBlockOf<"resource"> }) => {
  if ("text" in props.data.resource) {
    return (
      <Popover>
        <PopoverTrigger>
          <span className="flex items-center gap-1 hover:bg-gray-700 rounded-md px-1 cursor-pointer">
            {props.data.resource.mimeType && (
              <MimeIcon mimeType={props.data.resource.mimeType} />
            )}
            {props.data.resource.uri}
          </span>
        </PopoverTrigger>
        <PopoverContent className="max-h-96 overflow-y-auto whitespace-pre-wrap w-full max-w-[500px]">
          <span className="text-gray-400 text-xs mb-1 italic">
            Formatted for agents, not humans.
          </span>
          {props.data.resource.mimeType === "text/plain" ? (
            <pre className="text-xs whitespace-pre-wrap p-2 bg-gray-800 rounded-md break-words text-gray-300">
              {props.data.resource.text}
            </pre>
          ) : (
            <MarkdownRenderer content={props.data.resource.text} />
          )}
        </PopoverContent>
      </Popover>
    );
  }
  return null;
};

export const ResourceLinkBlock = (props: {
  data: ContentBlockOf<"resource_link">;
}) => {
  if (props.data.uri.startsWith("http")) {
    return (
      <a
        href={props.data.uri}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline px-1"
      >
        {props.data.name}
      </a>
    );
  }

  if (props.data.mimeType?.startsWith("image/")) {
    return (
      <div>
        <Popover>
          <PopoverTrigger>
            <span className="flex items-center gap-1 hover:bg-gray-700 rounded-md px-1 cursor-pointer">
              <MimeIcon mimeType={props.data.mimeType} />
              {props.data.name || props.data.title || props.data.uri}
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[500px] p-2">
            <img
              src={props.data.uri}
              alt={props.data.name || props.data.title || "Image"}
              className="max-w-full max-h-96 object-contain"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <span className="flex items-center gap-1 px-1">
      {props.data.mimeType && <MimeIcon mimeType={props.data.mimeType} />}
      {props.data.name || props.data.title || props.data.uri}
    </span>
  );
};

export const MimeIcon = (props: { mimeType: string }) => {
  const classNames = "h-3 w-3 flex-shrink-0";
  if (props.mimeType.startsWith("image/")) {
    return <FileImageIcon className={classNames} />;
  }
  if (props.mimeType.startsWith("audio/")) {
    return <FileAudio2Icon className={classNames} />;
  }
  if (props.mimeType.startsWith("video/")) {
    return <FileVideoCameraIcon className={classNames} />;
  }
  if (props.mimeType.startsWith("text/")) {
    return <FileTextIcon className={classNames} />;
  }
  if (props.mimeType.startsWith("application/")) {
    return <FileJsonIcon className={classNames} />;
  }
  return <FileIcon className={classNames} />;
};

export const SessionNotificationsBlock = <
  T extends SessionNotificationEventData
>(props: {
  data: T[];
  startTimestamp: number;
  endTimestamp: number;
  isLastBlock: boolean;
  isStreaming?: boolean;
}) => {
  if (props.data.length === 0) {
    return null;
  }
  const kind = props.data[0].sessionUpdate;

  const renderItems = (items: T[]) => {
    if (isToolCalls(items)) {
      return (
        <ToolNotificationsBlock
          data={items}
          isLastBlock={props.isLastBlock}
          startTimestamp={props.startTimestamp}
          endTimestamp={props.endTimestamp}
        />
      );
    }
    if (isAgentThoughts(items)) {
      return (
        <AgentThoughtsBlock
          startTimestamp={props.startTimestamp}
          endTimestamp={props.endTimestamp}
          data={items}
        />
      );
    }
    if (isUserMessages(items)) {
      return <UserMessagesBlock data={items} />;
    }
    if (isAgentMessages(items)) {
      return <AgentMessagesBlock data={items} isStreaming={props.isStreaming} />;
    }
    if (isPlans(items)) {
      return <PlansBlock data={items} />;
    }

    if (kind === "available_commands_update") {
      return null;
    }
    if (kind === "current_mode_update") {
      const lastItem = items.at(-1);
      return lastItem?.sessionUpdate === "current_mode_update" ? (
        <CurrentModeBlock data={lastItem as CurrentModeUpdateNotificationEvent} />
      ) : null;
    }

    return (
      <SimpleAccordion title={items[0].sessionUpdate}>
        <pre className="text-xs overflow-auto max-h-64">
          {JSON.stringify(items, null, 2)}
        </pre>
      </SimpleAccordion>
    );
  };

  return (
    <div className="flex flex-col text-sm gap-2" data-block-type={kind}>
      {renderItems(props.data)}
    </div>
  );
};

export const CurrentModeBlock = (props: {
  data: CurrentModeUpdateNotificationEvent;
}) => {
  const { currentModeId } = props.data;
  return <div className="text-xs text-gray-400">Mode: {currentModeId}</div>;
};

export const ToolNotificationsBlock = (props: {
  data: (ToolCallNotificationEvent | ToolCallUpdateNotificationEvent)[];
  isLastBlock: boolean;
  startTimestamp?: number;
  endTimestamp?: number;
}) => {
  const toolCalls = mergeToolCalls(props.data);

  // Calculate duration for each tool call by looking at the raw events
  const toolDurations = new Map<string, number>();
  const toolStartTimes = new Map<string, number>();

  // Group events by toolCallId and find start/end times
  props.data.forEach((event, index) => {
    const toolCallId = event.toolCallId;
    if (!toolCallId) return;

    // Use index as a proxy for time ordering if no timestamps
    if (!toolStartTimes.has(toolCallId)) {
      toolStartTimes.set(toolCallId, index);
    }

    // If this is a completed/failed status, calculate duration
    if (event.sessionUpdate === "tool_call_update" &&
        (event.status === "completed" || event.status === "failed")) {
      const startIndex = toolStartTimes.get(toolCallId) ?? 0;
      // Each event roughly represents some time passing
      // Use timestamp diff if available from parent, else estimate
      if (props.startTimestamp && props.endTimestamp) {
        const totalDuration = props.endTimestamp - props.startTimestamp;
        const eventsCount = props.data.length;
        const eventDuration = totalDuration / eventsCount;
        toolDurations.set(toolCallId, Math.round((index - startIndex + 1) * eventDuration));
      }
    }
  });

  return (
    <div className="flex flex-col gap-1 text-gray-400 overflow-x-hidden">
      {toolCalls.map((item) => (
        <SimpleAccordion
          key={item.toolCallId}
          status={
            item.status === "completed"
              ? "success"
              : item.status === "failed"
              ? "error"
              : (item.status === "in_progress" || item.status === "pending") &&
                props.isLastBlock
              ? "loading"
              : undefined
          }
          title={
            <span data-tool-data={JSON.stringify(item)}>
              {handleBackticks(toolTitle(item))}
            </span>
          }
          defaultIcon={<WrenchIcon className="h-3 w-3" />}
          durationMs={toolDurations.get(item.toolCallId)}
        >
          <ToolBodyBlock data={item} />
        </SimpleAccordion>
      ))}
    </div>
  );
};

function toolTitle(
  item: Pick<ToolCallUpdateNotificationEvent, "title" | "kind" | "locations">
) {
  let title = item.title;
  if (title === '"undefined"') {
    title = undefined;
  }
  const prefix = title || Strings.startCase(item.kind || "") || "Tool call";
  const firstLocation = item.locations?.[0];
  if (firstLocation && !prefix.includes(firstLocation.path)) {
    return `${prefix}: ${firstLocation.path}`;
  }
  return prefix;
}

function handleBackticks(text: string) {
  if (text.startsWith("`") && text.endsWith("`")) {
    return <i>{text.slice(1, -1)}</i>;
  }
  return text;
}

export const LocationsBlock = (props: { data: ToolCallLocation[] }) => {
  if (props.data.length <= 1) {
    return null;
  }

  const locations = props.data.map((item) => {
    if (item.line) {
      return `${item.path}:${item.line}`;
    }
    return item.path;
  });
  return <div className="flex flex-col gap-2">{locations.join("\n")}</div>;
};

export const ToolBodyBlock = (props: {
  data:
    | Omit<ToolCallNotificationEvent, "sessionUpdate">
    | Omit<ToolCallUpdateNotificationEvent, "sessionUpdate">;
}) => {
  const { content, locations, kind, rawInput, rawOutput } = props.data as {
    content?: ToolCallContent[];
    locations?: ToolCallLocation[];
    kind?: string;
    rawInput?: Record<string, unknown>;
    rawOutput?: Record<string, unknown>;
  };
  const textContent = content
    ?.filter((item) => item.type === "content")
    .map((item) => (item as ToolCallContent & { type: "content" }).content);
  const hasLocations = locations && locations.length > 0;

  // Render parameters section
  const renderParams = () => {
    if (!rawInput || Object.keys(rawInput).length === 0) return null;

    return (
      <div className="mb-2">
        <div className="text-[10px] uppercase text-gray-500 mb-1 font-semibold">Parameters</div>
        <div className="bg-gray-900/50 border border-gray-700/50 rounded p-2 text-xs">
          {Object.entries(rawInput).map(([key, value]) => (
            <div key={key} className="flex gap-2 mb-1 last:mb-0">
              <span className="text-purple-400 shrink-0">{key}:</span>
              <span className="text-gray-300 break-all">
                {typeof value === "string" ? value : JSON.stringify(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render output section
  const renderOutput = () => {
    if (!rawOutput) return null;

    const outputStr = rawOutput.output
      ? String(rawOutput.output)
      : JSON.stringify(rawOutput, null, 2);

    // Truncate very long outputs
    const displayOutput = outputStr.length > 500
      ? outputStr.substring(0, 500) + "\n... (truncated)"
      : outputStr;

    return (
      <div>
        <div className="text-[10px] uppercase text-gray-500 mb-1 font-semibold">Output</div>
        <pre className="bg-gray-900/50 border border-gray-700/50 rounded p-2 text-xs text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {displayOutput}
        </pre>
      </div>
    );
  };

  if (!content && !hasLocations && rawInput) {
    return (
      <div className="flex flex-col gap-2">
        {renderParams()}
        {renderOutput()}
      </div>
    );
  }

  const noContent = !textContent || textContent.length === 0;
  if (noContent && hasLocations) {
    return (
      <div className="flex flex-col gap-2 pr-2">
        <span className="text-xs text-gray-400">
          {capitalize(kind || "")}{" "}
          {locations?.map((item) => item.path).join(", ")}
        </span>
        {renderParams()}
        {renderOutput()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pr-2">
      {locations && <LocationsBlock data={locations} />}
      {renderParams()}
      {textContent && <ContentBlocks data={textContent} />}
      {renderOutput()}
    </div>
  );
};
