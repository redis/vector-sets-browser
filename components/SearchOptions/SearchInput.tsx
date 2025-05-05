import { isTextEmbedding } from "@/lib/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Shuffle } from "lucide-react"
import { useMemo } from "react"
import ImageUploader from "../ImageUploader/ImageUploader"

interface SearchInputProps {
    searchType: "Vector" | "Element" | "Image"
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

    // Compute the placeholder text based on current searchType and metadata
    const searchBoxPlaceholder = useMemo(() => {
        if (!metadata?.embedding) return ""

        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Image":
                return "Enter image data"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding(metadata.embedding)
                    ? "Enter search text or vector data (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, metadata?.embedding])

    return (
        <>
            {searchType === "Image" ? (
                // Show ImageUploader for Image search type
                <ImageUploader
                    onImageSelect={onImageSelect}
                    onEmbeddingGenerated={onImageEmbeddingGenerated}
                    config={metadata?.embedding}
                    className="w-full"
                    allowMultiple={false}
                />
            ) : (
                // Show regular search input for other types
                <div className="relative flex-1">
                    <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={searchBoxPlaceholder}
                        className="border rounded p-3 w-full pr-12"
                    />
                    {searchType === "Vector" && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full"
                            onClick={() => {
                                if (dim) {
                                    const randomVector = Array.from(
                                        { length: dim },
                                        () => Math.random()
                                    ).map((n) => n.toFixed(4))
                                    setSearchQuery(randomVector.join(", "))
                                }
                            }}
                        >
                            <Shuffle className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}
        </>
    )
} 