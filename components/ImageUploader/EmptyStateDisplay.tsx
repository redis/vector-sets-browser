interface EmptyStateDisplayProps {
    isLoading: boolean
    isProcessingEmbedding: boolean
    allowMultiple: boolean
}

export default function EmptyStateDisplay({
    isLoading,
    isProcessingEmbedding,
    allowMultiple
}: EmptyStateDisplayProps) {
    if (isLoading || isProcessingEmbedding) {
        return null
    }
    
    return (
        <>
            <div className="text-gray-500 mb-2 text-sm">
                {allowMultiple
                    ? "Drag and drop one or more images here, or click to select"
                    : "Drag and drop an image here, or click to select"}
            </div>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
            </svg>
        </>
    )
} 