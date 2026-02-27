/* Crow IDE Enhanced Markdown Renderer with KaTeX and Mermaid */
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import mermaid from "mermaid";
import "katex/dist/katex.min.css";

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    primaryColor: "#1f6feb",
    primaryTextColor: "#e6edf3",
    primaryBorderColor: "#30363d",
    lineColor: "#8b949e",
    secondaryColor: "#161b22",
    tertiaryColor: "#21262d",
    background: "#0d1117",
    mainBkg: "#161b22",
    nodeBorder: "#30363d",
    clusterBkg: "#21262d",
    titleColor: "#e6edf3",
    edgeLabelBackground: "#161b22",
  },
  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
});

interface MermaidBlockProps {
  code: string;
  isStreaming?: boolean;
}

/**
 * Check if mermaid code looks complete enough to attempt rendering.
 * Mermaid diagrams need at least a diagram type declaration (graph, flowchart, sequenceDiagram, etc.)
 */
function isMermaidCodeComplete(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;

  // Must have a diagram type declaration
  const diagramTypes = [
    'graph', 'flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram',
    'erDiagram', 'journey', 'gantt', 'pie', 'quadrantChart', 'requirementDiagram',
    'gitGraph', 'mindmap', 'timeline', 'zenuml', 'sankey', 'xychart', 'block'
  ];

  const firstWord = trimmed.split(/[\s\n]/)[0].toLowerCase();
  const hasDiagramType = diagramTypes.some(type =>
    firstWord === type.toLowerCase() || firstWord.startsWith(type.toLowerCase() + '-')
  );

  if (!hasDiagramType) return false;

  // Check for common incomplete patterns (mid-line cuts)
  const incompleteSuffixes = ['->', '-->', '---|', '-.', '==', ':::', '-->|'];
  if (incompleteSuffixes.some(suffix => trimmed.endsWith(suffix))) {
    return false;
  }

  // For flowchart/graph, check that we have actual content after the type declaration
  // A valid single-line flowchart looks like: "flowchart TD A --> B"
  // We just need to check there's something after the direction (TD, LR, etc.) or the type
  if (firstWord === 'flowchart' || firstWord === 'graph') {
    // Should have at least a node definition (contains brackets or has arrows)
    const hasContent = trimmed.includes('[') || trimmed.includes('-->') || trimmed.includes('---');
    return hasContent;
  }

  return true;
}

const MermaidBlock = memo<MermaidBlockProps>(({ code, isStreaming = false }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const lastRenderKeyRef = useRef<string>("");

  const isComplete = isMermaidCodeComplete(code);

  useEffect(() => {
    // Track both code AND streaming state to ensure we re-render when streaming completes
    const renderKey = `${code}-${isStreaming}`;
    if (renderKey === lastRenderKeyRef.current) return;
    lastRenderKeyRef.current = renderKey;

    const renderDiagram = async () => {
      if (!code.trim()) return;

      // CRITICAL: Never attempt to render while streaming - wait for closing ```
      // The isStreaming flag is true when hasUnclosedCodeBlock() detects odd ``` count,
      // meaning the markdown parser hasn't seen the closing fence yet.
      if (isStreaming) {
        return;
      }

      // Additional heuristic check for incomplete mermaid syntax
      if (!isComplete) {
        return;
      }

      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code.trim());
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error("Mermaid render error:", err);
        const errorMsg = err instanceof Error ? err.message : "Failed to render diagram";
        setError(errorMsg);
        setSvg("");
      }
    };

    // No debounce needed - we only render when streaming is complete
    renderDiagram();
  }, [code, isComplete, isStreaming]);

  // Show streaming indicator while streaming or for incomplete code
  if (isStreaming || !isComplete) {
    return (
      <div className="border border-blue-700/50 bg-blue-900/20 rounded p-3 my-2">
        <div className="flex items-center gap-2 text-xs text-blue-400 mb-2">
          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <span>Rendering diagram...</span>
        </div>
        <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">{code}</pre>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-700 bg-red-900/20 rounded p-3 my-2">
        <div className="text-xs text-red-400 mb-1 font-medium">Mermaid Error:</div>
        <pre className="text-xs text-red-300 whitespace-pre-wrap mb-2">{error}</pre>
        <details className="mt-2">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">Show code</summary>
          <pre className="text-xs text-gray-300 mt-1 whitespace-pre-wrap bg-gray-800 p-2 rounded">{code}</pre>
        </details>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="border border-gray-700 rounded p-3 my-2 animate-pulse">
        <div className="h-20 bg-gray-800 rounded"></div>
      </div>
    );
  }

  return (
    <div
      className="my-2 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});
MermaidBlock.displayName = "MermaidBlock";

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  isStreaming?: boolean;
}

const CodeBlock = ({ className, children, isStreaming = false }: CodeBlockProps) => {
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "";
  const code = String(children).replace(/\n$/, "");

  // Handle mermaid code blocks
  if (language === "mermaid") {
    return <MermaidBlock code={code} isStreaming={isStreaming} />;
  }

  // Regular code block
  return (
    <pre className="bg-gray-800 border border-gray-700 rounded p-3 overflow-x-auto">
      <code className={className}>{children}</code>
    </pre>
  );
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

/**
 * Detect if markdown content has unclosed code blocks (streaming in progress)
 */
function hasUnclosedCodeBlock(content: string): boolean {
  const codeBlockPattern = /```/g;
  const matches = content.match(codeBlockPattern);
  // Odd number of ``` means unclosed block
  return matches ? matches.length % 2 !== 0 : false;
}

/**
 * Detect if content has unclosed LaTeX blocks
 */
function hasUnclosedLatex(content: string): boolean {
  // Check for unclosed $$ blocks
  const displayMathMatches = content.match(/\$\$/g);
  if (displayMathMatches && displayMathMatches.length % 2 !== 0) return true;

  // Check for unclosed \[ \] blocks
  const bracketOpen = (content.match(/\\\[/g) || []).length;
  const bracketClose = (content.match(/\\\]/g) || []).length;
  if (bracketOpen !== bracketClose) return true;

  return false;
}

export const MarkdownRenderer = memo<MarkdownRendererProps>(({ content, className, isStreaming: isStreamingProp }) => {
  // Auto-detect streaming if not explicitly provided, but prefer explicit prop
  const isStreaming = isStreamingProp ?? (hasUnclosedCodeBlock(content) || hasUnclosedLatex(content));

  return (
    <div className={`prose prose-sm max-w-none prose-invert ${className || ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Custom code block handler for mermaid
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-gray-700 px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className} isStreaming={isStreaming}>{children}</CodeBlock>;
          },
          // Style pre blocks
          pre: ({ children }) => <>{children}</>,
          // Style links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              {children}
            </a>
          ),
          // Style tables
          table: ({ children }) => (
            <table className="border-collapse border border-gray-700 my-2">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border border-gray-700 bg-gray-800 px-3 py-1 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-700 px-3 py-1">{children}</td>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-500 pl-4 my-2 text-gray-300 italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
MarkdownRenderer.displayName = "MarkdownRenderer";

export default MarkdownRenderer;
