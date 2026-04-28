// eslint-disable-next-line import/no-named-as-default
import Editor from '@monaco-editor/react';

import { cn } from '@/lib/cn';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  height?: string;
  className?: string;
}

export function MonacoEditor({
  value,
  language,
  onChange,
  height = '480px',
  className,
}: MonacoEditorProps) {
  return (
    <div
      className={cn('overflow-hidden rounded-md border bg-surface-inset', className)}
      data-testid="monaco-editor"
    >
      <Editor
        height={height}
        defaultLanguage={language}
        language={language}
        value={value}
        theme="vs-dark"
        onChange={(v) => onChange(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          fontSize: 13,
          tabSize: 2,
          padding: { top: 16, bottom: 16 },
          scrollBeyondLastLine: false,
          renderLineHighlight: 'line',
          smoothScrolling: true,
        }}
      />
    </div>
  );
}
