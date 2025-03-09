"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SearchBox from "./SearchBox"
import VectorResults from "./VectorResults"
import StatusMessage from "./StatusMessage"
import SearchTimeIndicator from "./SearchTimeIndicator"
import { useVectorSearch, VectorSetSearchState } from "../hooks/useVectorSearch"
import { VectorSetMetadata } from "../types/embedding"
import { VectorTuple } from "../api/types"
import { toast } from "sonner"

interface VectorSearchTabProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
    onAddVector: () => void
    onShowVector: (element: string) => Promise<number[] | null>
    onDeleteVector: (element: string) => void
}

export default function VectorSearchTab({
    vectorSetName,
    dim,
    metadata,
    onAddVector,
    onShowVector,
    onDeleteVector,
}: VectorSearchTabProps) {
    const [fileOperationStatus, setFileOperationStatus] = useState("")
    const [results, setResults] = useState<VectorTuple[]>([])

    const {
        searchType,
        setSearchType,
        searchQuery,
        setSearchQuery,
        searchCount,
        setSearchCount,
        resultsTitle,
        isSearching,
        searchTime,
    } = useVectorSearch({
        vectorSetName,
        metadata,
        onSearchResults: setResults,
        onStatusChange: setFileOperationStatus,
        // Initial state - hook will manage this internally
        searchState: {
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            resultsTitle: "Search Results"
        },
        onSearchStateChange: () => {} // Let the hook manage state internally
    })

    const handleSearchQueryChange = (query: string) => {
        setSearchQuery(query);
    }

    const handleRowClick = async (element: string) => {
        setSearchType("Element")
        setSearchQuery(element)
    }

    const handleDeleteClick = (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        if (confirm("Are you sure you want to delete this vector?")) {
            onDeleteVector(element)
        }
    }

    const handleShowVectorClick = async (e: React.MouseEvent, element: string) => {
        e.stopPropagation()
        try {
            const vector = await onShowVector(element)
            if (!vector) {
                toast.error("Error retrieving vector")
                return
            }

            await navigator.clipboard.writeText(JSON.stringify(vector))
            toast.success("Vector copied to clipboard")
        } catch (error) {
            console.error("Error copying vector:", error)
            toast.error("Failed to copy vector to clipboard")
        }
    }

    return (
        <section>
            <SearchBox
                searchType={searchType}
                setSearchType={setSearchType}
                searchQuery={searchQuery}
                setSearchQuery={handleSearchQueryChange}
                dim={dim}
                metadata={metadata}
            />
            <div className="bg-white p-4 rounded shadow-md">
                <div className="flex mb-4 items-center space-x-2">
                    <div className="flex items-center gap-2 w-full">
                        <div className="flex items-center gap-2">
                            {!isSearching && results && results.length > 0 && (
                                <Input
                                    type="number"
                                    value={searchCount}
                                    onChange={(e) => setSearchCount(e.target.value)}
                                    className="border rounded p-1 w-16 h-8 text-center"
                                    min="1"
                                />
                            )}

                            <span className="flex text-gray-500 text-sm items-center space-x-2 whitespace-nowrap">
                                {!isSearching && results && results.length > 0 && (
                                    <div>results in</div>
                                )}
                                <div>
                                    {(searchTime || isSearching) && (
                                        <SearchTimeIndicator
                                            searchTime={searchTime ? Number(searchTime) : undefined}
                                            isSearching={isSearching}
                                        />
                                    )}
                                </div>
                            </span>
                        </div>
                        <StatusMessage message={fileOperationStatus} />
                    </div>
                    <div className="grow"></div>
                    <Button variant="default" onClick={onAddVector}>
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add Vector
                    </Button>
                </div>
                <VectorResults
                    results={results}
                    onRowClick={handleRowClick}
                    onDeleteClick={handleDeleteClick}
                    onShowVectorClick={handleShowVectorClick}
                />
            </div>
        </section>
    )
} 