"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SearchBox from "./SearchBox"
import VectorResults from "./VectorResults"
import StatusMessage from "./StatusMessage"
import SearchTimeIndicator from "./SearchTimeIndicator"
import { useVectorSearch } from "../hooks/useVectorSearch"
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
        isSearching,
        searchTime,
        searchFilter,
        setSearchFilter,
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
            searchFilter: "",
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
                vectorSetName={vectorSetName}
                searchType={searchType}
                setSearchType={setSearchType}
                searchQuery={searchQuery}
                setSearchQuery={handleSearchQueryChange}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                searchCount={searchCount}
                setSearchCount={setSearchCount}
                dim={dim}
                metadata={metadata}
            />
            <div className="bg-white p-4 rounded shadow-md">
                <div className="flex mb-4 items-center space-x-2">
                    <div className="flex items-center gap-2 w-full">
                        <StatusMessage message={fileOperationStatus} />
                    </div>
                </div>
                <VectorResults
                    results={results}
                    onRowClick={handleRowClick}
                    onDeleteClick={handleDeleteClick}
                    onShowVectorClick={handleShowVectorClick}
                    keyName={vectorSetName}
                    searchFilter={searchFilter}
                    searchQuery={searchQuery}
                    onClearFilter={() => setSearchFilter("")}
                    onAddVector={onAddVector}
                    isSearching={isSearching}
                    searchTime={searchTime}
                />
            </div>
        </section>
    )
} 