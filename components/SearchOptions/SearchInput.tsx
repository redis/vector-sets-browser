import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"
import {
    getModelName,
    isTextEmbedding
} from "@/lib/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { ImageIcon, Search, Shuffle, X } from "lucide-react"
import { useCallback, useMemo, useState, useEffect } from "react"
import { type SearchType } from "./SearchTypeSelector"
import MiniVectorHeatmap from "../MiniVectorHeatmap"

interface SearchInputProps {
    searchType: SearchType
    searchQuery: string
    setSearchQuery: (query: string) => void
    metadata: VectorSetMetadata | null
    dim: number | null
    onImageSelect: (base64Data: string) => void
    onImageEmbeddingGenerated: (embedding: number[]) => void
    triggerSearch?: () => void // Optional function to explicitly trigger search
    lastTextEmbedding?: number[] // Add lastTextEmbedding from useVectorSearch
}

export default function SearchInput({
    searchType,
    searchQuery,
    setSearchQuery,
    metadata,
    dim,
    onImageSelect,
    onImageEmbeddingGenerated,
    triggerSearch,
    lastTextEmbedding
}: SearchInputProps) {
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    // Keep track of whether we're using image or text for multimodal search
    const [activeSearchMode, setActiveSearchMode] = useState<"text" | "image">(
        "text"
    )

    // Track whether an image is selected for visual feedback
    const [hasImage, setHasImage] = useState<boolean>(false)

    // Keep the preview URL for the selected image
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

    // Track hover state when dragging over the drop area
    const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false)
    
    // Store the current vector (for visualization)
    const [currentVector, setCurrentVector] = useState<number[] | null>(null)

    // Update current vector when lastTextEmbedding changes
    useEffect(() => {
        console.log("SearchInput useEffect for lastTextEmbedding:", {
            hasLastTextEmbedding: !!lastTextEmbedding,
            lastTextEmbeddingLength: lastTextEmbedding?.length,
            firstFewValues: lastTextEmbedding?.slice(0, 5)
        });
        
        if (lastTextEmbedding && lastTextEmbedding.length > 0) {
            console.log("Setting currentVector from lastTextEmbedding");
            setCurrentVector(lastTextEmbedding)
        }
    }, [lastTextEmbedding])
    
    // Reset the image when text input changes
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value
        
        if (newValue && activeSearchMode === "image") {
            // Clear image when text is entered
            onImageSelect("")
            setActiveSearchMode("text")
            setHasImage(false)
            setImagePreviewUrl(null)
        }
        
        setSearchQuery(newValue)
    }

    // Handle image selection for multimodal
    const handleImageSelect = (base64Data: string) => {
        if (base64Data) {
            // Update image preview
            setImagePreviewUrl(base64Data)

            // Only set the image mode, but don't change the textarea content
            // The vector will be placed there by handleImageEmbeddingGenerated
            setActiveSearchMode("image")
            setHasImage(true)

            // Clear text only if explicitly requested for Vector search type
            if (searchType === "Vector" && searchQuery) {
                setSearchQuery("")
                setCurrentVector(null)
            }
        } else {
            setHasImage(false)
            setImagePreviewUrl(null)
        }

        // Pass the base64 data to the parent component for embedding generation
        // But don't set it as the searchQuery
        onImageSelect(base64Data)
    }

    // Clear the selected image
    const clearSelectedImage = () => {
        handleImageSelect("")
        // Also clear any vector data in the textarea
        setSearchQuery("")
        setCurrentVector(null)
    }

    // Compute the placeholder text based on current searchType and metadata
    const searchBoxPlaceholder = useMemo(() => {
        if (!metadata?.embedding) return ""

        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding(metadata.embedding)
                    ? "Enter text or vector (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, metadata?.embedding])

    // Memoize the random vector generation function
    const generateRandomVector = useCallback(() => {
        if (!dim) return

        const randomVector = Array.from({ length: dim }, () =>
            Math.random()
        ).map((n) => n.toFixed(4))

        const vectorString = randomVector.join(", ")
        setSearchQuery(vectorString)
        setCurrentVector(randomVector.map(Number))
    }, [dim, setSearchQuery])

    // For image-related search types, generate the helper text
    const imageHelpText = useMemo(() => {
        return "Enter text or vector (0.1, 0.2, ...)"
    }, [])

    // Determine if we should show the image uploader - always show for Vector searches
    const showImageUploader = searchType === "Vector"

    // Always show text input
    const showTextInput = true

    // Show shuffle button for Vector searches
    const showShuffleButton = searchType === "Vector"

    // Handler for search button click
    const handleSearchClick = () => {
        if (triggerSearch) {
            console.log("Manually triggering search from SearchInput");
            triggerSearch();
        }
    };

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
        // Set search query to a vector representation (needed for the search)
        setSearchQuery(embedding.join(", "))
        
        // Update the current vector for visualization
        setCurrentVector(embedding)
    }

    // Add debug logging for vector rendering
    useEffect(() => {
        if (searchType === "Vector") {
            console.log("Rendering MiniVectorHeatmap with: ", {
                currentVector: currentVector?.length,
                lastTextEmbedding: lastTextEmbedding?.length,
                passedVector: (currentVector || lastTextEmbedding || null)?.length
            });
        }
    }, [searchType, currentVector, lastTextEmbedding]);

    // Render the integrated search input for all types
    return (
        <div className="relative flex-1 w-full flex items-stretch">
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
                            value={searchQuery}
                            onChange={handleTextChange}
                            placeholder={
                                showImageUploader
                                    ? imageHelpText
                                    : searchBoxPlaceholder
                            }
                            className="border-0 flex-1 px-4 py-3 min-w-0 h-20 resize-none focus-visible:ring-0"
                        />
                    </div>
                )}

                {/* For Image type only, show a message instead of an input */}
                {!searchQuery && showImageUploader && !showTextInput && (
                    <div className="flex-1 flex items-center justify-center px-4 text-gray-500 text-sm h-20">
                        <div className="text-center">
                            <p>Drop an image to search by image</p>
                            <p className="text-xs mt-1 text-gray-400">
                                Supported formats: JPG, PNG, GIF
                            </p>
                        </div>
                    </div>
                )}

                {/* Search button */}
                {/* {triggerSearch && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-12 top-0 h-full"
                        onClick={handleSearchClick}
                        title="Search"
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                )} */}

                {/* Random vector button */}
                {showShuffleButton && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full"
                        onClick={generateRandomVector}
                        title="Generate random vector"
                    >
                        <Shuffle className="h-4 w-4" />
                    </Button>
                )}
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
            {searchType === "Vector" && (
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
