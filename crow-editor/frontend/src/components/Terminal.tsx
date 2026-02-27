import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import './Terminal.css'

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        // Shades of Purple theme
        background: '#1e1e3f',
        foreground: '#e6e6e6',
        cursor: '#fad000',
        cursorAccent: '#1e1e3f',
        selectionBackground: 'rgba(179, 98, 255, 0.3)',
        // Standard colors with purple tints
        black: '#000000',
        red: '#ff628c',
        green: '#a5ff90',
        yellow: '#fad000',
        blue: '#9effff',
        magenta: '#b362ff',
        cyan: '#80fcff',
        white: '#ffffff',
        brightBlack: '#7e74a8',
        brightRed: '#ff628c',
        brightGreen: '#a5ff90',
        brightYellow: '#ffea00',
        brightBlue: '#9effff',
        brightMagenta: '#ff9d00',
        brightCyan: '#80fcff',
        brightWhite: '#ffffff',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/terminal`)
    wsRef.current = ws

    ws.onopen = () => {
      terminal.writeln('Connected to terminal...')
      // Send resize info
      ws.send(JSON.stringify({
        type: 'resize',
        cols: terminal.cols,
        rows: terminal.rows,
      }))
    }

    ws.onmessage = (event) => {
      terminal.write(event.data)
    }

    ws.onerror = () => {
      terminal.writeln('\r\nWebSocket error')
    }

    ws.onclose = () => {
      terminal.writeln('\r\nDisconnected')
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'resize',
          cols: terminal.cols,
          rows: terminal.rows,
        }))
      }
    }

    window.addEventListener('resize', handleResize)

    // Use ResizeObserver to detect container size changes (e.g., from drag resize)
    const resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      ws.close()
      terminal.dispose()
    }
  }, [])

  return <div ref={containerRef} className="terminal-container" />
}
