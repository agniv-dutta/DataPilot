import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ content }: { content: string }) {
  return (
    <div className="prose-prose text-sm leading-relaxed text-navy">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-navy">{children}</strong>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>,
          li: ({ children }) => <li>{children}</li>,
          code: (props) => <InlineCode {...props} />,
          h1: ({ children }) => <h1 className="mb-2 text-lg font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-base font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 text-sm font-bold">{children}</h3>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-input border border-borderline">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-borderline bg-app px-2 py-1 text-left font-semibold text-muted">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-borderline px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function InlineCode({ children, className }: { children?: React.ReactNode; className?: string }) {
  const isBlock = className?.includes('language-')
  if (isBlock) {
    return (
      <pre className="my-2 overflow-x-auto rounded-input bg-navy-900 p-3 font-mono text-xs text-blue-50">
        <code>{children}</code>
      </pre>
    )
  }
  return (
    <code className="rounded bg-primary-50 px-1 py-0.5 font-mono text-[0.85em] text-primary-700">
      {children}
    </code>
  )
}