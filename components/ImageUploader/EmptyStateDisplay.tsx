interface EmptyStateDisplayProps {
    isLoading: boolean
    isProcessingEmbedding: boolean
    allowMultiple: boolean
    context?: 'search' | 'add' | 'default' | 'embedded'
    isCompact?: boolean
}

export default function EmptyStateDisplay({
    isLoading,
    isProcessingEmbedding,
    allowMultiple,
    context = 'default',
    isCompact = false
}: EmptyStateDisplayProps) {
    if (isLoading || isProcessingEmbedding) {
        return null
    }
    
    const getMessage = () => {
        if (context === 'embedded') {
            return "Drop image"
        } else if (context === 'search') {
            return allowMultiple
                ? "Search for images: Drag one or more images here, or click to select"
                : "Drop image here, or click to select"
        } else if (context === 'add') {
            return allowMultiple
                ? "Add images: Drag one or more images here, or click to select"
                : "Add an image: Drag an image here, or click to select"
        } else {
            return allowMultiple
                ? "Drag and drop one or more images here, or click to select"
                : "Drag and drop an image here, or click to select"
        }
    }

    // For the embedded context, use a much more compact display
    if (context === 'embedded') {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-gray-400"
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
                <div className="text-gray-500 text-[10px] mt-1 text-center">
                    {getMessage()}
                </div>
            </div>
        )
    }
    
    return (
        <>
            <div className={`text-gray-500 transition-all duration-300 ${isCompact ? 'text-xs mb-0' : 'text-sm mb-2'} text-center`}>
                {getMessage()}
            </div>
            {!isCompact && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-gray-400 transition-all duration-300"
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
            )}
        </>
    )
} 