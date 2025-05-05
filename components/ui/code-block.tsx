import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { cn } from '@/lib/ui/styles';

interface CodeBlockProps {
  code: string;
  language: string;
  title?: string;
  className?: string;
}

export function CodeBlock({ code, language, title, className }: CodeBlockProps) {
  // Map language identifiers to supported languages
  const languageMap: Record<string, string> = {
    'php': 'php',
    'javascript': 'javascript',
    'js': 'javascript',
    'c': 'c',
    'cpp': 'cpp',
    'python': 'python',
    'py': 'python',
    'java': 'java',
    'ruby': 'ruby',
    'go': 'go',
    'rust': 'rust',
    'csharp': 'csharp',
    'cs': 'csharp',
    'typescript': 'typescript',
    'ts': 'typescript',
  };

  // Use the mapped language or fallback to the original
  const syntaxLanguage = languageMap[language.toLowerCase()] || language;

  return (
    <div className={cn("rounded-md overflow-hidden", className)}>
      {title && (
        <div className="bg-muted/80 px-4 py-2 text-sm font-medium border-b border-border">
          {title}
        </div>
      )}
      <SyntaxHighlighter
        language={syntaxLanguage}
        style={dracula}
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
          lineHeight: 1.5,
        }}
        showLineNumbers
        wrapLines
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
} 