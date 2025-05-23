import { Button } from "@/components/ui/button"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { Filter, X } from "lucide-react"
import { useCallback, useMemo } from "react"

import { VectorTuple } from "@/lib/redis-server/api"
import RedisCommandBox from "./RedisCommandBox"
import {
    isImageEmbedding,
    isMultiModalEmbedding,
} from "@/lib/embeddings/types/embeddingModels"

// Import custom hook
import useSearchOptions from "@/app/vectorset/hooks/useSearchOptions"

// Import components
import {
    FilterHelpDialog,
    FilterSection,
    SearchInput,
    SearchOptionsDialog,
    SearchSettingsDropdown,
    SearchTypeSelector,
} from "./SearchOptions"
import MultiVectorInput from "./SearchOptions/MultiVectorInput"
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
    })

    // Handle image selection for embedding generation
    const handleImageSelect = useCallback(
        (base64Data: string) => {
            // Only store the image data in memory for generating embeddings
            // We don't store it in the search query directly
        },
        []
    )

    // Handle embedding generation for vector search
    const handleEmbeddingGenerated = (embedding: number[]) => {
        // If embedding is valid, update search query with the vector
        if (embedding && embedding.length > 0) {
            const vectorStr = embedding
                .map((n) => n.toFixed(4))
                .join(", ")
                        
            // Set the search query with the vector representation
            setSearchQuery(vectorStr);
            
            // If this is a multi-vector search, log that we received a combined vector
            if (searchType === "Multi-vector") {
                
                // The MultiVectorInput component will call triggerSearch separately,
                // so we don't need to trigger a search here.
            }
        } 
    }

    // Function to explicitly trigger a search
    const triggerSearch = useCallback(() => {
        console.log("[SearchBox] Explicitly triggering search");
        
        // Add a small delay to ensure the search query has been updated
        setTimeout(() => {
            searchOptions.triggerSearchAfterOptionChange();
            console.log("[SearchBox] Search triggered via triggerSearchAfterOptionChange");
        }, 100);
    }, [searchOptions]);

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
                        <SearchSettingsDropdown
                            showFilters={searchOptions.showFilters}
                            setShowFilters={searchOptions.setShowFilters}
                            showRedisCommand={searchOptions.showRedisCommand}
                            setShowRedisCommand={
                                searchOptions.setShowRedisCommand
                            }
                            setShowSearchOptions={
                                searchOptions.setShowSearchOptions
                            }
                        />
                    </div>

                    {/* Search Input */}
                    {searchType === "Multi-vector" ? (
                        <MultiVectorInput
                            metadata={metadata}
                            dim={dim}
                            onVectorCombinationGenerated={handleEmbeddingGenerated}
                            triggerSearch={triggerSearch}
                        />
                    ) : (
                        <SearchInput
                            searchType={searchType}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            metadata={metadata}
                            dim={dim}
                            onImageSelect={handleImageSelect}
                            onImageEmbeddingGenerated={handleEmbeddingGenerated}
                            triggerSearch={triggerSearch}
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
                                    setShowFilters={searchOptions.setShowFilters}
                                    localFilter={searchOptions.localFilter}
                                    handleFilterChange={searchOptions.handleFilterChange}
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
                        <RedisCommandBox
                            vectorSetName={vectorSetName}
                            dim={dim}
                            executedCommand={executedCommand}
                            searchQuery={searchQuery}
                            searchFilter={searchFilter}
                            showRedisCommand={searchOptions.showRedisCommand}
                        />
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
                handleFilterEFValueChange={searchOptions.handleFilterEFValueChange}
                forceLinearScan={searchOptions.localForceLinearScan}
                handleForceLinearScanToggle={searchOptions.handleForceLinearScanToggle}
                noThread={searchOptions.localNoThread}
                handleNoThreadToggle={searchOptions.handleNoThreadToggle}
                useWithAttribs={searchOptions.useWithAttribs}
                handleWithAttribsToggle={searchOptions.handleWithAttribsToggle}
                onDone={searchOptions.handleDoneButtonClick}
            />
        </section>
    )
}
