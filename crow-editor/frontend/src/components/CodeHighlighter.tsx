import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { oneDark } from '@codemirror/theme-one-dark'
import { Extension } from '@codemirror/state'

// Map file extensions to CodeMirror language extensions
function getLanguageExtension(filename: string | null): Extension[] {
  if (!filename) return []

  const basename = filename.split('/').pop()?.toLowerCase() || ''
  const ext = basename.split('.').pop()?.toLowerCase() || ''

  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return [javascript({ jsx: true })]
    case 'ts':
    case 'tsx':
      return [javascript({ jsx: true, typescript: true })]
    case 'py':
    case 'pyi':
    case 'pyw':
      return [python()]
    case 'json':
      return [json()]
    case 'md':
    case 'markdown':
      return [markdown()]
    case 'html':
    case 'htm':
    case 'svg':
    case 'xml':
      return [html()]
    case 'css':
    case 'scss':
    case 'less':
      return [css()]
    default:
      return []
  }
}

interface CodeHighlighterProps {
  code: string
  filename: string | null
  showLineNumbers?: boolean
  onChange?: (value: string) => void
  readOnly?: boolean
}

export function CodeHighlighter({
  code,
  filename,
  showLineNumbers = true,
  onChange,
  readOnly = false
}: CodeHighlighterProps) {
  const extensions = getLanguageExtension(filename)

  return (
    <CodeMirror
      value={code}
      height="100%"
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: showLineNumbers,
        highlightActiveLineGutter: true,
        highlightSpecialChars: true,
        history: true,
        foldGutter: true,
        drawSelection: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        syntaxHighlighting: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        rectangularSelection: true,
        crosshairCursor: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        defaultKeymap: true,
        searchKeymap: true,
        historyKeymap: true,
        foldKeymap: true,
        completionKeymap: true,
        lintKeymap: true,
      }}
      style={{
        fontSize: '13px',
        height: '100%',
      }}
    />
  )
}
