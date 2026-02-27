/* Crow IDE ACP Context Utilities - Convert files to ACP resource blocks */

import type { ContentBlock } from "@zed-industries/agent-client-protocol";
import { Logger } from "./adapters";

const logger = Logger.get("context-utils");

/**
 * Convert a Blob/File to base64 data URL
 */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts File objects to agent protocol resource_link content blocks
 */
export async function convertFilesToResourceLinks(
  files: File[]
): Promise<ContentBlock[]> {
  const resourceLinks: ContentBlock[] = [];

  for (const file of files) {
    try {
      const dataUrl = await blobToDataUrl(file);
      resourceLinks.push({
        type: "resource_link",
        uri: dataUrl,
        mimeType: file.type || "application/octet-stream",
        name: file.name,
      });
      logger.debug("Converted file to resource_link", { name: file.name, type: file.type });
    } catch (error) {
      logger.error("Error converting file to resource link", {
        fileName: file.name,
        error,
      });
    }
  }

  return resourceLinks;
}

/**
 * Supported file types for attachment
 */
export const SUPPORTED_ATTACHMENT_TYPES = [
  // Images
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  // Text
  "text/plain",
  "text/markdown",
  "text/csv",
  // Code
  "text/javascript",
  "text/typescript",
  "text/html",
  "text/css",
  "application/json",
  "application/xml",
  // Documents
  "application/pdf",
];

/**
 * Get file type category for icon display
 */
export function getFileCategory(file: File): "image" | "text" | "code" | "other" {
  if (file.type.startsWith("image/")) {
    return "image";
  }
  if (file.type.startsWith("text/") || file.type === "application/json") {
    return "code";
  }
  if (file.type === "text/plain" || file.type === "text/markdown") {
    return "text";
  }
  return "other";
}
