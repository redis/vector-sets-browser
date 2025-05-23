import { Button } from "@/components/ui/button"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { Filter, X, ChevronRight } from "lucide-react"
import { useCallback, useState } from "react"

import { VectorTuple } from "@/lib/redis-server/api"
import RedisCommandBox from "./RedisCommandBox"

// Import custom hook
import useSearchOptions from "@/app/vectorset/hooks/useSearchOptions"

// Import components
import {
    FilterHelpDialog,
    FilterSection,
    SearchOptionsDialog,
    SearchSettingsDropdown,
    SearchTypeSelector,
} from "./SearchOptions"
import MultiVectorInput from "./SearchOptions/MultiVectorInput"
import VectorSearchInput from "./SearchOptions/VectorSearchInput"
import { SearchType } from "./SearchOptions/SearchTypeSelector"

const searchTypes = [
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

interface SearchBoxProps {
    vectorSetName: string
    searchType: SearchType
    setSearchType: (type: SearchType) => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    searchFilter: string
    setSearchFilter: (filter: string) => void
    dim: number | null
    metadata: VectorSetMetadata | null
    searchCount?: string
    setSearchCount?: (value: string) => void
    error?: string | null
    clearError?: () => void
    searchExplorationFactor?: number
    setSearchExplorationFactor?: (value: number | undefined) => void
    filterExplorationFactor?: number
    setFilterExplorationFactor?: (value: number | undefined) => void
    forceLinearScan: boolean
    setForceLinearScan: (value: boolean) => void
    noThread: boolean
    setNoThread: (value: boolean) => void
    executedCommand?: string
    results?: VectorTuple[]
    lastTextEmbedding?: number[]
    vectorFormat?: 'FP32' | 'VALUES'
    setVectorFormat?: (format: 'FP32' | 'VALUES') => void
}

export default function SearchBox({
    vectorSetName,
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    searchFilter,
    setSearchFilter,
    dim,
    metadata,
    searchCount,
    setSearchCount,
    error,
    clearError,
    searchExplorationFactor,
    setSearchExplorationFactor,
    filterExplorationFactor,
    setFilterExplorationFactor,
    forceLinearScan,
    setForceLinearScan,
    noThread,
    setNoThread,
    executedCommand,
    results = [],
    lastTextEmbedding,
    vectorFormat,
    setVectorFormat,
}: SearchBoxProps) {
    // Use custom hook for search options state
    const searchOptions = useSearchOptions({
        initialSearchFilter: searchFilter,
        vectorSetName,
        searchQuery,
        setSearchQuery,
        setSearchFilter,
        forceLinearScan,
        setForceLinearScan,
        noThread,
        setNoThread,
        searchExplorationFactor,
        setSearchExplorationFactor,
        filterExplorationFactor,
        setFilterExplorationFactor,
        vectorFormat,
        setVectorFormat,
    })

    // Handle embedding generation for multi-vector search
    const handleEmbeddingGenerated = (embedding: number[]) => {
        // This function receives the COMBINED vector from MultiVectorInput 
        // Set it as the search query to trigger the search
        if (embedding && embedding.length > 0 && searchType === "Multi-vector") {
            console.log("Received combined vector in SearchBox, length:", embedding.length)
            const vectorStr = embedding.map((n) => n.toFixed(4)).join(", ")
            setSearchQuery(vectorStr)
        }
    }
    
    // For single vector search, don't interfere - let useVectorSearch handle it
    const handleSingleVectorEmbedding = () => {
        // The VectorSearchInput will show the embedding visually,
        // but useVectorSearch will generate its own embedding from the text
        // This function should NOT receive individual text embeddings from VectorSearchInput
    }

    // Determine if we should show the image uploader - always show for Vector searches
    const showImageUploader = searchType === "Vector"

    // Always show text input
    const showTextInput = true

    // Show shuffle button for Vector searches
    const showShuffleButton = searchType === "Vector"

    return (
        <section className="mb-2">
            <div className="bg-[white] rounded shadow-md p-2">
                <div className="p-1 flex flex-col gap-2 items-start">
                    <div className="flex gap-2 items-center w-full justify-between overflow-hidden">
                        {/* Search Type Selector */}
                        <SearchTypeSelector
                            searchType={searchType}
                            setSearchType={setSearchType}
                            metadata={metadata}
                            setSearchQuery={setSearchQuery}
                            searchCount={searchCount}
                            setSearchCount={setSearchCount}
                        />

                        {/* Settings Dropdown */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    className={`${
                                        searchOptions.showFilters
                                            ? "bg-gray-500 text-white"
                                            : ""
                                    }`}
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                        searchOptions.setShowFilters(
                                            !searchOptions.showFilters
                                        )
                                    }}
                                >
                                    <Filter className="h-3 w-3" />
                                </Button>
                            </div>
                            <SearchSettingsDropdown
                                showFilters={searchOptions.showFilters}
                                setShowFilters={searchOptions.setShowFilters}
                                showRedisCommand={
                                    searchOptions.showRedisCommand
                                }
                                setShowRedisCommand={
                                    searchOptions.setShowRedisCommand
                                }
                                setShowSearchOptions={
                                    searchOptions.setShowSearchOptions
                                }
                            />
                        </div>
                    </div>

                    {/* Search Input */}
                    {searchType === "Multi-vector" ? (
                        <MultiVectorInput
                            metadata={metadata}
                            dim={dim}
                            onVectorCombinationGenerated={
                                handleEmbeddingGenerated
                            }
                            triggerSearch={handleSingleVectorEmbedding}
                        />
                    ) : (
                        <VectorSearchInput
                            displayText={searchQuery}
                            onDisplayTextChange={setSearchQuery}
                            onEmbeddingGenerated={handleSingleVectorEmbedding}
                            metadata={metadata}
                            dim={dim}
                            searchType={searchType}
                            lastTextEmbedding={lastTextEmbedding}
                        />
                    )}

                    {/* Show error message if any */}
                    {error && (
                        <div className="text-destructive text-sm w-full bg-destructive/10 p-2 rounded flex items-start">
                            <span className="flex-1">{error}</span>
                            {clearError && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 -my-1 -mx-1"
                                    onClick={clearError}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Filter Section */}
                    {searchOptions.showFilters && (
                        <div className="flex items-center gap-2 w-full">
                            <div className="flex flex-1 items-center relative">
                                <FilterSection
                                    showFilters={searchOptions.showFilters}
                                    setShowFilters={
                                        searchOptions.setShowFilters
                                    }
                                    localFilter={searchOptions.localFilter}
                                    handleFilterChange={
                                        searchOptions.handleFilterChange
                                    }
                                    results={results}
                                    error={error || null}
                                    clearError={clearError}
                                    vectorSetName={vectorSetName}
                                />
                            </div>
                            <FilterHelpDialog
                                open={searchOptions.showFilterHelp}
                                onOpenChange={searchOptions.setShowFilterHelp}
                            />
                        </div>
                    )}

                    {/* Redis Command Box */}
                    {searchOptions.showRedisCommand && executedCommand && (
                        <div className="flex gap-2 items-center w-full">
                            <div className="flex-1">
                                <RedisCommandBox
                                    vectorSetName={vectorSetName}
                                    dim={dim}
                                    executedCommand={executedCommand}
                                    searchQuery={searchQuery}
                                    searchFilter={searchFilter}
                                    showRedisCommand={searchOptions.showRedisCommand}
                                />
                            </div>
                            {searchType === "Multi-vector" && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={handleSingleVectorEmbedding}
                                    title="Run command"
                                >
                                    <span className="text-xs">Run</span>
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Search Options Dialog */}
            <SearchOptionsDialog
                open={searchOptions.showSearchOptions}
                onOpenChange={searchOptions.setShowSearchOptions}
                useCustomEF={searchOptions.useCustomEF}
                efValue={searchOptions.efValue}
                handleEFToggle={searchOptions.handleEFToggle}
                handleEFValueChange={searchOptions.handleEFValueChange}
                useCustomFilterEF={searchOptions.useCustomFilterEF}
                filterEFValue={searchOptions.filterEFValue}
                handleFilterEFToggle={searchOptions.handleFilterEFToggle}
                handleFilterEFValueChange={
                    searchOptions.handleFilterEFValueChange
                }
                forceLinearScan={searchOptions.localForceLinearScan}
                handleForceLinearScanToggle={
                    searchOptions.handleForceLinearScanToggle
                }
                noThread={searchOptions.localNoThread}
                handleNoThreadToggle={searchOptions.handleNoThreadToggle}
                useWithAttribs={searchOptions.useWithAttribs}
                handleWithAttribsToggle={searchOptions.handleWithAttribsToggle}
                vectorFormat={searchOptions.vectorFormat}
                handleVectorFormatChange={searchOptions.handleVectorFormatChange}
                onDone={searchOptions.handleDoneButtonClick}
            />
        </section>
    )
}
