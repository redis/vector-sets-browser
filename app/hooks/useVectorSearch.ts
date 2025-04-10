import { ApiError } from "@/app/api/client"
import { embeddings } from "@/app/embeddings/client"
import { VectorTuple, vdim, vsim, VsimResult } from "@/app/redis-server/api"
import { useCallback, useEffect, useRef, useState } from "react"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"

// Helper to convert VsimResult to VectorTuple array
const convertToVectorTuple = (results: VsimResult): VectorTuple[] => {
    return results.map(([element, score, vector, attributes]) => [element, score, vector, attributes]);
}

export interface VectorSetSearchState {
    searchType: "Vector" | "Element" | "Image"
    searchQuery: string
    searchCount: string
    resultsTitle: string
    searchTime?: string // Add searchTime to store the search duration
    searchFilter: string
    expansionFactor?: number // Add expansionFactor
    lastTextEmbedding?: number[] // Add lastTextEmbedding to store the last embedding vector for text
    executedCommand?: string
}

interface UseVectorSearchProps {
    vectorSetName: string | null
    metadata: VectorSetMetadata | null
    onSearchResults: (results: VectorTuple[]) => void
    onStatusChange: (status: string) => void
    onError?: (error: string | null) => void // Add dedicated error handler
    searchState: VectorSetSearchState
    onSearchStateChange: (state: Partial<VectorSetSearchState>) => void
    fetchEmbeddings?: boolean // Renamed from embeddings
}

interface UseVectorSearchReturn {
    searchType: "Vector" | "Element" | "Image"
    setSearchType: (type: "Vector" | "Element" | "Image") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    searchFilter: string
    setSearchFilter: (filter: string) => void
    searchCount: string
    setSearchCount: (count: string) => void
    isSearching: boolean
    resultsTitle: string
    setResultsTitle: (title: string) => void
    searchTime?: string
    error: string | null // Add error to the return type
    clearError: () => void // Add function to clear errors
    expansionFactor?: number // Add expansionFactor
    setExpansionFactor: (value: number | undefined) => void // Add setExpansionFactor
    lastTextEmbedding?: number[] // Add lastTextEmbedding to the return type
    executedCommand?: string
}

