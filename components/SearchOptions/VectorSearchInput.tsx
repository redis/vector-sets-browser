import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"
import {
    getModelName,
    isTextEmbedding
} from "@/lib/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { ImageIcon, Shuffle, X } from "lucide-react"
import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import MiniVectorHeatmap from "../MiniVectorHeatmap"

export interface VectorSearchInputProps {
    // Display text (what user sees and types)
    displayText: string
    onDisplayTextChange: (text: string) => void
    
    // Generated embedding (called when embedding is ready)
    onEmbeddingGenerated?: (embedding: number[]) => void
    
    // Metadata for embedding generation
    metadata: VectorSetMetadata | null
    dim: number | null
    
    // Optional props to match SearchInput interface
    placeholder?: string
    disabled?: boolean
    className?: string
    searchType?: "Vector" | "Element" | "Multi-vector" // For compatibility
    lastTextEmbedding?: number[] // From useVectorSearch for single vector mode
}

/**
 * Unified Vector Search Input Component
 * 
 * This component matches the exact visual design and functionality of SearchInput
 * while providing unified behavior for both single and multi-vector modes
 */
export default function VectorSearchInput({
    displayText,
    onDisplayTextChange,
    onEmbeddingGenerated,
    metadata,
    dim,
    placeholder,
    disabled = false,
    className = "",
    searchType = "Vector",
    lastTextEmbedding
}: VectorSearchInputProps) {
    
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    // Keep track of whether we're using image or text for multimodal search
    const [activeSearchMode, setActiveSearchMode] = useState<"text" | "image">("text")

    // Track whether an image is selected for visual feedback
    const [hasImage, setHasImage] = useState<boolean>(false)

    // Keep the preview URL for the selected image
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

    // Track hover state when dragging over the drop area
    const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false)
    
    // Store the current vector (for visualization)
    const [currentVector, setCurrentVector] = useState<number[] | null>(null)
    
    // Add debouncing for text embedding generation
    const textEmbeddingTimerRef = useRef<NodeJS.Timeout | null>(null)

    // Update current vector when lastTextEmbedding changes (for single vector mode)
    useEffect(() => {        
        if (lastTextEmbedding && lastTextEmbedding.length > 0) {
            setCurrentVector(lastTextEmbedding)
        }
    }, [lastTextEmbedding])
    
    // Function to generate text embedding with debouncing
    const generateTextEmbedding = useCallback(async (text: string) => {
        if (!metadata?.embedding || metadata.embedding.provider === "none") {
            return
        }
        
        // Clear existing timer
        if (textEmbeddingTimerRef.current) {
            clearTimeout(textEmbeddingTimerRef.current)
        }
        
        // Set new timer for debounced embedding generation
        textEmbeddingTimerRef.current = setTimeout(async () => {
            try {
                console.log("Generating text embedding for:", text)
                const embedding = await clientEmbeddingService.getEmbedding(
                    text,
                    metadata.embedding,
                    false
                )
                
                if (embedding && embedding.length > 0) {
                    console.log("Generated text embedding, length:", embedding.length)
                    setCurrentVector(embedding)
                    
                    // Call onEmbeddingGenerated for both single and multi-vector modes
                    // MultiVectorInput needs this to store embeddings for visualization
                    if (onEmbeddingGenerated) {
                        onEmbeddingGenerated(embedding)
                    }
                }
            } catch (error) {
                console.error("Error generating text embedding:", error)
            }
        }, 800) // Debounce text embedding generation
    }, [metadata, onEmbeddingGenerated])
    
    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (textEmbeddingTimerRef.current) {
                clearTimeout(textEmbeddingTimerRef.current)
            }
        }
    }, [])
    
    // Reset the image when text input changes
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        
        if (newValue && activeSearchMode === "image") {
            // Clear image when text is entered
            handleImageSelect("")
            setActiveSearchMode("text")
            setHasImage(false)
            setImagePreviewUrl(null)
        }
        
        onDisplayTextChange(newValue)
        
        // Generate text embedding if this looks like text (not a vector)
        if (onEmbeddingGenerated && newValue.trim() && supportsEmbeddings) {
            // Try to parse as vector first
            const vectorData = newValue.split(",").map((n) => parseFloat(n.trim()))
            const isVector = !vectorData.some(isNaN) && vectorData.length > 1
            
            if (!isVector) {
                // This is text, not a vector - generate embedding
                generateTextEmbedding(newValue)
            } else {
                // This is a vector, clear any previous text embedding
                setCurrentVector(null)
            }
        }
    }

    // Handle image selection for multimodal
    const handleImageSelect = (base64Data: string) => {
        if (base64Data) {
            // Update image preview
            setImagePreviewUrl(base64Data)

            // Only set the image mode, but don't change the textarea content for multi-vector
            // For single vector mode, we may want to clear text
            setActiveSearchMode("image")
            setHasImage(true)

            // Clear text only for single vector mode
            if (searchType === "Vector" && displayText) {
                onDisplayTextChange("")
                setCurrentVector(null)
            }
        } else {
            setHasImage(false)
            setImagePreviewUrl(null)
        }
    }

    // Clear the selected image
    const clearSelectedImage = () => {
        handleImageSelect("")
        // Also clear any vector data in the textarea
        onDisplayTextChange("")
        setCurrentVector(null)
    }

    // Compute the placeholder text based on current searchType and metadata
    const searchBoxPlaceholder = useMemo(() => {
        if (placeholder) return placeholder
        
        if (!metadata?.embedding) return ""

        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding(metadata.embedding)
                    ? "Enter text or vector (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return "Enter text or vector (0.1, 0.2, ...)"
        }
    }, [searchType, supportsEmbeddings, metadata?.embedding, placeholder])

    // Memoize the random vector generation function
    const generateRandomVector = useCallback(() => {
        if (!dim) return

        const randomVector = Array.from({ length: dim }, () =>
            Math.random()
        ).map((n) => n.toFixed(4))

        const vectorString = randomVector.join(", ")
        onDisplayTextChange(vectorString)
        setCurrentVector(randomVector.map(Number))
    }, [dim, onDisplayTextChange])

    // For image-related search types, generate the helper text
    const imageHelpText = useMemo(() => {
        return "Enter text or vector (0.1, 0.2, ...)"
    }, [])

    // Determine if we should show the image uploader - always show for Vector searches
    const showImageUploader = searchType === "Vector" || searchType === "Multi-vector"

    // Always show text input
    const showTextInput = true

    // Show shuffle button for Vector searches
    const showShuffleButton = searchType === "Vector" || searchType === "Multi-vector"

    // For the simplified embedded image uploader
    const handleImageButtonClick = () => {
        // Open a file dialog
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/*"
        input.onchange = (e) => {
            const target = e.target as HTMLInputElement
            if (target.files && target.files.length > 0) {
                const file = target.files[0]
                const reader = new FileReader()
                reader.onload = async () => {
                    const base64 = reader.result as string
                    // This only sets the image preview and notifies the parent
                    // It doesn't put image data in the textarea
                    handleImageSelect(base64)

                    // Generate the embedding for the image
                    if (base64 && metadata?.embedding) {
                        try {
                            // Generate embedding directly
                            const embedding =
                                await clientEmbeddingService.getEmbedding(
                                    base64,
                                    metadata.embedding,
                                    true
                                )
                            // Pass the embedding to our handler
                            handleImageEmbeddingGenerated(embedding)
                            
                            // Update current vector for visualization
                            setCurrentVector(embedding)
                        } catch (error) {
                            console.error("Error generating embedding:", error)
                        }
                    }
                }
                reader.readAsDataURL(file)
            }
        }
        input.click()
    }

    // Modified handler for image embedding generation
    const handleImageEmbeddingGenerated = (embedding: number[]) => {
        // For single vector mode, set search query to vector representation
        // For multi-vector mode, keep the original text and store embedding separately
        if (searchType === "Vector") {
            onDisplayTextChange(embedding.join(", "))
        }
        
        // Update the current vector for visualization
        setCurrentVector(embedding)
        
        // Notify parent of embedding
        if (onEmbeddingGenerated) {
            onEmbeddingGenerated(embedding)
        }
    }

    // Render the integrated search input matching SearchInput exactly
    return (
        <div className={`relative flex-1 w-full flex items-stretch ${className}`}>
            <div
                className={`relative border rounded w-full flex items-stretch overflow-hidden ${
                    showShuffleButton ? "pr-24" : "pr-12"
                }`}
            >
                {/* Image button - simplified alternative to ImageUploader */}
                {showImageUploader && (
                    <div
                        className={`flex-shrink-0 border-r flex flex-col justify-center items-center p-1 cursor-pointer ${
                            hasImage
                                ? "bg-blue-50"
                                : isDraggingOver
                                ? "bg-blue-100"
                                : "bg-gray-50 hover:bg-gray-100"
                        }`}
                        style={{
                            width: "120px",
                            minWidth: "120px",
                            height: "80px",
                        }}
                        onClick={!hasImage ? handleImageButtonClick : undefined}
                        onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingOver(true)
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingOver(false)
                        }}
                        onDragExit={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingOver(false)
                        }}
                        onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setIsDraggingOver(false)
                            if (
                                e.dataTransfer.files &&
                                e.dataTransfer.files.length > 0
                            ) {
                                const file = e.dataTransfer.files[0]
                                if (file.type.startsWith("image/")) {
                                    const reader = new FileReader()
                                    reader.onload = async () => {
                                        const base64 = reader.result as string
                                        // This only sets the image preview and notifies the parent
                                        // It doesn't put image data in the textarea
                                        handleImageSelect(base64)

                                        // Generate the embedding for the image
                                        if (base64 && metadata?.embedding) {
                                            try {
                                                // Generate embedding directly
                                                const embedding =
                                                    await clientEmbeddingService.getEmbedding(
                                                        base64,
                                                        metadata.embedding,
                                                        true
                                                    )
                                                // Pass the embedding to our handler
                                                handleImageEmbeddingGenerated(
                                                    embedding
                                                )

                                                // Update current vector for visualization
                                                setCurrentVector(embedding)
                                            } catch (error) {
                                                console.error(
                                                    "Error generating embedding:",
                                                    error
                                                )
                                            }
                                        }
                                    }
                                    reader.readAsDataURL(file)
                                }
                            }
                        }}
                    >
                        {!hasImage ? (
                            // Empty state - show icon and text
                            <div
                                className={`h-full w-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed ${
                                    isDraggingOver
                                        ? "border-blue-400"
                                        : "border-gray-300"
                                } rounded-md p-2 transition-colors duration-150`}
                            >
                                <ImageIcon size={24} />
                                <span className="text-xs mt-1 text-center">
                                    Search by image{" "}
                                    {isDraggingOver
                                        ? "(drop now)"
                                        : "(drop here)"}
                                </span>
                            </div>
                        ) : (
                            // Image preview state
                            <div className="h-full w-full relative">
                                <img
                                    src={imagePreviewUrl || ""}
                                    alt="Preview"
                                    className="h-full w-full object-cover rounded-md"
                                    style={{ objectFit: "contain" }}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 p-0.5 rounded-full bg-white/80 h-5 w-5"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        clearSelectedImage()
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Text input section */}
                {showTextInput && (
                    <div className="flex-1 flex flex-col relative">
                        <Textarea
                            value={displayText}
                            onChange={handleTextChange}
                            placeholder={
                                showImageUploader
                                    ? imageHelpText
                                    : searchBoxPlaceholder
                            }
                            disabled={disabled}
                            className="border-0 flex-1 px-4 py-3 min-w-0 h-20 resize-none focus-visible:ring-0"
                        />
                    </div>
                )}

                {/* For Image type only, show a message instead of an input */}
                {!displayText && showImageUploader && !showTextInput && (
                    <div className="flex-1 flex items-center justify-center px-4 text-gray-500 text-sm h-20">
                        <div className="text-center">
                            <p>Drop an image to search by image</p>
                            <p className="text-xs mt-1 text-gray-400">
                                Supported formats: JPG, PNG, GIF
                            </p>
                        </div>
                    </div>
                )}

                {/* Random vector button */}
                {showShuffleButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={generateRandomVector}
                        title="Generate random vector"
                        disabled={disabled}
                    >
                        <Shuffle className="h-4 w-4" />
                    </Button>
                )}
                
                {/* Embedding model info */}
                <div className="absolute bottom-1 right-1 flex flex-row gap-2 backdrop-blur-sm bg-white/80 rounded-tl-md px-0">
                    <div className="flex-grow"></div>
                    <div className="text-xs text-gray-400 p-0.5 px-1 rounded-lg w-fit mt-1">
                        Embedding model:{" "}
                        <span className="font-bold">
                            {metadata?.embedding.provider &&
                                `${
                                    metadata?.embedding.provider
                                } - ${getModelName(metadata?.embedding)}`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Mini vector heatmap - moved outside the search input and full height */}
            {(searchType === "Vector" || searchType === "Multi-vector") && (
                <div className="h-full flex items-stretch ml-2">
                    <MiniVectorHeatmap
                        vector={
                            lastTextEmbedding && lastTextEmbedding.length > 0
                                ? lastTextEmbedding
                                : currentVector
                        }
                    />
                </div>
            )}
        </div>
    )
} 