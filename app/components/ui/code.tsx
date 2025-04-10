import React from "react"

interface CodeProps {
    children: React.ReactNode
    className?: string
}

export function Code({ children, className }: CodeProps) {
    return (
        <code className={`font-mono text-sm ${className || ""}`}>
            {children}
        </code>
    )
} 