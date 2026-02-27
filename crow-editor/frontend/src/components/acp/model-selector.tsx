/* Crow IDE ACP Model Selector */
import { memo } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "../ui/select";
import type { SessionModelState } from "./types";

interface ModelSelectorProps {
  sessionModels: SessionModelState | null;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export const ModelSelector = memo<ModelSelectorProps>(
  ({ sessionModels, onModelChange, disabled }) => {
    if (!sessionModels || sessionModels.availableModels.length === 0) {
      return null;
    }

    const { availableModels, currentModelId } = sessionModels;
    const currentModel = availableModels.find(
      (m) => m.modelId === currentModelId
    );
    const displayName = currentModel?.name ?? currentModelId;

    return (
      <Select
        value={currentModelId}
        onValueChange={onModelChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-6 text-xs border-gray-600 bg-gray-800 hover:bg-gray-700 py-0 px-2 gap-1 text-gray-200">
          {displayName}
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Model</SelectLabel>
            {availableModels.map((model, index) => (
              <SelectItem
                key={model.modelId}
                value={model.modelId}
                className="text-xs"
              >
                <div className="flex flex-col">
                  <span>
                    {model.name}
                    {index === 0 && (
                      <span className="text-gray-400 ml-1">(default)</span>
                    )}
                  </span>
                  {model.description && (
                    <span className="text-gray-400 text-xs pt-1 block">
                      {model.description}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
);
ModelSelector.displayName = "ModelSelector";
