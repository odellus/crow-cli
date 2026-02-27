import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { Terminal } from './Terminal'
import './TabbedTerminal.css'

interface TerminalTab {
  id: string
  name: string
}

export function TabbedTerminal() {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-1', name: 'bash' }
  ])
  const [activeTab, setActiveTab] = useState('term-1')

  const addTab = useCallback(() => {
    const newId = `term-${Date.now()}`
    setTabs(prev => [...prev, { id: newId, name: 'bash' }])
    setActiveTab(newId)
  }, [])

  const closeTab = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id)
      if (newTabs.length === 0) {
        // Always keep at least one tab
        return [{ id: 'term-1', name: 'bash' }]
      }
      // If we closed the active tab, switch to another
      if (activeTab === id) {
        const idx = prev.findIndex(t => t.id === id)
        const newActiveIdx = idx > 0 ? idx - 1 : 0
        setActiveTab(newTabs[newActiveIdx]?.id || newTabs[0].id)
      }
      return newTabs
    })
  }, [activeTab])

  return (
    <div className="tabbed-terminal">
      <div className="terminal-tabs">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`terminal-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-name">{tab.name}</span>
            {tabs.length > 1 && (
              <button
                className="tab-close"
                onClick={(e) => closeTab(tab.id, e)}
                title="Close terminal"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={addTab} title="New terminal">
          <Plus size={14} />
        </button>
      </div>
      <div className="terminal-content">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`terminal-pane ${activeTab === tab.id ? 'active' : ''}`}
          >
            <Terminal />
          </div>
        ))}
      </div>
    </div>
  )
}
