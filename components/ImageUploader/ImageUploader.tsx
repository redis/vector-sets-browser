import { useCallback, useEffect, useState } from "react"
import { ImageUploaderProps, ImageFileInfo } from "./types"
import ImageDropZone from "./ImageDropZone"
import ImagePreview from "./ImagePreview"
import MultipleImagesGrid from "./MultipleImagesGrid"
import EmptyStateDisplay from "./EmptyStateDisplay"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"
import { fileToBase64 } from "@/lib/embeddings/client/imageProcessingService"

export default function ImageUploader({
    onImageSelect,
    onEmbeddingGenerated,
    onFileNameSelect,
    onImagesChange,
    config = {
        provider: "clip",
        clip: {
            model: "clip-vit-base-patch32",
        },
    },
    className = "",
    allowMultiple = false,
    context = 'default',
}: ImageUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isProcessingEmbedding, setIsProcessingEmbedding] = useState(false)
    const [imageData, setImageData] = useState<string | null>(null)
    const [imageFiles, setImageFiles] = useState<ImageFileInfo[]>([])
    const [isCompact, setIsCompact] = useState(false)

    // Animate to compact mode after 2.5 seconds when in search context
    useEffect(() => {
        // Reset compact mode immediately when preview is available
        if (previewUrl || context !== 'search') {
            setIsCompact(false)
            return
        }
        
        // Set a timer to activate compact mode
        const timer = setTimeout(() => {
            setIsCompact(true)
        }, 2500)
        
        return () => clearTimeout(timer)
    }, [context, previewUrl, imageFiles])

    // Notify parent when images change
    useEffect(() => {
        if (onImagesChange && allowMultiple) {
            onImagesChange(imageFiles)
        }
    }, [imageFiles, onImagesChange, allowMultiple])

    // Memoize processFile to avoid recreating this function on every render
    const processFile = useCallback(async (file: File) => {
        try {
            setIsLoading(true)

            // Create preview URL
            const objectUrl = URL.createObjectURL(file)
            setPreviewUrl(objectUrl)

            // Convert to base64
            const base64Data = await fileToBase64(file)
            setImageData(base64Data)
            onImageSelect(base64Data)

            // Create a single-image collection for consistency
            if (allowMultiple) {
                const imageInfo: ImageFileInfo = {
                    id: `img_${Date.now()}`,
                    fileName: file.name,
                    previewUrl: objectUrl,
                    base64Data: base64Data,
                }
                setImageFiles([imageInfo])
            }

            // Provide the file name if the callback exists
            if (onFileNameSelect) {
                onFileNameSelect(file.name)
            }

            // Generate embedding if handler is provided
            if (onEmbeddingGenerated) {
                setIsProcessingEmbedding(true)

                try {
                    const embedding = await clientEmbeddingService.getEmbedding(base64Data, config, true)
                    onEmbeddingGenerated(embedding)

                    // Update the image info with embedding if in multiple mode
                    if (allowMultiple) {
                        setImageFiles((prev) =>
                            prev.map((img) =>
                                img.id === `img_${Date.now()}`
                                    ? { ...img, embedding }
                                    : img
                            )
                        )
                    }
                } catch (error) {
                    console.error("Error generating embedding:", error)
                } finally {
                    setIsProcessingEmbedding(false)
                }
            }
        } catch (error) {
            console.error(`Error processing image ${file.name}:`, error)
        } finally {
            setIsLoading(false)
        }
    }, [allowMultiple, config, onEmbeddingGenerated, onFileNameSelect, onImageSelect])

    // Memoize processMultipleFiles to avoid recreating this function on every render
    const processMultipleFiles = useCallback(async (files: File[]) => {
        const newImages: ImageFileInfo[] = []

        for (let i = 0; i < files.length; i++) {
            const file = files[i]

            try {
                // Convert to base64
                const base64Data = await fileToBase64(file)

                // Create preview URL
                const objectUrl = URL.createObjectURL(file)

                // Add to our collection
                const imageInfo: ImageFileInfo = {
                    id: `img_${Date.now()}_${i}`,
                    fileName: file.name,
                    previewUrl: objectUrl,
                    base64Data: base64Data,
                }

                newImages.push(imageInfo)

                // Generate embedding if needed
                if (onEmbeddingGenerated) {
                    setIsProcessingEmbedding(true)

                    try {
                        const embedding = await clientEmbeddingService.getEmbedding(base64Data, config, true)
                        // Update the image info with embedding
                        imageInfo.embedding = embedding
                    } catch (error) {
                        console.error("Error generating embedding:", error)
                    } finally {
                        setIsProcessingEmbedding(false)
                    }
                }
            } catch (error) {
                console.error(`Error processing image ${file.name}:`, error)
            }
        }

        // Update our imageFiles state
        setImageFiles((prev) => [...prev, ...newImages])

        // For single-image compatibility, update the main preview with the last image
        if (newImages.length > 0) {
            const lastImage = newImages[newImages.length - 1]
            setPreviewUrl(lastImage.previewUrl)
            setImageData(lastImage.base64Data)

            // Call the legacy callbacks for compatibility
            onImageSelect(lastImage.base64Data)
            if (onFileNameSelect) {
                onFileNameSelect(lastImage.fileName)
            }
            if (onEmbeddingGenerated && lastImage.embedding) {
                onEmbeddingGenerated(lastImage.embedding)
            }
        }
    }, [config, onEmbeddingGenerated, onFileNameSelect, onImageSelect])

    // Memoize handleFileSelect to avoid recreating this function on every render
    const handleFileSelect = useCallback(async (files: File[]) => {
        if (files.length === 0) return

        // Filter out non-image files
        const imageFiles = files.filter((file) => file.type.startsWith("image/"))
        if (imageFiles.length === 0) return

        if (allowMultiple) {
            processMultipleFiles(imageFiles)
        } else {
            processFile(imageFiles[0])
        }
    }, [allowMultiple, processFile, processMultipleFiles])

    // Remove an image from the list
    const removeImage = useCallback((id: string) => {
        setImageFiles((prev) => {
            const filtered = prev.filter((img) => img.id !== id)

            // If we removed all images, clear the preview
            if (filtered.length === 0) {
                setPreviewUrl(null)
                setImageData(null)
                onImageSelect("")
            }
            // Otherwise, set the preview to the last image
            else if (prev.length !== filtered.length) {
                const lastImage = filtered[filtered.length - 1]
                setPreviewUrl(lastImage.previewUrl)
                setImageData(lastImage.base64Data)
                onImageSelect(lastImage.base64Data)

                if (onFileNameSelect) {
                    onFileNameSelect(lastImage.fileName)
                }

                if (onEmbeddingGenerated && lastImage.embedding) {
                    onEmbeddingGenerated(lastImage.embedding)
                }
            }

            return filtered
        })
    }, [onEmbeddingGenerated, onFileNameSelect, onImageSelect])

    // Clear the single image in the preview
    const clearPreviewImage = useCallback(() => {
        // Revoke object URL to prevent memory leaks
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        
        // Reset state
        setPreviewUrl(null)
        setImageData(null)
        
        // Notify parent components
        onImageSelect("")
        
        // Clear any embedding that might have been generated
        if (onEmbeddingGenerated) {
            onEmbeddingGenerated([])
        }
        
        // Clear the file name if needed
        if (onFileNameSelect) {
            onFileNameSelect("")
        }
        
        // Clear image files when in multiple mode
        if (allowMultiple) {
            setImageFiles([])
        }
    }, [allowMultiple, onEmbeddingGenerated, onFileNameSelect, onImageSelect, previewUrl])

    // Render appropriate content based on state
    const renderContent = useCallback(() => {
        if (allowMultiple && imageFiles.length > 0) {
            return (
                <MultipleImagesGrid
                    images={imageFiles}
                    onRemoveImage={removeImage}
                />
            )
        } else if (previewUrl) {
            return (
                <ImagePreview
                    src={previewUrl}
                    alt="Preview"
                    onRemove={clearPreviewImage}
                />
            )
        } else {
            return (
                <EmptyStateDisplay
                    isLoading={isLoading}
                    isProcessingEmbedding={isProcessingEmbedding}
                    allowMultiple={allowMultiple}
                    context={context}
                    isCompact={isCompact}
                />
            )
        }
    }, [allowMultiple, clearPreviewImage, imageFiles, isLoading, isProcessingEmbedding, previewUrl, removeImage, context, isCompact])

    return (
        <div className={`flex items-center gap-2 w-full ${className}`}>
            <ImageDropZone
                onFileSelect={handleFileSelect}
                isLoading={isLoading}
                isProcessingEmbedding={isProcessingEmbedding}
                previewUrl={previewUrl}
                allowMultiple={allowMultiple}
                isCompact={isCompact}
            >
                {renderContent()}
            </ImageDropZone>
        </div>
    )
} 