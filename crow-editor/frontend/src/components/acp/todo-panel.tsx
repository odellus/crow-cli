/* Crow IDE Sticky Todo Panel - Collapsible task list above prompt input */
import { CheckCircle2, ChevronDown, ChevronUp, Circle, ListTodo } from "lucide-react";
import React, { useState, useMemo } from "react";
import { cn, uniqueByTakeLast } from "./adapters";
import type { PlanNotificationEvent } from "./types";

interface TodoPanelProps {
  plans: PlanNotificationEvent[];
}

export const TodoPanel: React.FC<TodoPanelProps> = ({ plans }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get todos from the LATEST plan notification
  // If the latest plan has empty entries, the list is cleared
  const todos = useMemo(() => {
    if (plans.length === 0) return [];

    // Check if the most recent plan notification cleared the list
    const latestPlan = plans[plans.length - 1];
    // entries might be undefined or empty array when clearing
    if (!latestPlan.entries || latestPlan.entries.length === 0) {
      return []; // List was cleared
    }

    // Otherwise, flatten and dedupe all entries (filter out undefined entries)
    const items = plans.flatMap((item) => item.entries ?? []);
    return uniqueByTakeLast(items, (item) => item.content);
  }, [plans]);

  // Count by status
  const counts = useMemo(() => {
    return {
      completed: todos.filter((t) => t.status === "completed").length,
      in_progress: todos.filter((t) => t.status === "in_progress").length,
      pending: todos.filter((t) => t.status === "pending").length,
    };
  }, [todos]);

  // Don't render if no todos
  if (todos.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case "in_progress":
        // Subtle pulsing dot instead of spinning loader
        return (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-2 w-2 rounded-full bg-blue-400 animate-ping opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-blue-500" />
          </span>
        );
      default:
        return <Circle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusLabel = () => {
    const parts: string[] = [];
    if (counts.completed > 0) parts.push(`${counts.completed} done`);
    if (counts.in_progress > 0) parts.push(`${counts.in_progress} active`);
    if (counts.pending > 0) parts.push(`${counts.pending} pending`);
    return parts.join(", ");
  };

  return (
    <div className="border-t border-gray-700 bg-gray-850 flex-shrink-0">
      {/* Header - always visible */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-800 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">Tasks</span>
          <span className="text-xs text-gray-500">({getStatusLabel()})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mini progress indicator */}
          <div className="flex items-center gap-1">
            {counts.completed > 0 && (
              <span className="text-xs text-green-400">{counts.completed}</span>
            )}
            <span className="text-gray-600">/</span>
            <span className="text-xs text-gray-400">{todos.length}</span>
          </div>
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Task list - collapsible */}
      {!isCollapsed && (
        <div className="px-3 pb-3 max-h-48 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {todos.map((item, index) => (
              <li
                key={`${item.content}-${index}`}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-all",
                  item.status === "in_progress" && "bg-blue-900/30 border border-blue-700/40",
                  item.status === "completed" && "opacity-60"
                )}
              >
                {getStatusIcon(item.status)}
                <span
                  className={cn(
                    "flex-1",
                    item.status === "completed" && "line-through text-gray-500",
                    item.status === "in_progress" && "text-blue-200 font-medium",
                    item.status === "pending" && "text-gray-300"
                  )}
                >
                  {item.content}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TodoPanel;
