"use client"

import SearchBox from "@/app/components/SearchBox"
import { VectorSetMetadata } from "@/app/embeddings/types/config"
import {
    useVectorSearch,
    VectorSetSearchState,
} from "@/app/hooks/useVectorSearch"
import { VectorTuple } from "@/app/redis-server/api"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import VectorResults from "./VectorResults"
import { userSettings } from "@/app/utils/userSettings"

interface VectorSearchTabProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
    onAddVector: () => void
    onShowVector: (element: string) => Promise<number[] | null>
    onDeleteVector: (element: string) => Promise<void>
    isLoading: boolean
    results: VectorTuple[]
    setResults: (results: VectorTuple[]) => void
}

export default function VectorSearchTab({
    vectorSetName,
    dim,
    metadata,
    onAddVector,
    onShowVector,
    onDeleteVector,
    isLoading,
    results,
    setResults,
}: VectorSearchTabProps) {
    // Load persisted expansion factor settings
    const useCustomEF = userSettings.get("useCustomEF") ?? false
    const efValue = userSettings.get("efValue")

    const [searchState, setSearchState] = useState<VectorSetSearchState>({
        searchType: "Vector" as const,
        searchQuery: "",
        searchCount: "10",
        searchFilter: "",
        resultsTitle: "Search Results",
        searchTime: undefined as string | undefined,
        expansionFactor: useCustomEF ? efValue : undefined,
    })

    const handleSearchResults = useCallback(
        (newResults: VectorTuple[]) => {
            setResults(newResults)
        },
        [setResults]
    )

    const handleStatusChange = useCallback((status: string) => {
    }, [])

    const handleSearchStateChange = useCallback(
        (newState: Partial<VectorSetSearchState>) => {
            setSearchState((prevState) => ({
                ...prevState,
                ...newState,
            }))
        },
        []
    )

    const handleError = useCallback((error: string | null) => {
        console.log("Search error:", error)
    }, [])

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
        error,
        clearError,
        expansionFactor,
        setExpansionFactor,
        lastTextEmbedding,
        executedCommand,
    } = useVectorSearch({
        vectorSetName,
        metadata,
        onSearchResults: handleSearchResults,
        onStatusChange: handleStatusChange,
        onError: handleError,
        searchState,
        onSearchStateChange: handleSearchStateChange,
        fetchEmbeddings: false,
    })

    const handleSearchQueryChange = (query: string) => {
        setSearchQuery(query)
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

    const handleShowVectorClick = async (
        e: React.MouseEvent,
        element: string
    ) => {
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
                error={error}
                clearError={clearError}
                expansionFactor={expansionFactor}
                setExpansionFactor={setExpansionFactor}
                lastTextEmbedding={lastTextEmbedding}
                executedCommand={executedCommand}
                results={results}
            />
            <div className="bg-white p-4 rounded shadow-md">
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
                    isLoading={isLoading}
                />
            </div>
        </section>
    )
}
