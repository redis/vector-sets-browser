import { ReactNode } from "react"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { ProgressBar } from "./ProgressBar"
import { DragOverlay } from "./DragOverlay"
import { EmptyDropZoneContent } from "./EmptyDropZoneContent"
import { useDropZone } from "../../../hooks/useDropZone"
import { getElementIdFromText } from "../../../utils/vectorProcessing"

export interface DropZoneProps {
    children?: ReactNode
    onAddVector?: (element: string, embedding: number[]) => Promise<void>
    metadata?: VectorSetMetadata | null
    renderDropOverlay?: (isDragging: boolean) => ReactNode
    className?: string
    showProgressBar?: boolean
    containerStyle?: "empty" | "overlay"
}

// Re-export for backward compatibility
export { getElementIdFromText }

export default function DropZone({
    children,
    onAddVector,
    metadata,
    renderDropOverlay,
    className = "",
    showProgressBar = true,
    containerStyle = "overlay",
}: DropZoneProps) {
    const {
        isDragging,
        isProcessing,
        processedCount,
        totalItems,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop
    } = useDropZone({ onAddVector, metadata })

    // If using the empty container style
    if (containerStyle === "empty") {
        return (
            <div
                className={`w-full max-w-4xl p-2 border-1 border-dashed rounded-lg flex flex-col items-center justify-center
                  ${isDragging ? "bg-blue-50 border-blue-300" : "border-gray-300 hover:bg-gray-50"} 
                  ${className}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {children || <EmptyDropZoneContent isDragging={isDragging} />}

                {isProcessing && showProgressBar && (
                    <ProgressBar 
                        processedCount={processedCount} 
                        totalItems={totalItems} 
                    />
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
            <DragOverlay 
                isDragging={isDragging} 
                renderCustomOverlay={renderDropOverlay} 
            />

            {isProcessing && showProgressBar && (
                <ProgressBar 
                    processedCount={processedCount} 
                    totalItems={totalItems} 
                    variant="compact" 
                />
            )}

            {children}
        </div>
    )
}
