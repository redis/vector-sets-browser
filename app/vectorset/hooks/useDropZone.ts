import { useState, useCallback, useRef, useEffect } from "react";
import { 
    processTextContent, 
    processImageFile, 
    isTextFile, 
    containsValidItems 
} from "../utils/vectorProcessing";
import { VectorSetMetadata } from "@/lib/types/vectors";
import { toast } from "sonner";

interface UseDropZoneOptions {
    onAddVector?: (element: string, embedding: number[]) => Promise<void>;
    metadata?: VectorSetMetadata | null;
}

interface UseDropZoneResult {
    isDragging: boolean;
    isProcessing: boolean;
    processedCount: number;
    totalItems: number;
    handleDragOver: (e: React.DragEvent) => void;
    handleDragEnter: (e: React.DragEvent) => void;
    handleDragLeave: (e: React.DragEvent) => void;
    handleDrop: (e: React.DragEvent) => void;
    setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useDropZone({
    onAddVector,
    metadata
}: UseDropZoneOptions): UseDropZoneResult {
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedCount, setProcessedCount] = useState(0);
    const [totalItems, setTotalItems] = useState(0);

    // Use a ref to track timeout for drag leave
    const dragLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Clean up the timeout on unmount
    useEffect(() => {
        // Set up global drag end event listener
        const handleGlobalDragEnd = () => {
            setIsDragging(false);
        };

        // Handle when user presses escape key
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDragging) {
                setIsDragging(false);
            }
        };

        // Handle when window loses focus
        const handleWindowBlur = () => {
            if (isDragging) {
                setIsDragging(false);
            }
        };

        // Add global event listeners
        document.addEventListener('dragend', handleGlobalDragEnd);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            // Clean up event listeners
            document.removeEventListener('dragend', handleGlobalDragEnd);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('blur', handleWindowBlur);

            if (dragLeaveTimeoutRef.current) {
                clearTimeout(dragLeaveTimeoutRef.current);
            }
            // Reset state on unmount
            setIsDragging(false);
        };
    }, [isDragging]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if the dragged items contain valid items
        if (containsValidItems(e.dataTransfer.items)) {
            setIsDragging(true);
        }
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any pending drag leave timeout
        if (dragLeaveTimeoutRef.current) {
            clearTimeout(dragLeaveTimeoutRef.current);
            dragLeaveTimeoutRef.current = null;
        }
        
        // Check if the dragged items contain valid items
        if (containsValidItems(e.dataTransfer.items)) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Only respond to drag leave events from the current target, not children
        if (e.currentTarget === e.target) {
            // Check if the mouse position is actually outside the element
            const rect = e.currentTarget.getBoundingClientRect();
            const { clientX, clientY } = e;
            
            // Only set isDragging to false if the cursor is actually outside the dropzone
            if (
                clientX < rect.left || 
                clientX > rect.right || 
                clientY < rect.top || 
                clientY > rect.bottom
            ) {
                // Clear existing timeout if any
                if (dragLeaveTimeoutRef.current) {
                    clearTimeout(dragLeaveTimeoutRef.current);
                }
                
                // Set a small delay before removing the dragging state to prevent flickering
                dragLeaveTimeoutRef.current = setTimeout(() => {
                    setIsDragging(false);
                }, 100);
            }
        }
    }, []);

    const handleDrop = useCallback(
        async (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Clear any pending drag leave timeout
            if (dragLeaveTimeoutRef.current) {
                clearTimeout(dragLeaveTimeoutRef.current);
                dragLeaveTimeoutRef.current = null;
            }
            
            setIsDragging(false);

            if (!onAddVector) {
                console.error("onAddVector function not provided");
                return;
            }

            if (!metadata?.embedding) {
                console.error("No embedding configuration in metadata");
                return;
            }

            // Check for processable items
            let hasProcessableItems = false;
            let itemsToProcess = 0;

            // Process text from clipboard if available
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];

                    if (item.kind === "string" && item.type === "text/plain") {
                        hasProcessableItems = true;
                        itemsToProcess++;
                    }
                }
            }

            // Process files (images and text files)
            const files = Array.from(e.dataTransfer.files);
            const imageFiles = files.filter((file) =>
                file.type.startsWith("image/")
            );
            const textFiles = files.filter(isTextFile);

            if (imageFiles.length > 0 || textFiles.length > 0) {
                hasProcessableItems = true;
                itemsToProcess += imageFiles.length + textFiles.length;
            }

            if (!hasProcessableItems) return;

            setIsProcessing(true);
            setTotalItems(itemsToProcess);
            setProcessedCount(0);

            // Process text from clipboard
            if (e.dataTransfer.items) {
                for (let i = 0; i < e.dataTransfer.items.length; i++) {
                    const item = e.dataTransfer.items[i];

                    if (item.kind === "string" && item.type === "text/plain") {
                        item.getAsString(async (text) => {
                            try {
                                await processTextContent(
                                    text,
                                    metadata,
                                    undefined,
                                    onAddVector
                                );
                            } catch (error) {
                                console.error("Error processing clipboard text:", error);
                                toast.error(
                                    error instanceof Error 
                                        ? error.message 
                                        : "Failed to process clipboard text"
                                );
                            } finally {
                                setProcessedCount((prev) => prev + 1);
                            }
                        });
                    }
                }
            }

            // Process each image with error handling for individual files
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                try {
                    await processImageFile(
                        file, 
                        metadata,
                        onAddVector,
                        (errorMessage) => {
                            toast.error(errorMessage);
                        }
                    );
                } catch (error) {
                    // Error already logged and reported by processImageFile
                    // Just continue with next file
                } finally {
                    setProcessedCount((prev) => prev + 1);
                }
            }

            // Process each text file with error handling for individual files
            for (let i = 0; i < textFiles.length; i++) {
                const file = textFiles[i];
                try {
                    const text = await file.text();
                    // For text files, preserve the file extension in the element ID
                    const elementId = file.name.replace(/[^a-zA-Z0-9\._]/g, "_");
                    await processTextContent(
                        text,
                        metadata,
                        elementId,
                        onAddVector
                    );
                } catch (error) {
                    console.error(`Error processing text file ${file.name}:`, error);
                    toast.error(
                        error instanceof Error 
                            ? error.message 
                            : `Failed to process file ${file.name}`
                    );
                } finally {
                    setProcessedCount((prev) => prev + 1);
                }
            }

            setIsProcessing(false);
        },
        [onAddVector, metadata]
    );

    return {
        isDragging,
        isProcessing,
        processedCount,
        totalItems,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        setIsDragging
    };
} 