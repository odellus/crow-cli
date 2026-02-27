import { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { workspaceAtom } from './acp/state'
import './FileTree.css'

interface FileEntry {
  name: string
  path: string
  is_directory: boolean
  size: number
}

interface FileTreeProps {
  onFileSelect?: (path: string) => void
}

export function FileTree({ onFileSelect }: FileTreeProps) {
  const [workspace] = useAtom(workspaceAtom)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [currentPath, setCurrentPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Reset to workspace root when workspace changes
  useEffect(() => {
    setCurrentPath(null)
    setSelectedPath(null)
  }, [workspace])

  useEffect(() => {
    loadFiles()
  }, [currentPath, workspace])

  const loadFiles = async () => {
    // Don't load if no workspace is selected
    if (!workspace) {
      setFiles([])
      setLoading(false)
      return
    }

    const basePath = currentPath || workspace
    setLoading(true)
    try {
      const response = await fetch('/api/files/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: basePath }),
      })
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Failed to load files:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClick = (file: FileEntry) => {
    if (file.is_directory) {
      setCurrentPath(file.path)
    } else {
      setSelectedPath(file.path)
      onFileSelect?.(file.path)
    }
  }

  // Check if we're in a subdirectory (not at workspace root)
  const isInSubdirectory = currentPath !== null && currentPath !== workspace

  // Navigate up one directory level
  const navigateUp = () => {
    if (!currentPath) return
    const parentPath = currentPath.split('/').slice(0, -1).join('/')
    // If parent is the workspace or above, go to workspace root
    if (!parentPath || parentPath === workspace || !parentPath.startsWith(workspace || '')) {
      setCurrentPath(null)
    } else {
      setCurrentPath(parentPath)
    }
  }

  if (!workspace) {
    return <div className="file-tree empty">Select a workspace to view files</div>
  }

  if (loading) {
    return <div className="file-tree loading">Loading...</div>
  }

  return (
    <div className="file-tree">
      <ul className="file-list">
        {isInSubdirectory && (
          <li
            className="file-item directory"
            onClick={navigateUp}
          >
            <span className="file-icon">📁</span>
            <span className="file-name">..</span>
          </li>
        )}
        {files.map((file) => (
          <li
            key={file.path}
            className={`file-item ${file.is_directory ? 'directory' : 'file'} ${selectedPath === file.path ? 'selected' : ''}`}
            onClick={() => handleClick(file)}
          >
            <span className="file-icon">{file.is_directory ? '📁' : '📄'}</span>
            <span className="file-name">{file.name}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
