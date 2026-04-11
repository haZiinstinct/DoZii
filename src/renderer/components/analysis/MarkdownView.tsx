import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewProps {
  content: string
  className?: string
}

/**
 * Styled wrapper around ReactMarkdown. Matches the DoZii brand:
 * cyan headings, dark code blocks, borderless tables, proper spacing.
 */
export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  return (
    <div
      className={`markdown-view text-sm leading-relaxed text-brand-text ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 text-2xl font-bold text-brand-text-bright first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-6 text-lg font-semibold uppercase tracking-wider text-brand-cyan first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-base font-semibold text-brand-text-bright first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-4 text-sm font-semibold text-brand-text-bright">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed text-brand-text">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-brand-text-bright">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-brand-text">{children}</em>,
          ul: ({ children }) => (
            <ul className="mb-3 ml-5 list-disc space-y-1 text-brand-text">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-5 list-decimal space-y-1 text-brand-text">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-brand-cyan/40 bg-brand-card/40 px-4 py-2 italic text-brand-text-dim">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClass }) => {
            const isBlock = codeClass?.startsWith('language-')
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg border border-brand-border bg-brand-darker p-3 font-mono text-xs text-brand-text">
                  {children}
                </code>
              )
            }
            return (
              <code className="rounded bg-brand-card px-1.5 py-0.5 font-mono text-xs text-brand-cyan">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-xl border border-brand-border bg-brand-darker p-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-brand-border">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-brand-card/60">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-brand-border px-3 py-2 text-left font-semibold text-brand-text-bright">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-brand-border/50 px-3 py-2 text-brand-text">
              {children}
            </td>
          ),
          hr: () => <hr className="my-4 border-brand-border" />,
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-brand-cyan underline hover:text-brand-cyan-dim"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
