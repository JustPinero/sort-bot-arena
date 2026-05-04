import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

import { cn } from '@/lib/cn';

// Strict allowlist: block + inline tags we render. Everything else is dropped
// silently by rehype-sanitize. No raw HTML, no images, no links, no scripts.
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'code',
  'pre',
] as const;

// Strict allowlist on top of `defaultSchema`. We narrow `tagNames` (drop
// everything outside ALLOWED_TAGS) and `attributes` (only `code` keeps a
// `className` for syntax-highlighting hooks). We deliberately INHERIT
// `defaultSchema`'s clobber / ancestors / protocols / required hardening
// — those fields prevent name/id attribute-clobbering attacks (e.g.
// `<x id="cookie">` colliding with `document.cookie`). An earlier version
// of this schema explicitly emptied them; spreading defaults and not
// re-overriding is the fix.
const sanitizeSchema: typeof defaultSchema = {
  ...defaultSchema,
  tagNames: [...ALLOWED_TAGS],
  attributes: {
    code: [['className', /^language-./]],
  },
  strip: ['script', 'style'],
};

const components: Components = {
  h1: ({ node: _node, className, children, ...props }) => (
    <h1
      className={cn('font-display text-2xl uppercase tracking-wide text-text-primary', className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node: _node, className, children, ...props }) => (
    <h2
      className={cn(
        'mt-4 font-display text-xl uppercase tracking-wide text-text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ node: _node, className, children, ...props }) => (
    <h3
      className={cn(
        'mt-3 font-mono text-xs uppercase tracking-widest text-text-tertiary',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ node: _node, className, children, ...props }) => (
    <p className={cn('mt-2 text-base leading-relaxed text-text-secondary', className)} {...props}>
      {children}
    </p>
  ),
  ul: ({ node: _node, className, children, ...props }) => (
    <ul className={cn('mt-2 list-disc space-y-1 pl-5 text-text-secondary', className)} {...props}>
      {children}
    </ul>
  ),
  ol: ({ node: _node, className, children, ...props }) => (
    <ol
      className={cn('mt-2 list-decimal space-y-1 pl-5 text-text-secondary', className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ node: _node, className, children, ...props }) => (
    <li className={cn('leading-relaxed', className)} {...props}>
      {children}
    </li>
  ),
  strong: ({ node: _node, className, children, ...props }) => (
    <strong className={cn('font-semibold text-text-primary', className)} {...props}>
      {children}
    </strong>
  ),
  em: ({ node: _node, className, children, ...props }) => (
    <em className={cn('italic', className)} {...props}>
      {children}
    </em>
  ),
  code: ({ node: _node, className, children, ...props }) => (
    <code
      className={cn(
        'rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-sm text-text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ node: _node, className, children, ...props }) => (
    <pre
      className={cn(
        'mt-2 overflow-x-auto rounded-sm bg-surface-2 p-3 font-mono text-sm text-text-primary',
        className,
      )}
      {...props}
    >
      {children}
    </pre>
  ),
};

interface MarkdownContentProps {
  children: string;
  className?: string;
}

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={cn('text-text-secondary', className)}>
      <ReactMarkdown rehypePlugins={[[rehypeSanitize, sanitizeSchema]]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
