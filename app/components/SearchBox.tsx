import { useMemo, useEffect } from "react"
import { getEmbeddingDataFormat, VectorSetMetadata } from "../types/embedding"
import * as React from "react"
import { Input } from "@/components/ui/input"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const searchTypes = [
    {
        value: "Vector",
        label: "Vector",
    },
    {
        value: "Element",
        label: "Element",
    },
    {
        value: "Image",
        label: "Image",
    },
] as const

interface SearchBoxProps {
    searchType: "Vector" | "Element" | "Image"
    setSearchType: (type: "Vector" | "Element" | "Image") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    dim: number | null
    metadata: VectorSetMetadata | null
}

export default function SearchBox({
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    dim,
    metadata,
}: SearchBoxProps) {
    const isImageEmbedding = metadata && getEmbeddingDataFormat(metadata?.embedding) === "image"
    const isTextEmbedding = metadata && getEmbeddingDataFormat(metadata?.embedding) === "text"
    const supportsEmbeddings = metadata?.embedding.provider && metadata?.embedding.provider !== "none"
    
    const filteredSearchTypes = searchTypes.filter((type) => {
        if (type.value === "Image" && !isImageEmbedding) {
            return false
        }
        return true
    })
    
    // Compute the placeholder text based on current searchType
    const searchBoxPlaceholder = useMemo(() => {
        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Image":
                return "Enter image data"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding
                    ? "Enter search text OR Enter raw vector data (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, isTextEmbedding])
    
    // set default searchType only when metadata changes
    useEffect(() => {
        if (!metadata) return; // Don't set defaults if no metadata

        if (supportsEmbeddings) {
            const newSearchType = isTextEmbedding 
                ? "Vector" 
                : "Element";
                
            // Only update if the current searchType doesn't match what it should be
            if (searchType !== newSearchType) {
                setSearchType(newSearchType);
            }
        }
    }, [metadata]); // Only run when metadata changes
    
    return (
        <section className="mb-6">
            <div className="bg-white p-4 rounded shadow-md flex flex-col gap-2 items-start">
                <div className="flex gap-2 items-center w-full">
                    <label className="text-sm font-medium text-gray-700">
                        Search by
                    </label>
                    <Select 
                        defaultValue={searchType} 
                        value={searchType} 
                        onValueChange={setSearchType}
                    >
                        <SelectTrigger className="w-[120px]">
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
                </div>
                <div className="flex flex-col gap-2 grow w-full">
                    <div className="relative">
                        {/* If Metadata method is image, then we need to change to element search */}
                        <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={searchBoxPlaceholder}
                            className="border rounded p-3 w-full pr-24"
                        />
                        {searchType === "Vector" && (
                            <button
                                type="button"
                                className="absolute right-0 top-0.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm"
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
                                Random
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
} 