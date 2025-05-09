import { isImageEmbedding, isMultiModalEmbedding, isTextEmbedding } from "@/lib/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"

// Define search types
export const searchTypes = [
    {
        value: "Vector",
        label: "Vector",
        forEmbeddings: ["text"] as string[],
    },
    {
        value: "Image",
        label: "Image",
        forEmbeddings: ["image"] as string[],
    },
    {
        value: "TextAndImage",
        label: "Vector",
        forEmbeddings: ["text-and-image"] as string[],
    },
    {
        value: "ImageOrVector",
        label: "Vector",
        forEmbeddings: ["image"] as string[],
    },
    {
        value: "Element",
        label: "Element",
        forEmbeddings: ["text", "image", "text-and-image"] as string[],
    },
] as const

export type SearchType = "Vector" | "Element" | "Image" | "TextAndImage" | "ImageOrVector"

// Define a runtime type for search options that allows mutable labels
type RuntimeSearchOption = {
    value: (typeof searchTypes)[number]['value'];
    label: string;
    forEmbeddings: readonly string[];
}

interface SearchTypeSelectorProps {
    searchType: SearchType
    setSearchType: (type: SearchType) => void
    metadata: VectorSetMetadata | null
    setSearchQuery: (query: string) => void
    searchCount?: string
    setSearchCount?: (value: string) => void
}

export default function SearchTypeSelector({
    searchType,
    setSearchType,
    metadata,
    setSearchQuery,
    searchCount,
    setSearchCount,
}: SearchTypeSelectorProps) {
    // Determine which embedding type we're using
    const isTextEmbeddingType = isTextEmbedding(metadata?.embedding)
    const isImageEmbeddingType = isImageEmbedding(metadata?.embedding)
    const isMultiModal = isMultiModalEmbedding(metadata?.embedding)

    // Filter search types based on metadata
    let filteredSearchTypes: RuntimeSearchOption[] = searchTypes.filter((type) => {
        if (isMultiModal && type.forEmbeddings.includes("text-and-image")) {
            return true
        }
        if (isTextEmbeddingType && !isImageEmbeddingType && type.forEmbeddings.includes("text")) {
            return true
        }
        if (isImageEmbeddingType && !isTextEmbeddingType && type.forEmbeddings.includes("image")) {
            return true
        }
        return false
    }).map(type => ({
        value: type.value,
        label: type.label,
        forEmbeddings: type.forEmbeddings
    }));

    // Rename the options for clarity according to embedding type
    filteredSearchTypes = filteredSearchTypes.map(type => {
        if (type.value === "Vector" && isTextEmbeddingType) {
            return { ...type, label: "Vector" }
        }
        if (type.value === "ImageOrVector" && isImageEmbeddingType) {
            return { ...type, label: "Image or Vector" }
        }
        return type
    })
    
    // Check if current search type is valid for this embedding type
    // If not, default to the first available option
    if (!filteredSearchTypes.some(type => type.value === searchType) && filteredSearchTypes.length > 0) {
        setSearchType(filteredSearchTypes[0].value as SearchType)
    }

    return (
        <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">
                Search by
            </label>
            <Select
                value={searchType}
                onValueChange={(value) => {
                    // Clear search query when switching between search types
                    if (value !== searchType) {
                        setSearchQuery("")
                    }
                    setSearchType(value as SearchType)
                }}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                    {filteredSearchTypes.map((type) => (
                        <SelectItem
                            key={type.value}
                            value={type.value}
                            className="flex items-center justify-between cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                {type.label}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            
            <div className="grow"></div>
            
            {setSearchCount && (
                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium text-gray-500">
                        Show
                    </label>
                    <Input
                        type="number"
                        value={searchCount}
                        onChange={(e) => setSearchCount(e.target.value)}
                        className="w-16 h-8 text-center"
                        min="1"
                    />
                    <label className="text-xs font-medium text-gray-500">
                        Results
                    </label>
                </div>
            )}
        </div>
    )
} 