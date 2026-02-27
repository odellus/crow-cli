/* Crow IDE Directory Browser - Browse and select directories */
import { useState, useEffect } from 'react';
import { Folder, ChevronUp, Home, Loader2 } from 'lucide-react';

interface DirectoryEntry {
  name: string;
  path: string;
}

interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryBrowser({ onSelect, initialPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDirectories(currentPath || undefined);
  }, [currentPath]);

  const loadDirectories = async (path?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/directories/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path || '' }),
      });

      const data = await response.json();

      if (response.ok) {
        setCurrentPath(data.path);
        setParentPath(data.parent);
        setDirectories(data.directories);
      } else {
        setError(data.error || 'Failed to load directories');
      }
    } catch {
      setError('Failed to load directories');
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const goUp = () => {
    if (parentPath) {
      setCurrentPath(parentPath);
    }
  };

  const goHome = () => {
    setCurrentPath('');
  };

  const selectCurrent = () => {
    onSelect(currentPath);
  };

  return (
    <div className="directory-browser flex flex-col h-[300px]">
      {/* Current path and navigation */}
      <div className="flex items-center gap-2 p-2 bg-gray-900 border-b border-gray-700">
        <button
          onClick={goHome}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
          title="Go to home directory"
        >
          <Home className="h-4 w-4" />
        </button>
        <button
          onClick={goUp}
          disabled={!parentPath}
          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Go up"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <div className="flex-1 text-sm text-gray-300 truncate px-2 py-1 bg-gray-800 rounded">
          {currentPath || '~'}
        </div>
        <button
          onClick={selectCurrent}
          className="px-3 py-1.5 text-sm rounded bg-purple-600 hover:bg-purple-500 text-white"
        >
          Select
        </button>
      </div>

      {/* Directory list */}
      <div className="flex-1 overflow-y-auto bg-gray-900/50">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="p-4 text-red-400 text-sm">{error}</div>
        ) : directories.length === 0 ? (
          <div className="p-4 text-gray-500 text-sm">No subdirectories</div>
        ) : (
          <div className="p-1">
            {directories.map((dir) => (
              <button
                key={dir.path}
                onClick={() => navigateTo(dir.path)}
                onDoubleClick={() => onSelect(dir.path)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded
                  hover:bg-gray-700 text-left transition-colors"
              >
                <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                <span className="text-sm text-gray-200 truncate">{dir.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
