import { useState } from 'react'
import { cx, downloadText } from '../../lib/utils'

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
      ? new Set(['SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'AS', 'SUM', 'COUNT', 'AVG', 'MIN', 'MAX', 'JOIN', 'ON', 'AND', 'OR', 'LIMIT', 'HAVING', 'WITH', 'NULL', 'ASC', 'DESC'])
      : lang === 'python'
        ? new Set(['def', 'return', 'if', 'else', 'for', 'in', 'import', 'from', 'lambda', 'and', 'or', 'not', 'None', 'True', 'False'])
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
    if (lang === 'python' && (tok === 'result' || tok.startsWith('df'))) cls = 'text-sky-600'
    else if (lang === 'sql' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
      const isTableOrColumn = !keywords.has(upper)
      cls = isTableOrColumn ? 'text-indigo-500' : 'text-purple-600'
    } else if (/^['"]/.test(tok)) cls = 'text-emerald-600'
    else if (/^\d/.test(tok)) cls = 'text-amber-600'
    else if (/^[A-Za-z]/.test(tok)) cls = 'text-blue-600'
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

  const download = () => downloadText(`${title ?? 'code'}.${language === 'python' ? 'py' : language}`, code)

  return (
    <div className="overflow-hidden rounded-input border border-borderline bg-navy-900 text-left font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-blue-200/70">
          {title ?? language}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={download}
            className="rounded px-2 py-0.5 text-[11px] text-blue-200/80 hover:bg-white/10"
          >
            ↓
          </button>
          <button
            onClick={copy}
            className={cx(
              'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
              copied ? 'bg-emerald-500/20 text-emerald-300' : 'text-blue-200/80 hover:bg-white/10',
            )}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre
        className="scrollbar-thin overflow-auto p-3 leading-relaxed text-blue-50"
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