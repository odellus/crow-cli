/* Crow IDE ACP Adapters - Utilities for marimo-inspired ACP implementation */

// className utility (replacement for @/utils/cn)
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Logger (replacement for @/utils/Logger)
export const Logger = {
  debug: (msg: string, data?: Record<string, unknown>) => console.debug(`[crow] ${msg}`, data),
  error: (msg: string, data?: Record<string, unknown>) => console.error(`[crow] ${msg}`, data),
  info: (msg: string, data?: Record<string, unknown>) => console.info(`[crow] ${msg}`, data),
  get: (name: string) => ({
    debug: (msg: string, data?: Record<string, unknown>) => console.debug(`[${name}] ${msg}`, data),
    error: (msg: string, data?: Record<string, unknown>) => console.error(`[${name}] ${msg}`, data),
    info: (msg: string, data?: Record<string, unknown>) => console.info(`[${name}] ${msg}`, data),
  }),
};

// Platform detection (replacement for @/core/hotkeys/shortcuts)
export function isPlatformWindows(): boolean {
  return typeof navigator !== 'undefined' && navigator.platform.indexOf('Win') > -1;
}

// jotai JSON storage (replacement for @/utils/storage/jotai)
export const jotaiJsonStorage = {
  getItem: (key: string, initialValue: unknown) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  },
  setItem: (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('Error saving to localStorage', e);
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('Error removing from localStorage', e);
    }
  },
};

// TypedString replacement (replacement for @/utils/typed)
export type TypedString<T extends string> = string & { __brand: T };

// UUID generation (replacement for @/utils/uuid)
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Path utilities (replacement for @/utils/paths)
export const Paths = {
  dirname: (path: string): string => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  },
  basename: (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || '';
  },
};

// String utilities (replacement for @/utils/strings)
export const Strings = {
  startCase: (str: string): string => {
    return str
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  },
};

// Array utilities (replacement for @/utils/arrays)
export function uniqueByTakeLast<T>(arr: T[], keyFn: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of arr) {
    map.set(keyFn(item), item);
  }
  return Array.from(map.values());
}

// Assert never (replacement for @/utils/assertNever)
export function logNever(value: never): null {
  console.error('Unexpected value:', value);
  return null;
}

// Functions utility (replacement for @/utils/functions)
export const Functions = {
  NOOP: () => {},
};

// File to base64 conversion
export async function blobToString(
  blob: Blob,
  format: 'dataUrl' | 'text' = 'dataUrl'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    if (format === 'dataUrl') {
      reader.readAsDataURL(blob);
    } else {
      reader.readAsText(blob);
    }
  });
}

// Crow IDE specific: Current working directory management
// This is updated by App.tsx when workspace changes
let _currentWorkspace: string | null = null;

export function setCurrentWorkspace(path: string | null): void {
  _currentWorkspace = path;
}

export function getCrowCwd(): string {
  if (!_currentWorkspace) {
    throw new Error("No workspace selected");
  }
  return _currentWorkspace;
}

export function hasWorkspace(): boolean {
  return _currentWorkspace !== null;
}

// Crow IDE specific: File operations
export async function readTextFile(path: string): Promise<{ content: string }> {
  const response = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    throw new Error(`Failed to read file: ${path}`);
  }
  const data = await response.json();
  return { content: data.content };
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  const response = await fetch('/api/files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) {
    throw new Error(`Failed to write file: ${path}`);
  }
}
