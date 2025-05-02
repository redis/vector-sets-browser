"use client"

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from '@/components/ui/code-block';

export default function DocsPage() {
    const [markdownContent, setMarkdownContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        // Fetch the markdown file content
        setIsLoading(true);
        fetch('/docs/readme.md')
            .then(response => response.text())
            .then(text => {
                setMarkdownContent(text);
                setIsLoading(false);
            })
            .catch(error => {
                console.error('Error loading documentation:', error);
                setIsLoading(false);
            });
    }, []);

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {isLoading ? (
                <div className="flex justify-center items-center min-h-[50vh]">
                    <div className="animate-pulse">
                        <div className="h-8 w-64 bg-gray-200 rounded mb-6"></div>
                        <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                        <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                        <div className="h-4 w-3/4 bg-gray-200 rounded mb-8"></div>
                        <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
                        <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                        <div className="h-4 w-full bg-gray-200 rounded mb-3"></div>
                    </div>
                </div>
            ) : (
                <article className="prose prose-slate lg:prose-lg dark:prose-invert max-w-none">
                    <ReactMarkdown
                        components={{
                            code({ className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '');
                                const isInline = !match && (children as string).split('\n').length === 1;
                                
                                if (isInline) {
                                    return <code className="px-1 py-0.5 bg-gray-100 rounded text-gray-800 text-sm" {...props}>{children}</code>;
                                }
                                
                                return match ? (
                                    <CodeBlock
                                        code={String(children).replace(/\n$/, '')}
                                        language={match[1]}
                                    />
                                ) : (
                                    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto">
                                        <code className="text-sm" {...props}>{children}</code>
                                    </pre>
                                );
                            },
                            // Enhanced styling for other elements
                            h1: ({ children }: any) => <h1 className="text-3xl font-bold mb-6">{children}</h1>,
                            h2: ({ children }: any) => <h2 className="text-2xl font-semibold mb-4 mt-8">{children}</h2>,
                            h3: ({ children }: any) => <h3 className="text-xl font-medium mb-3 mt-6">{children}</h3>,
                            pre: ({ children }: any) => <div className="not-prose">{children}</div>,
                        }}
                    >
                        {markdownContent}
                    </ReactMarkdown>
                </article>
            )}
        </div>
    );
}
