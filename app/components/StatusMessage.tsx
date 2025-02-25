interface StatusMessageProps {
    message: string
}

export default function StatusMessage({ message }: StatusMessageProps) {
    if (!message) return null

    return (
        <div className="text-sm text-black whitespace-nowrap overflow-hidden">
            {message}
        </div>
    )
} 