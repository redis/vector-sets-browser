import { Button } from "@/components/ui/button"
import { type VectorSetMetadata } from "@/lib/types/vectors"
import { Filter, X } from "lucide-react"
import { useCallback } from "react"

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

    // Handle image embedding generation - memoized to prevent unnecessary recreations
    const handleImageSelect = useCallback(
        (base64Data: string) => {
            // Only change search type if we have image data and aren't already in an image mode
            if (
                base64Data &&
                !["Image", "TextAndImage", "ImageOrVector"].includes(searchType)
            ) {
                // For multi-modal models, use TextAndImage search type
                if (
                    metadata?.embedding &&
                    isMultiModalEmbedding(metadata.embedding)
                ) {
                    setSearchType("TextAndImage")
                }
                // For image-only models, use Image search type
                else if (
                    metadata?.embedding &&
                    isImageEmbedding(metadata.embedding)
                ) {
                    setSearchType("Image")
                }
            }

            // Don't set the base64 image data as the search query
            // The embedding will be handled by the handleImageEmbeddingGenerated function
        },
        [setSearchType, searchType, metadata]
    )

    const handleImageEmbeddingGenerated = useCallback(
        (embedding: number[]) => {
            // Set search query to a vector representation (needed for the search)
            setSearchQuery(embedding.join(", "))
        },
        [setSearchQuery]
    )

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

                    <div className="flex flex-col gap-2 grow w-full">
                        {/* Search Input */}
                        <div className="relative flex gap-2">
                            <SearchInput
                                searchType={searchType}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                metadata={metadata}
                                dim={dim}
                                onImageSelect={handleImageSelect}
                                onImageEmbeddingGenerated={
                                    handleImageEmbeddingGenerated
                                }
                            />

                            {/* Filter Button - Only shown for non-image searches */}
                            <Button
                                variant="outline"
                                size="icon"
                                className={`h-9 ${
                                    searchOptions.showFilters
                                        ? "bg-gray-500 hover:bg-gray-600 text-white"
                                        : "bg-[white] hover:bg-gray-100"
                                }`}
                                onClick={() =>
                                    searchOptions.setShowFilters(
                                        !searchOptions.showFilters
                                    )
                                }
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Filter Section */}
                        {searchOptions.showFilters && (
                            <div className="flex gap-2 items-center w-full mt-2 border-t pt-3">
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
                        )}
                    </div>
                </div>
                {/* Redis Command Box */}
                {searchOptions.showRedisCommand && (
                    <div className="bg-muted px-2 w-full rounded flex flex-col items-start mt-2">
                        <div className="flex items-center w-full">
                            <label className="text-xs font-medium text-muted-foreground">
                                Executed Redis Command:
                            </label>

                            <div className="grow"></div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                    searchOptions.setShowRedisCommand(false)
                                }
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </Button>
                        </div>
                        <RedisCommandBox
                            vectorSetName={vectorSetName}
                            dim={dim}
                            executedCommand={executedCommand}
                            searchQuery={searchQuery}
                            searchFilter={searchOptions.localFilter}
                            showRedisCommand={searchOptions.showRedisCommand}
                        />
                    </div>
                )}
            </div>
            {/* Filter Help Dialog */}
            <FilterHelpDialog
                open={searchOptions.showFilterHelp}
                onOpenChange={searchOptions.setShowFilterHelp}
            />

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
                onDone={searchOptions.handleDoneButtonClick}
            />
        </section>
    )
}
