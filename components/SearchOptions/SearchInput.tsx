import { isMultiModalEmbedding, isTextEmbedding } from "@/lib/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Shuffle, ImageIcon, X } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import ImageUploader from "../ImageUploader/ImageUploader"
import { type SearchType } from "./SearchTypeSelector"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"

interface SearchInputProps {
    searchType: SearchType
    searchQuery: string
    setSearchQuery: (query: string) => void
    metadata: VectorSetMetadata | null
    dim: number | null
    onImageSelect: (base64Data: string) => void
    onImageEmbeddingGenerated: (embedding: number[]) => void
}

export default function SearchInput({
    searchType,
    searchQuery,
    setSearchQuery,
    metadata,
    dim,
    onImageSelect,
    onImageEmbeddingGenerated,
}: SearchInputProps) {
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"
    
    // Determine if the model supports both image and text
    const isMultiModal = metadata?.embedding ? isMultiModalEmbedding(metadata.embedding) : false
    
    // Keep track of whether we're using image or text for multimodal search
    const [activeSearchMode, setActiveSearchMode] = useState<"text" | "image">("text")
    
    // Track whether an image is selected for visual feedback
    const [hasImage, setHasImage] = useState<boolean>(false)
    
    // Keep the preview URL for the selected image
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
    
    // Track hover state when dragging over the drop area
    const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false)
    
    // Reset the image when text input changes
    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (e.target.value && activeSearchMode === "image") {
            // Clear image when text is entered
            onImageSelect("")
            setActiveSearchMode("text")
            setHasImage(false)
            setImagePreviewUrl(null)
        }
        setSearchQuery(e.target.value)
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
            
            // Clear text only if explicitly requested (we'll keep textarea empty until we get the embedding)
            if ((searchType === "TextAndImage" || searchType === "ImageOrVector") && searchQuery) {
                setSearchQuery("")
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
    }

    // Compute the placeholder text based on current searchType and metadata
    const searchBoxPlaceholder = useMemo(() => {
        if (!metadata?.embedding) return ""

        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Image":
                return "Enter image data"
            case "TextAndImage":
                return "Enter text or vector (0.1, 0.2, ...)"
            case "ImageOrVector":
                return "Enter vector data (0.1, 0.2, ...)"
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
        if (!dim) return;
        
        const randomVector = Array.from(
            { length: dim },
            () => Math.random()
        ).map((n) => n.toFixed(4));
        
        setSearchQuery(randomVector.join(", "));
    }, [dim, setSearchQuery]);

    // For image-related search types, generate the helper text
    const imageHelpText = useMemo(() => {
        if (searchType === "TextAndImage") {
            return "Enter text or vector (0.1, 0.2, ...)"
        } else if (searchType === "ImageOrVector") {
            return "Enter vector data (0.1, 0.2, ...)"
        }
        return ""
    }, [searchType]);

    // Determine if we should show the image uploader
    const showImageUploader = searchType === "TextAndImage" || 
                             searchType === "ImageOrVector" || 
                             searchType === "Image";

    // Determine if we should show the text input
    const showTextInput = searchType !== "Image";

    // Should show shuffle button?
    const showShuffleButton = searchType === "Vector" ||
                             searchType === "TextAndImage" || 
                             searchType === "ImageOrVector";

    // For the simplified embedded image uploader
    const handleImageButtonClick = () => {
        // Open a file dialog
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                const reader = new FileReader();
                reader.onload = async () => {
                    const base64 = reader.result as string;
                    // This only sets the image preview and notifies the parent
                    // It doesn't put image data in the textarea
                    handleImageSelect(base64);
                    
                    // Generate the embedding for the image
                    if (base64 && metadata?.embedding) {
                        try {
                            // Generate embedding directly
                            const embedding = await clientEmbeddingService.getEmbedding(base64, metadata.embedding, true);
                            // Pass the embedding to our handler
                            handleImageEmbeddingGenerated(embedding);
                        } catch (error) {
                            console.error("Error generating embedding:", error);
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    };

    // Modified image embedding handler to put the vector in the textarea
    const handleImageEmbeddingGenerated = useCallback((embedding: number[]) => {
        if (embedding && embedding.length > 0) {
            // Format the vector nicely with limited decimal places
            const formattedVector = embedding.map(n => n.toFixed(6)).join(", ");
            // Set search query to the vector representation
            setSearchQuery(formattedVector);
            // Keep track that we're still using an image (even though we have text)
            setActiveSearchMode("image");
        }
        
        // Call the original handler to ensure proper behavior
        onImageEmbeddingGenerated(embedding);
    }, [setSearchQuery, onImageEmbeddingGenerated]);

    // Render the integrated search input for all types
    return (
        <div className="relative flex-1 w-full">
            <div className={`border rounded w-full flex items-stretch overflow-hidden ${showShuffleButton ? 'pr-12' : ''}`}>
                {/* Image button - simplified alternative to ImageUploader */}
                {showImageUploader && (
                    <div 
                        className={`flex-shrink-0 border-r flex flex-col justify-center items-center p-1 cursor-pointer ${hasImage ? 'bg-blue-50' : isDraggingOver ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'}`}
                        style={{ width: "120px", minWidth: "120px", height: "80px" }}
                        onClick={!hasImage ? handleImageButtonClick : undefined}
                        onDragOver={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation();
                            setIsDraggingOver(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingOver(false);
                        }}
                        onDragExit={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingOver(false);
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingOver(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const file = e.dataTransfer.files[0];
                                if (file.type.startsWith('image/')) {
                                    const reader = new FileReader();
                                    reader.onload = async () => {
                                        const base64 = reader.result as string;
                                        // This only sets the image preview and notifies the parent
                                        // It doesn't put image data in the textarea
                                        handleImageSelect(base64);
                                        
                                        // Generate the embedding for the image
                                        if (base64 && metadata?.embedding) {
                                            try {
                                                // Generate embedding directly
                                                const embedding = await clientEmbeddingService.getEmbedding(base64, metadata.embedding, true);
                                                // Pass the embedding to our handler
                                                handleImageEmbeddingGenerated(embedding);
                                            } catch (error) {
                                                console.error("Error generating embedding:", error);
                                            }
                                        }
                                    };
                                    reader.readAsDataURL(file);
                                }
                            }
                        }}
                    >
                        {!hasImage ? (
                            // Empty state - show icon and text
                            <div className={`h-full w-full flex flex-col items-center justify-center text-muted-foreground text-xs border border-dashed ${isDraggingOver ? 'border-blue-400' : 'border-gray-300'} rounded-md p-2 transition-colors duration-150`}>
                                <ImageIcon size={24} />
                                <span className="text-xs mt-1 text-center">
                                    Search by image {isDraggingOver ? "(drop now)" : "(drop here)"}
                                </span>
                            </div>
                        ) : (
                            // Image preview state
                            <div className="h-full w-full relative">
                                <img 
                                    src={imagePreviewUrl || ''} 
                                    alt="Preview" 
                                    className="h-full w-full object-cover rounded-md"
                                    style={{ objectFit: 'contain' }}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-0 right-0 p-0.5 rounded-full bg-white/80 h-5 w-5"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearSelectedImage();
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
                    <Textarea
                        value={searchQuery}
                        onChange={handleTextChange}
                        placeholder={showImageUploader ? imageHelpText : searchBoxPlaceholder}
                        className="border-0 flex-1 px-4 py-3 min-w-0 h-20 resize-none focus-visible:ring-0"
                    />
                )}

                {/* For Image type only, show a message instead of an input */}
                {searchType === "Image" && !searchQuery && (
                    <div className="flex-1 flex items-center justify-center px-4 text-gray-500 text-sm h-20">
                        <div className="text-center">
                            <p>Drop an image to search by image</p>
                            <p className="text-xs mt-1 text-gray-400">Supported formats: JPG, PNG, GIF</p>
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
                    >
                        <Shuffle className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
} 