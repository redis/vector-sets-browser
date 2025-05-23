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
        forEmbeddings: ["text", "image", "text-and-image"] as string[],
    },
    {
        value: "Multi-vector",
        label: "Multi-vector",
        forEmbeddings: ["text", "image", "text-and-image"] as string[],
    },
    {
        value: "Element",
        label: "Element",
        forEmbeddings: ["text", "image", "text-and-image"] as string[],
    },
] as const

export type SearchType = "Vector" | "Multi-vector" | "Element"

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
                    {searchTypes.map((type) => (
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