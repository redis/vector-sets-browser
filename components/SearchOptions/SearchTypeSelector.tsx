import { isImageEmbedding, isMultiModalEmbedding } from "@/lib/embeddings/types/embeddingModels"
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
        label: "Text or Vector",
    },
    {
        value: "Image",
        label: "Image",
    },
    {
        value: "Element",
        label: "Element",
    },
] as const

type SearchType = "Vector" | "Element" | "Image"

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
    // Filter search types based on metadata
    const filteredSearchTypes = searchTypes.filter((type) => {
        if (isMultiModalEmbedding(metadata?.embedding)) {
            return true
        }
        if (type.value === "Image" && !isImageEmbedding(metadata?.embedding)) {
            return false
        }
        return true
    })

    return (
        <div className="flex gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">
                Search by
            </label>
            <Select
                defaultValue={searchType}
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