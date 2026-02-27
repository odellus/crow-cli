/* Crow IDE File Attachment UI Components */

import { useState } from "react";
import { FileIcon, FileTextIcon, ImageIcon, XIcon, CodeIcon } from "lucide-react";
import { cn } from "./adapters";
import { getFileCategory } from "./context-utils";

interface FileAttachmentPillProps {
  file: File;
  className?: string;
  onRemove: () => void;
}

export function FileAttachmentPill({
  file,
  className,
  onRemove,
}: FileAttachmentPillProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn(
        "py-1 px-2 bg-gray-700 rounded flex flex-row gap-1.5 items-center text-xs text-gray-200 cursor-pointer hover:bg-gray-600 transition-colors",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onRemove}
      title={`Click to remove ${file.name}`}
    >
      {isHovered ? (
        <XIcon className="h-3 w-3 text-red-400" />
      ) : (
        <FileTypeIcon file={file} />
      )}
      <span className="truncate max-w-[120px]">{file.name}</span>
    </div>
  );
}

function FileTypeIcon({ file }: { file: File }) {
  const category = getFileCategory(file);
  const className = "h-3 w-3";

  switch (category) {
    case "image":
      return <ImageIcon className={cn(className, "text-green-400")} />;
    case "code":
      return <CodeIcon className={cn(className, "text-blue-400")} />;
    case "text":
      return <FileTextIcon className={cn(className, "text-yellow-400")} />;
    default:
      return <FileIcon className={cn(className, "text-gray-400")} />;
  }
}

interface FileAttachmentListProps {
  files: File[];
  onRemove: (file: File) => void;
  className?: string;
}

export function FileAttachmentList({
  files,
  onRemove,
  className,
}: FileAttachmentListProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {files.map((file, index) => (
        <FileAttachmentPill
          key={`${file.name}-${index}`}
          file={file}
          onRemove={() => onRemove(file)}
        />
      ))}
    </div>
  );
}
