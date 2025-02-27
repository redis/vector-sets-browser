import { useState, useRef, useCallback, useEffect } from "react"
import { vsim, vdim, vemb } from "../services/redis"
import { VectorSetMetadata } from "../types/embedding"

export interface VectorSetSearchState {
    searchType: "Vector" | "Element"
    searchQuery: string
    searchCount: string
    resultsTitle: string
    activeTab?: string // Add activeTab to track which tab is active
    searchTime?: string // Add searchTime to store the search duration
}

interface UseVectorSearchProps {
    vectorSetName: string | null
    metadata: VectorSetMetadata | null
    onSearchResults: (results: [string, number, number[]][]) => void
    onStatusChange: (status: string) => void
    searchState: VectorSetSearchState
    onSearchStateChange: (state: Partial<VectorSetSearchState>) => void
}

interface UseVectorSearchReturn {
    searchType: "Vector" | "Element"
    setSearchType: (type: "Vector" | "Element") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    searchCount: string
    setSearchCount: (count: string) => void
    isSearching: boolean
    resultsTitle: string
    setResultsTitle: (title: string) => void
}

export function useVectorSearch({
    vectorSetName,
    metadata,
    onSearchResults,
    onStatusChange,
    searchState,
    onSearchStateChange
}: UseVectorSearchProps): UseVectorSearchReturn {
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout>()
    const initialSearchDone = useRef(false)
    const lastSearchRef = useRef<{
        query: string,
        type: "Vector" | "Element",
        count: string
    }>({ query: "", type: "Vector", count: "10" });

    // Wrapper functions to update both local and parent state
    const setSearchType = (type: "Vector" | "Element") => {
        onSearchStateChange({ searchType: type })
    }

    const setSearchQuery = (query: string) => {
        onSearchStateChange({ searchQuery: query })
    }

    const setSearchCount = (count: string) => {
        onSearchStateChange({ searchCount: count })
        
        // Trigger a search immediately when count changes
        if (vectorSetName) {
            // Clear any existing timeout
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
            
            // If there's an existing search query, use performSearch
            if (searchState.searchQuery.trim()) {
                searchTimeoutRef.current = setTimeout(() => {
                    performSearch()
                }, 10) // Very short delay to ensure state is updated
            } 
            // Otherwise, perform a zero vector search with the new count
            // but only if we've already done the initial search
            else if (initialSearchDone.current) {
                searchTimeoutRef.current = setTimeout(async () => {
                    try {
                        // Get dimension from Redis
                        const dim = await vdim(vectorSetName)
                        const zeroVector = Array(dim).fill(0)
                        const newCount = parseInt(count, 10) || 10
                        
                        setIsSearching(true)
                        const startTime = performance.now()
                        const vsimResults = await vsim(vectorSetName, zeroVector, newCount)
                        const endTime = performance.now()
                        const duration = (endTime - startTime).toFixed(2)
                        
                        // Store search time in state
                        onSearchStateChange({ searchTime: duration })
                        
                        // Only fetch vectors if we're on the visualization tab
                        const needVectors = searchState.activeTab === "visualize"
                        
                        if (needVectors) {
                            // Fetch vectors for each result
                            const resultsWithVectors = await Promise.all(
                                vsimResults.map(async ([id, score]) => {
                                    try {
                                        const vector = await vemb(vectorSetName, id);
                                        return [id, score, vector] as [string, number, number[]];
                                    } catch (error) {
                                        console.error(`Failed to fetch vector for ${id}:`, error);
                                        // Return a zero vector as fallback
                                        return [id, score, Array(dim).fill(0)] as [string, number, number[]];
                                    }
                                })
                            );
                            onSearchResults(resultsWithVectors)
                        } else {
                            // Just pass IDs and scores with empty vectors
                            const resultsWithoutVectors = vsimResults.map(([id, score]) => 
                                [id, score, []] as [string, number, number[]]
                            );
                            onSearchResults(resultsWithoutVectors)
                        }
                        
                        // Don't show search time in status message anymore
                        onStatusChange("")
                    } catch (error) {
                        console.error("Count change search error:", error)
                        onStatusChange("Error updating results count")
                    } finally {
                        setIsSearching(false)
                    }
                }, 10)
            }
        }
    }

    const setResultsTitle = (title: string) => {
        onSearchStateChange({ resultsTitle: title })
    }

    // Reset initialSearchDone when vectorSetName changes
    useEffect(() => {
        initialSearchDone.current = false;
    }, [vectorSetName]);

    // Debounced search function
    const performSearch = useCallback(async () => {
        console.log("performSearch", vectorSetName, searchState.searchQuery, searchState.searchType, searchState.searchCount)
        // Skip if nothing has changed
        if (!vectorSetName || !searchState.searchQuery.trim() ||
            (lastSearchRef.current.query === searchState.searchQuery &&
             lastSearchRef.current.type === searchState.searchType &&
             lastSearchRef.current.count === searchState.searchCount)) {
            return;
        }

        // Update last search state
        lastSearchRef.current = {
            query: searchState.searchQuery,
            type: searchState.searchType,
            count: searchState.searchCount
        };

        setIsSearching(true)

        try {
            let searchVector: number[]

            if (searchState.searchType === "Vector") {
                // Try to parse as raw vector first
                const vectorData = searchState.searchQuery
                    .split(",")
                    .map((n) => parseFloat(n.trim()))
                if (!vectorData.some(isNaN)) {
                    // Valid vector data
                    searchVector = vectorData
                    // Set status message to show the first 3 numbers of the vector
                    const firstThreeNumbers = searchVector.slice(0, 3).join(', ');
                    onStatusChange(`Vector [${firstThreeNumbers}${searchVector.length > 3 ? '...' : ''}]`);
                } else if (metadata?.embedding && metadata.embedding.provider !== 'none') {
                    // Not a valid vector, but we have an embedding engine - try to convert text to vector
                    // Set status message to the search term
                    onStatusChange(`Results for "${searchState.searchQuery}"`);
                    
                    // Determine if we're using an image embedding model
                    const isImageEmbedding = metadata.embedding.provider === 'image';
                    
                    // If this is an image embedding model, check if the query is a base64 image
                    const isBase64Image = isImageEmbedding && 
                        (searchState.searchQuery.startsWith('data:image') || 
                         /^[A-Za-z0-9+/=]+$/.test(searchState.searchQuery));
                    
                    const response = await fetch("/api/embedding", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            text: searchState.searchQuery,
                            config: metadata.embedding,
                        }),
                    })
                    if (!response.ok) {
                        throw new Error("Failed to get embedding for search text")
                    }

                    const data = await response.json()
                    if (!data.success) {
                        throw new Error(data.error || "Failed to get embedding for search text")
                    }

                    searchVector = data.embedding
                } else {
                    throw new Error(
                        "Please enter valid vector data (comma-separated numbers) or configure an embedding engine"
                    )
                }

                // Get and validate vector dimension
                const expectedDim = await vdim(vectorSetName)
                if (searchVector.length !== expectedDim) {
                    throw new Error(`Vector dimension mismatch - expected ${expectedDim} but got ${searchVector.length}`)
                }

                // Perform vector-based search
                const startTime = performance.now()
                const count = parseInt(searchState.searchCount, 10) || 10
                const vsimResults = await vsim(vectorSetName, searchVector, count)
                const endTime = performance.now()
                const duration = (endTime - startTime).toFixed(2)

                // Store search time in state
                onSearchStateChange({ searchTime: duration })

                // Only fetch vectors if we're on the visualization tab
                const needVectors = searchState.activeTab === "visualize"
                
                if (needVectors) {
                    // Fetch vectors for each result
                    const resultsWithVectors = await Promise.all(
                        vsimResults.map(async ([id, score]) => {
                            try {
                                const vector = await vemb(vectorSetName, id);
                                return [id, score, vector] as [string, number, number[]];
                            } catch (error) {
                                console.error(`Failed to fetch vector for ${id}:`, error);
                                // Return a zero vector as fallback
                                return [id, score, Array(expectedDim).fill(0)] as [string, number, number[]];
                            }
                        })
                    );
                    onSearchResults(resultsWithVectors)
                } else {
                    // Just pass IDs and scores with empty vectors
                    const resultsWithoutVectors = vsimResults.map(([id, score]) => 
                        [id, score, []] as [string, number, number[]]
                    );
                    onSearchResults(resultsWithoutVectors)
                }
                
                // Don't clear the status message anymore since we want to show the search term
                // onStatusChange("")
            } else {
                // Element search - directly use the element name
                // Set status message to the search term
                onStatusChange(`Results for element: "${searchState.searchQuery}"`);
                
                try {
                    const startTime = performance.now()
                    const count = parseInt(searchState.searchCount, 10) || 10
                    const vsimResults = await vsim(vectorSetName, searchState.searchQuery, count)
                    const endTime = performance.now()
                    const duration = (endTime - startTime).toFixed(2)

                    // Store search time in state
                    onSearchStateChange({ searchTime: duration })
                    
                    // Only fetch vectors if we're on the visualization tab
                    const needVectors = searchState.activeTab === "visualize"
                    
                    if (needVectors) {
                        // Get dimension for fallback
                        const dim = await vdim(vectorSetName);
                        
                        // Fetch vectors for each result
                        const resultsWithVectors = await Promise.all(
                            vsimResults.map(async ([id, score]) => {
                                try {
                                    const vector = await vemb(vectorSetName, id);
                                    return [id, score, vector] as [string, number, number[]];
                                } catch (error) {
                                    console.error(`Failed to fetch vector for ${id}:`, error);
                                    // Return a zero vector as fallback
                                    return [id, score, Array(dim).fill(0)] as [string, number, number[]];
                                }
                            })
                        );
                        onSearchResults(resultsWithVectors)
                    } else {
                        // Just pass IDs and scores with empty vectors
                        const resultsWithoutVectors = vsimResults.map(([id, score]) => 
                            [id, score, []] as [string, number, number[]]
                        );
                        onSearchResults(resultsWithoutVectors)
                    }
                    
                    // Don't clear the status message anymore since we want to show the search term
                    // onStatusChange("")
                } catch (error) {
                    // Parse error message from JSON response
                    const errorMessage = error instanceof Error ? error.message : String(error)
                    try {
                        const errorJson = JSON.parse(errorMessage)
                        if (errorJson.error?.includes("ERR element not found in set")) {
                            onStatusChange("Element not found")
                            onSearchResults([])
                            return
                        }
                        throw new Error(errorJson.error)
                    } catch {
                        // If JSON parsing fails, use original error
                        if (errorMessage.includes("ERR element not found in set")) {
                            onStatusChange("Element not found")
                            onSearchResults([])
                            return
                        }
                        throw error
                    }
                }
            }
        } catch (error: unknown) {
            console.error("Search error:", error)
            // Parse error message from JSON response for other errors too
            const errorMessage = error instanceof Error ? error.message : String(error)
            try {
                const errorJson = JSON.parse(errorMessage)
                onStatusChange(errorJson.error?.replace("Error: ", "") || errorMessage)
            } catch {
                onStatusChange(errorMessage)
            }
            onSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }, [vectorSetName, searchState, metadata, onSearchResults, onStatusChange])

    // Perform initial zero vector search without setting the search query
    useEffect(() => {
        const performInitialSearch = async () => {
            // Skip if no vector set selected
            if (!vectorSetName || !metadata || initialSearchDone.current) {
                return;
            }

            // Mark as done immediately to prevent retries
            initialSearchDone.current = true;

            // Skip initial zero vector search if there's an existing search query
            if (!searchState.searchQuery.trim()) {
                try {
                    // Get dimension from Redis
                    const dim = await vdim(vectorSetName)
                    const zeroVector = Array(dim).fill(0)
                    const count = parseInt(searchState.searchCount, 10) || 10
                    
                    // Set status message for zero vector search
                    onStatusChange(``);
                    
                    const startTime = performance.now()
                    const vsimResults = await vsim(vectorSetName, zeroVector, count)
                    const endTime = performance.now()
                    const duration = (endTime - startTime).toFixed(2)
                    
                    // Store search time in state
                    onSearchStateChange({ searchTime: duration })
                    
                    // Only fetch vectors if we're on the visualization tab
                    const needVectors = searchState.activeTab === "visualize"
                    
                    if (needVectors) {
                        // Fetch vectors for each result
                        const resultsWithVectors = await Promise.all(
                            vsimResults.map(async ([id, score]) => {
                                try {
                                    const vector = await vemb(vectorSetName, id);
                                    return [id, score, vector] as [string, number, number[]];
                                } catch (error) {
                                    console.error(`Failed to fetch vector for ${id}:`, error);
                                    // Return a zero vector as fallback
                                    return [id, score, Array(dim).fill(0)] as [string, number, number[]];
                                }
                            })
                        );
                        onSearchResults(resultsWithVectors)
                    } else {
                        // Just pass IDs and scores with empty vectors
                        const resultsWithoutVectors = vsimResults.map(([id, score]) => 
                            [id, score, []] as [string, number, number[]]
                        );
                        onSearchResults(resultsWithoutVectors)
                    }
                    
                    // Don't clear the status message anymore since we want to show the search term
                    // onStatusChange("")
                } catch (error) {
                    console.error("Initial search error:", error)
                    onSearchResults([])
                    onStatusChange("Error performing initial search")
                }
            } else {
                // If there's an existing search query, trigger the search directly
                performSearch();
            }
        }
        performInitialSearch()
    }, [vectorSetName, metadata, searchState.searchCount, searchState.searchQuery, onSearchResults, onStatusChange, performSearch])

    // Effect to trigger search when query changes or when switching back to a vector set with a search
    useEffect(() => {
        // Skip if no vector set selected
        if (!vectorSetName) return;

        // Skip if nothing has changed and we've already done this search
        if (lastSearchRef.current.query === searchState.searchQuery &&
            lastSearchRef.current.count === searchState.searchCount) {
            return;
        }

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current)
        }

        // If there's a search query, trigger the search
        if (searchState.searchQuery.trim()) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch()
            }, 300) // 300ms delay
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
        }
    }, [vectorSetName, searchState.searchQuery, searchState.searchCount, performSearch])

    return {
        searchType: searchState.searchType,
        setSearchType,
        searchQuery: searchState.searchQuery,
        setSearchQuery,
        searchCount: searchState.searchCount,
        setSearchCount,
        isSearching,
        resultsTitle: searchState.resultsTitle,
        setResultsTitle
    }
} 