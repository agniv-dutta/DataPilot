import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-answer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-input border border-line">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-line bg-sunken px-2 py-1 text-left font-semibold text-muted">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-line px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function InlineCode({ children, className }: { children?: React.ReactNode; className?: string }) {
  const isBlock = className?.includes('language-')
  if (isBlock) {
    return (
      <pre className="my-2 overflow-x-auto rounded-input border border-line bg-ink p-3 font-mono text-xs text-canvas/90">
        <code>{children}</code>
      </pre>
    )
  }
  return (
    <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[0.85em] text-iris-active">
      {children}
    </code>
  )
}
