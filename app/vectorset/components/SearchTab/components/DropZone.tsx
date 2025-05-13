import { ReactNode, useEffect, useRef, useCallback } from "react"
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
    onDragStateChange?: (isDragging: boolean) => void
    "data-dropzone-id"?: string
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
    onDragStateChange,
    "data-dropzone-id": dropzoneId,
}: DropZoneProps) {
    const {
        isDragging,
        isProcessing,
        processedCount,
        totalItems,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        setIsDragging
    } = useDropZone({ onAddVector, metadata })

    // Ref to track the dropzone element
    const dropzoneRef = useRef<HTMLDivElement>(null);

    // Use useEffect to call onDragStateChange when isDragging changes
    useEffect(() => {
        if (onDragStateChange) {
            onDragStateChange(isDragging);
        }
    }, [isDragging, onDragStateChange]);

    // More reliable mouse leave detection
    const handleMouseLeave = useCallback((e: React.MouseEvent) => {
        if (isDragging) {
            // Check if the mouse is truly leaving the element and not just entering a child
            if (e.currentTarget === e.target) {
                // Get the mouse position
                const { clientX, clientY } = e;
                const rect = dropzoneRef.current?.getBoundingClientRect();
                
                if (rect) {
                    // Only set isDragging to false if the cursor is actually outside the dropzone
                    const isOutsideX = clientX < rect.left || clientX > rect.right;
                    const isOutsideY = clientY < rect.top || clientY > rect.bottom;
                    
                    if (isOutsideX || isOutsideY) {
                        setIsDragging(false);
                    }
                }
            }
        }
    }, [isDragging, setIsDragging]);

    // If using the empty container style
    if (containerStyle === "empty") {
        return (
            <div
                ref={dropzoneRef}
                className={`w-full max-w-4xl p-2 border-1 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors duration-200
                  ${isDragging ? "bg-blue-100 border-blue-300" : "border-gray-300 hover:bg-blue-100"} 
                  ${className}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onMouseLeave={handleMouseLeave}
                data-dropzone-id={dropzoneId}
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
            ref={dropzoneRef}
            className={`relative ${className}`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseLeave={handleMouseLeave}
            data-dropzone-id={dropzoneId}
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
