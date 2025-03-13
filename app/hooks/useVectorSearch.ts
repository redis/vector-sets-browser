import { useState, useRef, useCallback, useEffect } from "react"
import { VectorSetMetadata } from "../types/embedding"
import { redisCommands } from "@/app/api/redis-commands"
import { embeddings } from "@/app/api/embeddings"
import { ApiError } from "@/app/api/client"
import { VectorTuple } from "@/app/api/types"

export interface VectorSetSearchState {
    searchType: "Vector" | "Element" | "Image"
    searchQuery: string
    searchCount: string
    resultsTitle: string
    searchTime?: string // Add searchTime to store the search duration
    searchFilter: string
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
}

export function useVectorSearch({
    vectorSetName,
    metadata,
    onSearchResults,
    onStatusChange,
    onError,
    onSearchStateChange,
    fetchEmbeddings = false
}: UseVectorSearchProps): UseVectorSearchReturn {
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState<string | null>(null) // Add error state
    const searchTimeoutRef = useRef<NodeJS.Timeout>()
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
    const handleError = useCallback((errorMessage: string) => {
        setError(errorMessage)
        if (onError) onError(errorMessage)
    }, [onError])

    // Function to perform a zero vector search
    const performZeroVectorSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return

            try {
                setIsSearching(true)
                // Clear any previous errors when starting a new search
                clearError()

                // Get dimension from Redis
                const dim = await redisCommands.vdim(vectorSetName)
                const zeroVector = Array(dim).fill(0)

                // Perform search using the server-side timing
                const vsimResponse = await redisCommands.vsim(
                    vectorSetName!,
                    zeroVector,
                    count,
                    fetchEmbeddings,
                    internalSearchState.searchFilter
                )
                
                // Use the execution time from the server response
                if (vsimResponse.executionTimeMs) {
                    const durationInSeconds = (vsimResponse.executionTimeMs / 1000).toFixed(4)
                    updateSearchState({ searchTime: durationInSeconds })
                }

                onStatusChange("")
                // Process results
                onSearchResults(vsimResponse.result)
            } catch (error) {
                console.error("Zero vector search error:", error)
                // Format the error as a string before passing to error handler
                const errorMessage = error instanceof Error ? error.message : String(error)
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
            updateSearchState,
            clearError,
            handleError,
        ]
    )

    // Reset when vectorSetName changes
    useEffect(() => {
        // Skip if this vectorSetName is already being processed
        if (vectorSetName && currentSearchVectorSetRef.current === vectorSetName) {
            return;
        }

        // Set current vector set being processed
        currentSearchVectorSetRef.current = vectorSetName;

        // Clear any pending searches
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Clear any previous errors
        clearError()

        // Save the current filter before resetting
        const currentFilter = internalSearchState.searchFilter;

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
        })

        onSearchStateChange({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: currentFilter, // Preserve the filter
            resultsTitle: "Search Results",
            searchTime: undefined,
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
            currentSearchVectorSetRef.current = null;
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
        if (!vectorSetName || !metadata) return

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // Use a longer timeout for filter changes to give users time to type
        const timeoutDuration = 
            lastSearchRef.current.filter !== internalSearchState.searchFilter ? 800 : 300;

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
            let errorMessage = "Search failed";
            if (error instanceof ApiError) {
                // Try to get the detailed error message
                errorMessage = error.message;
                
                // Log the full error data to help debug
                console.log("Full API error data:", error.data);
            } else if (error instanceof Error) {
                errorMessage = error.message;
            } else {
                errorMessage = String(error);
            }
            
            // Set the error state instead of using onStatusChange
            handleError(errorMessage);
            onSearchResults([]);
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
            if (!embedding) {
                console.error("Error getting embedding")
                return []
            } else {
                return embedding
            }
        },
        [metadata]
    )

    // Handle Vector type search
    const handleVectorSearch = useCallback(
        async (count: number) => {
            if (!vectorSetName) return

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
                searchString = `Results for Vector [${firstThreeNumbers}${
                    searchVector.length > 3 ? "..." : ""
                }]`
            } else {
                // Not a valid vector, try to convert text to vector
                updateSearchState({ resultsTitle: "Getting embedding..." })
                searchVector = await getVectorFromText(
                    internalSearchState.searchQuery
                )
                searchString = `Results for "${internalSearchState.searchQuery}"`
            }

            // Get and validate vector dimension
            // const expectedDim = await redisCommands.vdim(vectorSetName);
            // if (searchVector.length !== expectedDim) {
            //     throw new Error(`Vector dimension mismatch - expected ${expectedDim} but got ${searchVector.length}`);
            // }

            // Perform vector-based search and measure time
            const vsimResponse = await redisCommands.vsim(
                vectorSetName!,
                searchVector,
                count,
                fetchEmbeddings,
                internalSearchState.searchFilter
            )
            
            // Use the execution time from the server response
            if (vsimResponse.executionTimeMs) {
                const durationInSeconds = (vsimResponse.executionTimeMs / 1000).toFixed(4)
                updateSearchState({ searchTime: durationInSeconds })
            }

            // Update results title
            updateSearchState({ resultsTitle: searchString })

            // Process results
            onSearchResults(vsimResponse.result)

            onStatusChange(searchString)
        },
        [
            vectorSetName,
            internalSearchState.searchQuery,
            getVectorFromText,
            onSearchStateChange,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            internalSearchState.searchFilter,
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

            const vsimResponse = await redisCommands.vsim(
                vectorSetName!,
                internalSearchState.searchQuery,
                count,
                fetchEmbeddings,
                internalSearchState.searchFilter
            )
            
            // Use the execution time from the server response
            if (vsimResponse.executionTimeMs) {
                const durationInSeconds = (vsimResponse.executionTimeMs / 1000).toFixed(4)
                updateSearchState({ searchTime: durationInSeconds })
            }

            // Update results title
            updateSearchState({
                resultsTitle: `Results for "${internalSearchState.searchQuery}"`,
            })

            // Process results
            onSearchResults(vsimResponse.result)
        },
        [
            vectorSetName,
            internalSearchState.searchQuery,
            onSearchStateChange,
            onSearchResults,
            onStatusChange,
            fetchEmbeddings,
            internalSearchState.searchFilter,
            clearError,
        ]
    )

    // Main search function
    const performSearch = useCallback(async () => {
        // Skip if no vector set or if nothing has changed since last search
        if (
            !vectorSetName ||
            (lastSearchRef.current.query === internalSearchState.searchQuery &&
                lastSearchRef.current.type === internalSearchState.searchType &&
                lastSearchRef.current.count === internalSearchState.searchCount &&
                lastSearchRef.current.filter === internalSearchState.searchFilter)
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
            updateSearchState({ searchFilter: filter });
            
            // Also update the lastSearchRef to prevent immediate re-search
            lastSearchRef.current = {
                ...lastSearchRef.current,
                filter: filter
            };
        },
        searchCount: internalSearchState.searchCount,
        setSearchCount: (count) => updateSearchState({ searchCount: count }),
        isSearching,
        resultsTitle: internalSearchState.resultsTitle,
        setResultsTitle: (title) => updateSearchState({ resultsTitle: title }),
        searchTime: internalSearchState.searchTime,
        error, // Expose error state
        clearError, // Expose function to clear errors
    }
} 