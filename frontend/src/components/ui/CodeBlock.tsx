import { useState } from 'react'
import { cx, downloadText } from '../../lib/utils'
import { CheckIcon, CopyIcon, DownloadIcon } from './icons'
import { IconButton } from './Button'

export type CodeLanguage = 'sql' | 'python' | 'json'

interface Token {
  text: string
  cls: string
}

// Minimal tokenizer for legible highlighting without a heavy dependency.
function tokenize(code: string, lang: CodeLanguage): Token[] {
  const tokens: Token[] = []
  const keywords =
    lang === 'sql'
      ? new Set([
          'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'AS', 'SUM', 'COUNT', 'AVG',
          'MIN', 'MAX', 'JOIN', 'ON', 'AND', 'OR', 'LIMIT', 'HAVING', 'WITH', 'NULL', 'ASC',
          'DESC', 'ROUND', 'CAST', 'DISTINCT',
        ])
      : lang === 'python'
        ? new Set([
            'def', 'return', 'if', 'else', 'for', 'in', 'import', 'from', 'lambda', 'and',
            'or', 'not', 'None', 'True', 'False',
          ])
        : new Set()

  const regex = /[\w_.$]+|'[^']*'|"[^"]*"|\d+(?:\.\d+)?|==|!=|<=|>=|&&|\|\||[^\w\s]/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(code)) !== null) {
    if (match.index > last) {
      tokens.push({ text: code.slice(last, match.index), cls: '' })
    }
    const tok = match[0]
    const upper = tok.toUpperCase()
    let cls = ''
    if (lang === 'python' && (tok === 'result' || tok.startsWith('df'))) cls = 'text-periwinkle'
    else if (lang === 'sql' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
      const isTableOrColumn = !keywords.has(upper)
      cls = isTableOrColumn ? 'text-periwinkle' : 'text-orchid'
    } else if (/^['"]/.test(tok)) cls = 'text-leaf'
    else if (/^\d/.test(tok)) cls = 'text-ember'
    else if (/^[A-Za-z]/.test(tok)) cls = 'text-ink/90'
    tokens.push({ text: tok, cls })
    last = regex.lastIndex
  }
  if (last < code.length) tokens.push({ text: code.slice(last), cls: '' })
  return tokens
}

export function CodeBlock({
  code,
  language = 'sql',
  title,
  maxHeight,
}: {
  code: string
  language?: CodeLanguage
  title?: string
  maxHeight?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const download = () =>
    downloadText(`${title ?? 'code'}.${language === 'python' ? 'py' : language}`, code)

  return (
    <div className="overflow-hidden rounded-input border border-line bg-ink text-left font-mono text-xs">
      <div className="flex items-center justify-between border-b border-canvas/10 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-canvas/60">
          {title ?? language}
        </span>
        <div className="flex items-center gap-0.5">
          <IconButton
            aria-label="Download code"
            onClick={download}
            className="h-6 w-6 text-canvas/70 hover:bg-canvas/10 hover:text-canvas"
          >
            <DownloadIcon size={14} />
          </IconButton>
          <button
            onClick={copy}
            className={cx(
              'inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
              copied
                ? 'bg-leaf/20 text-leaf'
                : 'text-canvas/70 hover:bg-canvas/10 hover:text-canvas',
            )}
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre
        className="scrollbar-thin overflow-auto p-3 leading-relaxed text-canvas/90"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <code>
          {tokenize(code, language).map((t, i) => (
            <span key={i} className={t.cls || undefined}>
              {t.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}
