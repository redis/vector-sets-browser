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
    activeTab?: string // Add activeTab to track which tab is active
    searchTime?: string // Add searchTime to store the search duration
}

interface UseVectorSearchProps {
    vectorSetName: string | null
    metadata: VectorSetMetadata | null
    onSearchResults: (results: VectorTuple[]) => void
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

    // Helper function to handle search errors
    const handleSearchError = useCallback((error: unknown) => {
        console.error("Search error:", error);
        
        if (error instanceof ApiError) {
            if (error.message.includes("element not found in set")) {
                onStatusChange("Element not found");
            } else {
                onStatusChange(error.message);
            }
        } else {
            onStatusChange(error instanceof Error ? error.message : String(error));
        }
        
        onSearchResults([]);
    }, [onStatusChange, onSearchResults]);

    // Function to perform a zero vector search
    const performZeroVectorSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        try {
            setIsSearching(true);
            
            // Get dimension from Redis
            const dim = await redisCommands.vdim(vectorSetName);
            const zeroVector = Array(dim).fill(0);
            
            // Perform search and measure time
            const [vsimResults, duration] = await measureSearchTime(
                () => redisCommands.vsim(vectorSetName!, zeroVector, count, needVectors())
            );
            
            // Store search time in state
            onSearchStateChange({ searchTime: duration });
            
            // Process results
            onSearchResults(vsimResults);
            
        } catch (error) {
            console.error("Zero vector search error:", error);
            onStatusChange("Error performing zero vector search");
            onSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [vectorSetName, measureSearchTime, onSearchStateChange, onSearchResults, onStatusChange, needVectors]);

    // Function to get vector from text using embedding API
    const getVectorFromText = useCallback(async (text: string): Promise<number[]> => {
        if (!metadata?.embedding || metadata.embedding.provider === 'none') {
            throw new Error(
                "Please enter valid vector data (comma-separated numbers) or configure an embedding engine"
            );
        }
        
        const embedding = await embeddings.getEmbedding(metadata.embedding, text);
        if(!embedding) {
            console.error("Error getting embedding");
            return []
        } else {
            return embedding
        }

    }, [metadata]);

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
        const expectedDim = await redisCommands.vdim(vectorSetName);
        if (searchVector.length !== expectedDim) {
            throw new Error(`Vector dimension mismatch - expected ${expectedDim} but got ${searchVector.length}`);
        }

        // Perform vector-based search and measure time
        const [vsimResults, duration] = await measureSearchTime(
            () => redisCommands.vsim(vectorSetName!, searchVector, count, needVectors())
        );
        
        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Process results
        onSearchResults(vsimResults);
    }, [
        vectorSetName, 
        searchState.searchQuery, 
        getVectorFromText, 
        measureSearchTime, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange,
        needVectors
    ]);

    // Handle Element type search
    const handleElementSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        onStatusChange(`Element: "${searchState.searchQuery}"`);
        
        // Perform element-based search and measure time
        const [vsimResults, duration] = await measureSearchTime(
            () => redisCommands.vsim(vectorSetName!, searchState.searchQuery, count, needVectors())
        );
        
        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Process results
        onSearchResults(vsimResults);
    }, [
        vectorSetName, 
        searchState.searchQuery, 
        measureSearchTime, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange,
        needVectors
    ]);

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
        handleSearchError,
        handleVectorSearch,
        handleElementSearch
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