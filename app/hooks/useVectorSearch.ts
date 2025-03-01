import { useState, useRef, useCallback, useEffect } from "react"
import { vsim, vdim, vemb } from "../services/redis"
import { VectorSetMetadata } from "../types/embedding"

export interface VectorSetSearchState {
    searchType: "Vector" | "Element" | "Image"
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
    searchType: "Vector" | "Element" | "Image"
    setSearchType: (type: "Vector" | "Element" | "Image") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    searchCount: string
    setSearchCount: (count: string) => void
    isSearching: boolean
    resultsTitle: string
    setResultsTitle: (title: string) => void
}

// Helper types to make the code more readable
type SearchResult = [string, number]; // [id, score]
type SearchResultWithVector = [string, number, number[]]; // [id, score, vector]

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
        type: "Vector" | "Element" | "Image",
        count: string
    }>({ query: "", type: "Vector", count: "10" });

    // Reset initialSearchDone when vectorSetName changes
    useEffect(() => {
        initialSearchDone.current = false;
    }, [vectorSetName]);

    // Helper function to parse count from string
    const parseCount = useCallback((countStr: string): number => {
        return parseInt(countStr, 10) || 10;
    }, []);

    // Helper function to check if vectors need to be fetched
    const needVectors = useCallback((): boolean => {
        return searchState.activeTab === "visualize";
    }, [searchState.activeTab]);

    // Helper function to measure search time
    const measureSearchTime = useCallback(async <T>(searchFn: () => Promise<T>): Promise<[T, string]> => {
        const startTime = performance.now();
        const result = await searchFn();
        const endTime = performance.now();
        const duration = (endTime - startTime).toFixed(2);
        return [result, duration];
    }, []);

    // Helper function to process search results and fetch vectors if needed
    const processSearchResults = useCallback(async (
        results: SearchResult[],
        dimension: number
    ): Promise<SearchResultWithVector[]> => {
        if (!vectorSetName) {
            return [];
        }

        if (needVectors()) {
            // Fetch vectors for each result
            return Promise.all(
                results.map(async ([id, score]) => {
                    try {
                        const vector = await vemb(vectorSetName, id);
                        return [id, score, vector] as SearchResultWithVector;
                    } catch (error) {
                        console.error(`Failed to fetch vector for ${id}:`, error);
                        // Return a zero vector as fallback
                        return [id, score, Array(dimension).fill(0)] as SearchResultWithVector;
                    }
                })
            );
        } else {
            // Just pass IDs and scores with empty vectors
            return results.map(([id, score]) => 
                [id, score, []] as SearchResultWithVector
            );
        }
    }, [vectorSetName, needVectors]);

    // Helper function to handle search errors
    const handleSearchError = useCallback((error: unknown) => {
        console.error("Search error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        try {
            // Try to parse as JSON error
            const errorJson = JSON.parse(errorMessage);
            const parsedError = errorJson.error?.replace("Error: ", "") || errorMessage;
            
            if (parsedError.includes("ERR element not found in set")) {
                onStatusChange("Element not found");
            } else {
                onStatusChange(parsedError);
            }
        } catch {
            // If JSON parsing fails, check for specific error strings
            if (errorMessage.includes("ERR element not found in set")) {
                onStatusChange("Element not found");
            } else {
                onStatusChange(errorMessage);
            }
        }
        
        onSearchResults([]);
    }, [onStatusChange, onSearchResults]);

    // Function to perform a zero vector search
    const performZeroVectorSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        try {
            setIsSearching(true);
            
            // Get dimension from Redis
            const dim = await vdim(vectorSetName);
            const zeroVector = Array(dim).fill(0);
            
            // Perform search and measure time
            const [vsimResults, duration] = await measureSearchTime(
                () => vsim(vectorSetName!, zeroVector, count)
            );
            
            // Store search time in state
            onSearchStateChange({ searchTime: duration });
            
            // Process results
            const processedResults = await processSearchResults(vsimResults, dim);
            onSearchResults(processedResults);
            
        } catch (error) {
            console.error("Zero vector search error:", error);
            onStatusChange("Error performing zero vector search");
            onSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [vectorSetName, measureSearchTime, processSearchResults, onSearchStateChange, onSearchResults, onStatusChange]);

    // Function to get vector from text using embedding API
    const getVectorFromText = useCallback(async (text: string): Promise<number[]> => {
        if (!metadata?.embedding || metadata.embedding.provider === 'none') {
            throw new Error(
                "Please enter valid vector data (comma-separated numbers) or configure an embedding engine"
            );
        }
        
        const response = await fetch("/api/embedding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                config: metadata.embedding,
            }),
        });
        
        if (!response.ok) {
            throw new Error("Failed to get embedding for search text");
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || "Failed to get embedding for search text");
        }

        return data.embedding;
    }, [metadata]);

    // Main search function
    const performSearch = useCallback(async () => {
        // Skip if nothing has changed or no valid input
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

        setIsSearching(true);
        const count = parseCount(searchState.searchCount);

        try {
            // Handle different search types
            if (searchState.searchType === "Vector") {
                await handleVectorSearch(count);
            } else {
                await handleElementSearch(count);
            }
        } catch (error) {
            handleSearchError(error);
        } finally {
            setIsSearching(false);
        }
    }, [
        vectorSetName, 
        searchState, 
        parseCount, 
        handleSearchError
    ]);

    // Handle Vector type search
    const handleVectorSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        let searchVector: number[];
        
        // Try to parse as raw vector first
        const vectorData = searchState.searchQuery
            .split(",")
            .map((n) => parseFloat(n.trim()));
            
        if (!vectorData.some(isNaN)) {
            // Valid vector data
            searchVector = vectorData;
            // Set status message to show the first 3 numbers of the vector
            const firstThreeNumbers = searchVector.slice(0, 3).join(', ');
            onStatusChange(`Vector [${firstThreeNumbers}${searchVector.length > 3 ? '...' : ''}]`);
        } else {
            // Not a valid vector, try to convert text to vector
            onStatusChange(`"${searchState.searchQuery}"`);
            searchVector = await getVectorFromText(searchState.searchQuery);
        }

        // Get and validate vector dimension
        const expectedDim = await vdim(vectorSetName);
        if (searchVector.length !== expectedDim) {
            throw new Error(`Vector dimension mismatch - expected ${expectedDim} but got ${searchVector.length}`);
        }

        // Perform vector-based search and measure time
        const [vsimResults, duration] = await measureSearchTime(
            () => vsim(vectorSetName!, searchVector, count)
        );
        
        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Process results
        const processedResults = await processSearchResults(vsimResults, expectedDim);
        onSearchResults(processedResults);
    }, [
        vectorSetName, 
        searchState.searchQuery, 
        getVectorFromText, 
        measureSearchTime, 
        processSearchResults, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange
    ]);

    // Handle Element type search
    const handleElementSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        onStatusChange(`Element: "${searchState.searchQuery}"`);
        
        // Perform element-based search and measure time
        const [vsimResults, duration] = await measureSearchTime(
            () => vsim(vectorSetName!, searchState.searchQuery, count)
        );
        
        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Get dimension for fallback
        const dim = await vdim(vectorSetName);
        
        // Process results
        const processedResults = await processSearchResults(vsimResults, dim);
        onSearchResults(processedResults);
    }, [
        vectorSetName, 
        searchState.searchQuery, 
        measureSearchTime, 
        processSearchResults, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange
    ]);

    // Perform initial search when vector set changes
    useEffect(() => {
        const performInitialSearch = async () => {
            // Skip if no vector set selected or already done
            if (!vectorSetName || !metadata || initialSearchDone.current) {
                return;
            }

            // Mark as done immediately to prevent retries
            initialSearchDone.current = true;

            // Skip initial zero vector search if there's an existing search query
            if (!searchState.searchQuery.trim()) {
                await performZeroVectorSearch(parseCount(searchState.searchCount));
            } else {
                // If there's an existing search query, trigger the search directly
                await performSearch();
            }
        };
        
        performInitialSearch();
    }, [
        vectorSetName, 
        metadata, 
        searchState.searchQuery, 
        searchState.searchCount, 
        performZeroVectorSearch, 
        performSearch, 
        parseCount
    ]);

    // Debounced search effect for query changes
    useEffect(() => {
        // Skip if no vector set selected
        if (!vectorSetName) return;

        // Skip if nothing has changed
        if (lastSearchRef.current.query === searchState.searchQuery &&
            lastSearchRef.current.count === searchState.searchCount) {
            return;
        }

        // Clear any existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // If there's a search query, trigger the search with debounce
        if (searchState.searchQuery.trim()) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch();
            }, 300); // 300ms debounce delay
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [vectorSetName, searchState.searchQuery, searchState.searchCount, performSearch]);

    // Wrapper functions to update both local and parent state
    const setSearchType = (type: "Vector" | "Element" | "Image") => {
        onSearchStateChange({ searchType: type });
    };

    const setSearchQuery = (query: string) => {
        onSearchStateChange({ searchQuery: query });
    };

    const setSearchCount = (count: string) => {
        onSearchStateChange({ searchCount: count });
        
        // Trigger a search immediately when count changes
        if (vectorSetName) {
            // Clear any existing timeout
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            
            // If there's an existing search query, use performSearch
            if (searchState.searchQuery.trim()) {
                searchTimeoutRef.current = setTimeout(() => {
                    performSearch();
                }, 10); // Very short delay to ensure state is updated
            } 
            // Otherwise, perform a zero vector search with the new count
            // but only if we've already done the initial search
            else if (initialSearchDone.current) {
                searchTimeoutRef.current = setTimeout(() => {
                    performZeroVectorSearch(parseCount(count));
                }, 10);
            }
        }
    };

    const setResultsTitle = (title: string) => {
        onSearchStateChange({ resultsTitle: title });
    };

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
    };
} 