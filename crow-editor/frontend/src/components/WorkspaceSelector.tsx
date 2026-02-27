/* Crow IDE Workspace Selector */
import { useState, useEffect } from 'react';
import { useAtom } from 'jotai';
import { FolderOpen, Folder } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import {
  workspaceAtom,
  recentWorkspacesAtom,
  addRecentWorkspace,
  getWorkspaceBasename,
  shortenWorkspacePath,
} from './acp/state';
import { DirectoryBrowser } from './DirectoryBrowser';

interface WorkspaceSelectorProps {
  className?: string;
}

export function WorkspaceSelector({ className }: WorkspaceSelectorProps) {
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [recentWorkspaces, setRecentWorkspaces] = useAtom(recentWorkspacesAtom);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Open dialog on first launch if no workspace
  useEffect(() => {
    if (!workspace) {
      setDialogOpen(true);
    }
  }, [workspace]);

  const selectWorkspace = (path: string) => {
    setWorkspace(path);
    setRecentWorkspaces(addRecentWorkspace(recentWorkspaces, path));
    setDialogOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={`workspace-button flex items-center gap-2 px-3 py-1.5 rounded-md
          bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm
          border border-gray-700 transition-colors ${className || ''}`}
      >
        <FolderOpen className="h-4 w-4" />
        <span className="max-w-[200px] truncate">
          {workspace ? getWorkspaceBasename(workspace) : 'Open Workspace'}
        </span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Open Workspace</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Directory Browser */}
            <DirectoryBrowser
              onSelect={selectWorkspace}
              initialPath={workspace || undefined}
            />

            {/* Recent Workspaces */}
            {recentWorkspaces.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-400">
                  Recent Workspaces
                </label>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {recentWorkspaces.map((recentPath) => (
                    <button
                      key={recentPath}
                      onClick={() => selectWorkspace(recentPath)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md
                        bg-gray-900 hover:bg-gray-700 text-left transition-colors
                        border border-gray-700"
                    >
                      <Folder className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200 truncate">
                          {getWorkspaceBasename(recentPath)}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {shortenWorkspacePath(recentPath)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={!workspace}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
