import { useState, useCallback, ReactNode, useRef, useEffect } from "react"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"
import { fileToBase64 } from "@/lib/embeddings/client/imageProcessingService"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { UploadCloud } from "lucide-react"

export interface DropZoneProps {
    children?: ReactNode
    onAddVector?: (element: string, embedding: number[]) => Promise<void>
    metadata?: VectorSetMetadata | null
    renderDropOverlay?: (isDragging: boolean) => ReactNode
    className?: string
    showProgressBar?: boolean
    containerStyle?: "empty" | "overlay"
}

// Helper function to get element ID from text content
export const getElementIdFromText = (text: string): string => {
    const words = text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
    if (words.length >= 2) {
        return `Text: ${words[0]} ${words[1]}`
    } else if (words.length === 1) {
        return `Text: ${words[0]}`
    } else {
        return `Text: unknown`
    }
}

export default function DropZone({
    children,
    onAddVector,
    metadata,
    renderDropOverlay,
    className = "",
    showProgressBar = true,
    containerStyle = "overlay",
}: DropZoneProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [processedCount, setProcessedCount] = useState(0)
    const [totalItems, setTotalItems] = useState(0)

    // Use a ref to track timeout for drag leave
    const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Process text content
    const processTextContent = async (
        text: string,
        fileName?: string
    ): Promise<void> => {
        if (!onAddVector) {
            console.error("onAddVector function not provided")
            return
        }

        try {
            // Use the embedding configuration from the vectorset metadata
            if (!metadata?.embedding) {
                console.error("No embedding configuration in metadata")
                return
            }

            const embedding = await clientEmbeddingService.getEmbedding(
                text,
                metadata.embedding
            )

            // Use either the file name or generate ID from text content
            const elementId = fileName ? fileName : getElementIdFromText(text)

            // Add the vector
            await onAddVector(elementId, embedding)
            setProcessedCount((prev) => prev + 1)
        } catch (error) {
            console.error(`Error processing text:`, error)
        }
    }

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        // Check if the dragged items contain image files, text files, or text data
        const containsValidItem = Array.from(e.dataTransfer.items).some(
            (item) =>
                (item.kind === "file" &&
                    (item.type.startsWith("image/") ||
                        item.type === "text/plain")) ||
                (item.kind === "string" && item.type === "text/plain")
        )

        if (containsValidItem) {
            setIsDragging(true)
        }
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Only respond to drag leave events from the current target, not children
        if (e.currentTarget === e.target) {
            // Clear existing timeout if any
            if (dragLeaveTimeoutRef.current) {
                clearTimeout(dragLeaveTimeoutRef.current);
            }
            
            // Set a small delay before removing the dragging state to prevent flickering
            dragLeaveTimeoutRef.current = setTimeout(() => {
                setIsDragging(false);
            }, 50);
        }
    }, [])

    // Clean up the timeout on unmount
    useEffect(() => {
        return () => {
            if (dragLeaveTimeoutRef.current) {
                clearTimeout(dragLeaveTimeoutRef.current);
            }
        };
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any pending drag leave timeout
        if (dragLeaveTimeoutRef.current) {
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
        }
        
        // Check if the dragged items contain image files, text files, or text data
        const containsValidItem = Array.from(e.dataTransfer.items).some(
            (item) =>
                (item.kind === "file" &&
                    (item.type.startsWith("image/") ||
                        item.type === "text/plain")) ||
                (item.kind === "string" && item.type === "text/plain")
        )

        if (containsValidItem) {
            setIsDragging(true)
        }
    }, [])

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            
            // Clear any pending drag leave timeout
            if (dragLeaveTimeoutRef.current) {
                clearTimeout(dragLeaveTimeoutRef.current);
                dragLeaveTimeoutRef.current = null;
            }
            
            setIsDragging(false)

            if (!onAddVector) {
                console.error("onAddVector function not provided")
                return
            }

            if (!metadata?.embedding) {
                console.error("No embedding configuration in metadata")
                return
            }

            // Check for clipboard text data
            let hasProcessableItems = false
            let itemsToProcess = 0

            // Process text from clipboard if available
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i]

                    if (item.kind === "string" && item.type === "text/plain") {
                        hasProcessableItems = true
                        itemsToProcess++
                    }
                }
            }

            // Process files (images and text files)
            const files = Array.from(e.dataTransfer.files)
            const imageFiles = files.filter((file) =>
                file.type.startsWith("image/")
            )

            // Enhanced text file detection
            const textMimeTypes = [
                "text/plain",
                "text/html",
                "text/css",
                "text/javascript",
                "text/csv",
                "text/markdown",
                "text/xml",
                "application/json",
                "application/xml",
                "application/javascript",
            ]

            const textExtensions = [
                ".txt",
                ".md",
                ".markdown",
                ".json",
                ".csv",
                ".xml",
                ".html",
                ".htm",
                ".css",
                ".js",
                ".ts",
                ".jsx",
                ".tsx",
                ".yaml",
                ".yml",
                ".toml",
                ".ini",
                ".cfg",
                ".conf",
                ".py",
                ".rb",
                ".java",
                ".c",
                ".cpp",
                ".h",
                ".cs",
                ".go",
                ".rs",
                ".php",
                ".sql",
                ".sh",
                ".bat",
                ".log",
            ]

            const isTextFile = (file: File): boolean => {
                // Check by MIME type
                if (textMimeTypes.includes(file.type)) {
                    return true
                }

                // Check by file extension
                const fileName = file.name.toLowerCase()
                return textExtensions.some((ext) => fileName.endsWith(ext))
            }

            const textFiles = files.filter(isTextFile)

            if (imageFiles.length > 0 || textFiles.length > 0) {
                hasProcessableItems = true
                itemsToProcess += imageFiles.length + textFiles.length
            }

            if (!hasProcessableItems) return

            setIsProcessing(true)
            setTotalItems(itemsToProcess)
            setProcessedCount(0)

            // Process text from clipboard
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i]

                    if (item.kind === "string" && item.type === "text/plain") {
                        item.getAsString(async (text) => {
                            await processTextContent(text)
                        })
                    }
                }
            }

            // Process each image
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i]
                try {
                    // Convert to base64
                    const base64Data = await fileToBase64(file)

                    // Generate embedding using CLIP
                    const config = {
                        provider: "clip" as const,
                        clip: {
                            model: "clip-vit-base-patch32",
                        },
                    }

                    const embedding = await clientEmbeddingService.getEmbedding(
                        base64Data,
                        config,
                        true
                    )

                    // Use the file name as the element ID (without extension)
                    const elementId = file.name
                        .replace(/\.[^/.]+$/, "")
                        .replace(/[^a-zA-Z0-9]/g, "_")

                    // Add the vector
                    await onAddVector(elementId, embedding)
                    setProcessedCount((prev) => prev + 1)
                } catch (error) {
                    console.error(`Error processing image ${file.name}:`, error)
                }
            }

            // Process each text file
            for (let i = 0; i < textFiles.length; i++) {
                const file = textFiles[i]
                try {
                    const text = await file.text()
                    // For text files, preserve the file extension in the element ID
                    const elementId = file.name.replace(/[^a-zA-Z0-9\._]/g, "_")
                    await processTextContent(text, elementId)
                } catch (error) {
                    console.error(
                        `Error processing text file ${file.name}:`,
                        error
                    )
                }
            }

            setIsProcessing(false)
        },
        [onAddVector, metadata]
    )

    // Empty container style with dropzone UI
    const emptyContainerContent = (
        <>
            {isDragging ? (
                <div className="flex flex-col items-center transition-all duration-200">
                    <div className="relative flex items-center justify-center mb-4">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div className="absolute -right-8">
                            <svg
                                className="h-6 w-6 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                        <div className="absolute -right-20 bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                                />
                            </svg>
                        </div>
                    </div>
                    <p className="text-lg font-medium text-blue-700">
                        Drop to create vector
                    </p>
                    <p className="text-sm text-blue-500 mt-1">
                        Files will be encoded into vectors
                    </p>
                </div>
            ) : (
                <>
                    <UploadCloud className="h-16 w-16 mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-2">
                        Drag and drop your data here (text or images)
                    </p>
                </>
            )}

            {isProcessing && showProgressBar && (
                <div className="mt-4 w-full max-w-md">
                    <div className="text-sm text-center mb-2">
                        Processing {processedCount} of {totalItems} items...
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                            className="bg-red-600 h-2.5 rounded-full"
                            style={{
                                width: `${
                                    (processedCount / totalItems) * 100
                                }%`,
                            }}
                        ></div>
                    </div>
                </div>
            )}
        </>
    )

    // Default drop overlay
    const defaultDropOverlay = (isDragging: boolean) => (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 z-10 transition-all duration-200">
            <div className="flex items-center justify-center w-full h-full p-4">
                <div className="relative flex flex-col items-center">
                    <div className="flex items-center justify-center mb-6">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div className="mx-4">
                            <svg
                                className="h-6 w-6 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="text-xl font-semibold text-blue-700 mb-2">
                        Drop files to create vectors
                    </div>
                    <div className="text-sm text-blue-500">
                        Files will be automatically encoded into vector embeddings
                    </div>
                </div>
            </div>
        </div>
    )

    // If using the empty container style
    if (containerStyle === "empty") {
        return (
            <div
                className={`w-full max-w-4xl p-2 border-1 border-dashed rounded-lg flex flex-col items-center justify-center
          ${
              isDragging
                  ? "bg-blue-50 border-blue-300"
                  : "border-gray-300 hover:bg-gray-50"
          } ${className}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {children || emptyContainerContent}

                {isProcessing && showProgressBar && (
                    <div className="mt-4 w-full max-w-md">
                        <div className="text-sm text-center mb-2">
                            Processing {processedCount} of {totalItems} items...
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-red-600 h-2.5 rounded-full"
                                style={{
                                    width: `${
                                        (processedCount / totalItems) * 100
                                    }%`,
                                }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Default overlay style
    return (
        <div
            className={`relative ${className}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging &&
                (renderDropOverlay
                    ? renderDropOverlay(isDragging)
                    : defaultDropOverlay(isDragging))}

            {isProcessing && showProgressBar && (
                <div className="absolute top-0 left-0 right-0 p-2 bg-white bg-opacity-95 z-10 border-b">
                    <div className="text-sm text-center mb-1">
                        Processing {processedCount} of {totalItems} items...
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div
                            className="bg-red-600 h-1.5 rounded-full"
                            style={{
                                width: `${
                                    (processedCount / totalItems) * 100
                                }%`,
                            }}
                        ></div>
                    </div>
                </div>
            )}

            {children}
        </div>
    )
}