export function useVectorSearch({
    vectorSetName,
    metadata,
    onSearchResults,
    onStatusChange,
    onError,
    onSearchStateChange,
    fetchEmbeddings = false,
}: UseVectorSearchProps): UseVectorSearchReturn {
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
    const initialSearchDone = useRef(false)
    const lastSearchRef = useRef<{
        query: string
        type: "Vector" | "Element" | "Image"
        count: string
        filter: string
    }>({ query: "", type: "Vector", count: "10", filter: "" })
    // Add a ref to track the current vector set being searched
    const currentSearchVectorSetRef = useRef<string | null>(null)

    // Internal search state management
    const [internalSearchState, setInternalSearchState] =
        useState<VectorSetSearchState>({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: "",
            resultsTitle: "Search Results",
            searchTime: undefined,
            lastTextEmbedding: undefined,
        })
    // Handle search state updates
    const updateSearchState = useCallback(
        (update: Partial<VectorSetSearchState>) => {
            setInternalSearchState((prev) => {
                const next = { ...prev, ...update }
                onSearchStateChange(next)

                return next
            })
        },
        [onSearchStateChange]
    )

    // Function to clear error
    const clearError = useCallback(() => {
        setError(null)
        if (onError) onError(null)
    }, [onError])

    // Helper function to set error
    const handleError = useCallback(
        (errorMessage: string) => {
            setError(errorMessage)
            if (onError) onError(errorMessage)
        },
        [onError]
    )

    // Function to perform a zero vector search
    const performZeroVectorSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return

            try {
                setIsSearching(true)
                // Clear any previous errors when starting a new search
                clearError()

                const dimResponse = await vdim({ keyName: vectorSetName! })
                if (!dimResponse.success || dimResponse.result === undefined) {
                    handleError(dimResponse.error || "Failed to get vector dimensions")
                    return
                }
                const zeroVector = Array(dimResponse.result).fill(0)

                // Perform search using the server-side timing
                const vsimResponse = await vsim({
                    keyName: vectorSetName!,
                    searchVector: zeroVector,
                    count,
                    withEmbeddings: fetchEmbeddings,
                    filter: internalSearchState.searchFilter,
                    expansionFactor: internalSearchState.expansionFactor
                })

                if (!vsimResponse || !vsimResponse.success) {
                    handleError(vsimResponse?.error || "Zero vector search failed")
                    return
                }

                // Use the execution time from the server response
                if (vsimResponse.executionTimeMs) {
                    const durationInSeconds = (
                        vsimResponse.executionTimeMs / 1000
                    ).toFixed(4)
                    updateSearchState({ searchTime: durationInSeconds })
                }
                onStatusChange("")
                // Process results
                onSearchResults(convertToVectorTuple(vsimResponse.result || []))

                if (vsimResponse.executedCommand) {
                    updateSearchState({ executedCommand: vsimResponse.executedCommand })
                }
            } catch (error) {
                console.error("Zero vector search error:", error)
                // Format the error as a string before passing to error handler
                const errorMessage =
                    error instanceof Error ? error.message : String(error)
                handleError(errorMessage)
                onSearchResults([])
            } finally {
                setIsSearching(false)
            }
        },
        [
            vectorSetName,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            internalSearchState.searchFilter,
            internalSearchState.expansionFactor,
            clearError,
            handleError,
            updateSearchState,
        ]
    )

    // Reset when vectorSetName changes
    useEffect(() => {
        // Skip if this vectorSetName is already being processed
        if (
            vectorSetName &&
            currentSearchVectorSetRef.current === vectorSetName
        ) {
            return
        }

        // Set current vector set being processed
        currentSearchVectorSetRef.current = vectorSetName

        // Clear any pending searches
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Clear any previous errors
        clearError()

        // Save the current filter before resetting
        const currentFilter = internalSearchState.searchFilter

        // Reset internal state but preserve the filter
        initialSearchDone.current = false
        lastSearchRef.current = {
            query: "",
            type: "Vector",
            count: "10",
            filter: currentFilter, // Preserve the filter
        }

        setInternalSearchState({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: currentFilter, // Preserve the filter
            resultsTitle: "Search Results",
            searchTime: undefined,
            lastTextEmbedding: undefined,
        })

        onSearchStateChange({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: currentFilter, // Preserve the filter
            resultsTitle: "Search Results",
            searchTime: undefined,
            lastTextEmbedding: undefined,
        })

        // Clear results and status
        onSearchResults([])
        onStatusChange("")

        // Only perform zero vector search if we have a valid vector set
        if (vectorSetName) {
            setIsSearching(true)

            performZeroVectorSearch(10)
                .catch((error) => {
                    console.error("Zero vector search error:", error)
                    const errorMessage =
                        error instanceof Error ? error.message : String(error)
                    handleError(errorMessage)
                })
                .finally(() => {
                    setIsSearching(false)
                    // Clear the current search vector set when done
                    currentSearchVectorSetRef.current = null
                })
        } else {
            // Clear the current search vector set if no vector set name
            currentSearchVectorSetRef.current = null
        }
    }, [
        vectorSetName,
        onSearchResults,
        onStatusChange,
        onSearchStateChange,
        performZeroVectorSearch,
        clearError,
        handleError,
    ])

    // Debounced search effect
    useEffect(() => {
        if (!vectorSetName || !metadata) {
            return
        }

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Use a longer timeout for filter changes to give users time to type
        const timeoutDuration =
            lastSearchRef.current.filter !== internalSearchState.searchFilter
                ? 800
                : 300

        searchTimeoutRef.current = setTimeout(() => {
            performSearch()
        }, timeoutDuration)

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [
        vectorSetName,
        metadata,
        internalSearchState.searchQuery,
        internalSearchState.searchType,
        internalSearchState.searchCount,
        internalSearchState.searchFilter,
    ])

    // Helper function to parse count from string
    const parseCount = useCallback((countStr: string): number => {
        return parseInt(countStr, 10) || 10
    }, [])

    // Helper function to handle search errors
    const handleSearchError = useCallback(
        (error: unknown) => {
            console.error("Search error:", error)

            // Extract the error message, ensuring we get the actual Redis error
            let errorMessage = "Search failed"
            if (error instanceof ApiError) {
                // Try to get the detailed error message
                errorMessage = error.message

                // Log the full error data to help debug
                console.error("Full API error data:", error.data)
            } else if (error instanceof Error) {
                errorMessage = error.message
            } else {
                errorMessage = String(error)
            }

            // Set the error state instead of using onStatusChange
            handleError(errorMessage)
            onSearchResults([])
        },
        [handleError, onSearchResults]
    )

    // Function to get vector from text using embedding API
    const getVectorFromText = useCallback(
        async (text: string): Promise<number[]> => {
            if (
                !metadata?.embedding ||
                metadata.embedding.provider === "none"
            ) {
                throw new Error(
                    "Please enter valid vector data (comma-separated numbers) or configure an embedding engine"
                )
            }

            const embedding = await embeddings.getEmbedding(
                metadata.embedding,
                text
            )

            if (!embedding.success || !embedding.result) {
                console.error("Error getting embedding", embedding)
                return []
            } else {
                return embedding.result
            }
        },
        [metadata]
    )

    // Handle Vector type search
    const handleVectorSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return
            console.log("handleVectorSearch")
            // Clear any previous errors when starting a new search
            clearError()

            let searchVector: number[]

            // Try to parse as raw vector first
            const vectorData = internalSearchState.searchQuery
                .split(",")
                .map((n) => parseFloat(n.trim()))

            let searchString = ""
            if (!vectorData.some(isNaN)) {
                // Valid vector data
                searchVector = vectorData
                // Set status message to show the first 3 numbers of the vector
                const firstThreeNumbers = searchVector.slice(0, 3).join(", ")
                searchString = `Results for Vector [${firstThreeNumbers}${searchVector.length > 3 ? "..." : ""
                    }]`

                // Clear any previous text embedding since this is a raw vector search
                updateSearchState({ lastTextEmbedding: undefined })
            } else {
                // Not a valid vector, try to convert text to vector
                updateSearchState({ resultsTitle: "Getting embedding..." })
                searchVector = await getVectorFromText(
                    internalSearchState.searchQuery
                )
                searchString = `Results for "${internalSearchState.searchQuery}"`

                // Store the text embedding
                updateSearchState({ lastTextEmbedding: searchVector })
            }

            // Perform vector-based search and measure time
            const vsimResponse = await vsim({
                keyName: vectorSetName!,
                searchVector,
                count,
                withEmbeddings: fetchEmbeddings,
                filter: internalSearchState.searchFilter,
                expansionFactor: internalSearchState.expansionFactor
            })

            // Use the execution time from the server response
            if (vsimResponse.executionTimeMs) {
                const durationInSeconds = (
                    vsimResponse.executionTimeMs / 1000
                ).toFixed(4)
                updateSearchState({ searchTime: durationInSeconds })
            }

            // Update results title
            updateSearchState({ resultsTitle: searchString })

            // Process results
            onSearchResults(convertToVectorTuple(vsimResponse.result || []))

            onStatusChange(searchString)

            if (vsimResponse.executedCommand) {
                updateSearchState({ executedCommand: vsimResponse.executedCommand })
            }
        },
        [
            vectorSetName,
            internalSearchState.searchQuery,
            getVectorFromText,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            updateSearchState,
            internalSearchState.searchFilter,
            internalSearchState.expansionFactor,
            clearError,
        ]
    )

    // Handle Element type search
    const handleElementSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return

            // Clear any previous errors when starting a new search
            clearError()

            onStatusChange(`Element: "${internalSearchState.searchQuery}"`)

            const vsimResponse = await vsim({
                keyName: vectorSetName!,
                searchElement: internalSearchState.searchQuery,
                count,
                withEmbeddings: fetchEmbeddings,
                filter: internalSearchState.searchFilter,
                expansionFactor: internalSearchState.expansionFactor
            })

            // Use the execution time from the server response
            if (vsimResponse.executionTimeMs) {
                const durationInSeconds = (
                    vsimResponse.executionTimeMs / 1000
                ).toFixed(4)
                updateSearchState({ searchTime: durationInSeconds })
            }

            // Update results title
            updateSearchState({
                resultsTitle: `Results for "${internalSearchState.searchQuery}"`,
            })

            // Process results
            onSearchResults(convertToVectorTuple(vsimResponse.result || []))

            if (vsimResponse.executedCommand) {
                updateSearchState({ executedCommand: vsimResponse.executedCommand })
            }
        },
        [
            vectorSetName,
            internalSearchState.searchQuery,
            onSearchStateChange,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            internalSearchState.searchFilter,
            internalSearchState.expansionFactor,
            clearError,
        ]
    )

    // Handle Image search type - using the vector embedding generated from the image
    const handleImageSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return

            // Clear any previous errors when starting a new search
            clearError()

            try {
                // The searchQuery for images should already contain a vector representation
                // from the ImageUploader's onEmbeddingGenerated callback
                const vectorData = internalSearchState.searchQuery
                    .split(",")
                    .map((n) => parseFloat(n.trim()))

                // Check if we have valid vector data
                if (vectorData.some(isNaN)) {
                    //handleError("Invalid image embedding data")
                    return
                }

                // Check if the vector dimensions match the expected dimensions
                const expectedDimResponse = await vdim({ keyName: vectorSetName! })
                if (!expectedDimResponse.success || expectedDimResponse.result === undefined) {
                    handleError(expectedDimResponse.error || "Failed to get vector dimensions")
                    return
                }
                const expectedDim = expectedDimResponse.result

                // Log dimensions for debugging
                console.log(`Image embedding dimensions: ${vectorData.length}, Required: ${expectedDim}`)

                if (vectorData.length !== expectedDim) {
                    // Log detailed error
                    console.error(`Vector dimension mismatch: image embedding has ${vectorData.length} dimensions but vector set ${vectorSetName} requires ${expectedDim} dimensions`)
                    handleError(`Vector dimension mismatch: got ${vectorData.length}, need ${expectedDim}`)
                    return
                }

                // Set status message to show searching
                onStatusChange("Searching with image embedding...")
                updateSearchState({ resultsTitle: "Searching with image..." })

                // Perform vector-based search using the image embedding
                const vsimResponse = await vsim({
                    keyName: vectorSetName!,
                    searchVector: vectorData,
                    count,
                    withEmbeddings: fetchEmbeddings,
                    filter: internalSearchState.searchFilter,
                    expansionFactor: internalSearchState.expansionFactor
                })

                // Use the execution time from the server response
                if (vsimResponse.executionTimeMs) {
                    const durationInSeconds = (
                        vsimResponse.executionTimeMs / 1000
                    ).toFixed(4)
                    updateSearchState({ searchTime: durationInSeconds })
                }

                // Update results title
                updateSearchState({
                    resultsTitle: "Results for uploaded image"
                })

                // Process results
                onSearchResults(convertToVectorTuple(vsimResponse.result || []))
                onStatusChange("Image search complete")

                if (vsimResponse.executedCommand) {
                    updateSearchState({ executedCommand: vsimResponse.executedCommand })
                }
            } catch (error) {
                console.error("Image search error:", error)
                handleError(error instanceof Error ? error.message : String(error))
                onSearchResults([])
            }
        },
        [
            vectorSetName,
            internalSearchState.searchQuery,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            internalSearchState.searchFilter,
            internalSearchState.expansionFactor,
            clearError,
            handleError,
            updateSearchState,
        ]
    )

    // Main search function
    const performSearch = useCallback(async () => {
        // Skip if no vector set or if nothing has changed since last search
        if (
            !vectorSetName ||
            (lastSearchRef.current.query === internalSearchState.searchQuery &&
                lastSearchRef.current.type === internalSearchState.searchType &&
                lastSearchRef.current.count ===
                internalSearchState.searchCount &&
                lastSearchRef.current.filter ===
                internalSearchState.searchFilter)
        ) {
            return
        }

        // Update last search state without modifying the filter
        lastSearchRef.current = {
            query: internalSearchState.searchQuery,
            type: internalSearchState.searchType,
            count: internalSearchState.searchCount,
            filter: internalSearchState.searchFilter,
        }

        setIsSearching(true)
        // Clear any previous errors when starting a new search
        clearError()

        const count = parseCount(internalSearchState.searchCount)

        try {
            // If we have no query but have a filter, use zero vector search
            if (
                internalSearchState.searchType === "Vector" &&
                !internalSearchState.searchQuery.trim()
            ) {
                await performZeroVectorSearch(count)
            } else if (internalSearchState.searchType === "Vector") {
                await handleVectorSearch(count)
            } else if (internalSearchState.searchType === "Image") {
                await handleImageSearch(count)
            } else {
                await handleElementSearch(count)
            }
        } catch (error) {
            handleSearchError(error)
        } finally {
            setIsSearching(false)
        }
    }, [
        vectorSetName,
        internalSearchState,
        parseCount,
        handleSearchError,
        handleVectorSearch,
        handleElementSearch,
        handleImageSearch,
        performZeroVectorSearch,
        clearError,
    ])

    return {
        searchType: internalSearchState.searchType,
        setSearchType: (type) => updateSearchState({ searchType: type }),
        searchQuery: internalSearchState.searchQuery,
        setSearchQuery: (query) => updateSearchState({ searchQuery: query }),
        searchFilter: internalSearchState.searchFilter,
        setSearchFilter: (filter) => {
            // Update the internal state with the new filter
            updateSearchState({ searchFilter: filter })

            // Also update the lastSearchRef to prevent immediate re-search
            lastSearchRef.current = {
                ...lastSearchRef.current,
                filter: filter,
            }
        },
        searchCount: internalSearchState.searchCount,
        setSearchCount: (count) => updateSearchState({ searchCount: count }),
        isSearching,
        resultsTitle: internalSearchState.resultsTitle,
        setResultsTitle: (title) => updateSearchState({ resultsTitle: title }),
        searchTime: internalSearchState.searchTime,
        error, // Expose error state
        clearError, // Expose function to clear errors
        expansionFactor: internalSearchState.expansionFactor,
        setExpansionFactor: (value) =>
            updateSearchState({ expansionFactor: value }),
        lastTextEmbedding: internalSearchState.lastTextEmbedding, // Expose the last text embedding
        executedCommand: internalSearchState.executedCommand,
    }
}
