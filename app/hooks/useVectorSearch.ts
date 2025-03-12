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
}

export function useVectorSearch({
    vectorSetName,
    metadata,
    onSearchResults,
    onStatusChange,
    onSearchStateChange,
    fetchEmbeddings = false
}: UseVectorSearchProps): UseVectorSearchReturn {
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<NodeJS.Timeout>()
    const initialSearchDone = useRef(false)
    const lastSearchRef = useRef<{
        query: string,
        type: "Vector" | "Element" | "Image",
        count: string,
        filter: string
    }>({ query: "", type: "Vector", count: "10", filter: "" });

    // Internal search state management
    const [internalSearchState, setInternalSearchState] = useState<VectorSetSearchState>({
        searchType: "Vector",
        searchQuery: "",
        searchCount: "10",
        searchFilter: "",
        resultsTitle: "Search Results"
    });

    // Reset when vectorSetName changes
    useEffect(() => {
        // Clear any pending searches
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Reset internal state
        initialSearchDone.current = false;
        lastSearchRef.current = { query: "", type: "Vector", count: "10", filter: "" };
        setInternalSearchState({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: "",
            resultsTitle: "Search Results"
        });

        onSearchStateChange({
            searchType: "Vector",
            searchQuery: "",
            searchCount: "10",
            searchFilter: "",
            resultsTitle: "Search Results"
        });
        
        // Clear results and status
        onSearchResults([]);
        onStatusChange("");

        // Only perform zero vector search if we have a valid vector set
        if (vectorSetName && metadata) {
            setIsSearching(true);
            performZeroVectorSearch(10)
                .catch(error => {
                    console.error("Zero vector search error:", error);
                    onStatusChange("Error performing initial search");
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }
    }, [vectorSetName, metadata, onSearchResults, onStatusChange]);

    // Handle search state updates
    const updateSearchState = useCallback((update: Partial<VectorSetSearchState>) => {
        setInternalSearchState(prev => {
            const next = { ...prev, ...update };
            onSearchStateChange(next);
            return next;
        });
    }, [onSearchStateChange]);

    // Debounced search effect
    useEffect(() => {
        if (!vectorSetName || !metadata) return;

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        searchTimeoutRef.current = setTimeout(() => {
            performSearch();
        }, 300);

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [vectorSetName, metadata, internalSearchState.searchQuery, internalSearchState.searchType, internalSearchState.searchCount, internalSearchState.searchFilter]);

    // Helper function to parse count from string
    const parseCount = useCallback((countStr: string): number => {
        return parseInt(countStr, 10) || 10;
    }, []);

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
                () => redisCommands.vsim(vectorSetName!, zeroVector, count, fetchEmbeddings, internalSearchState.searchFilter)
            );
            // Store search time in state
            onSearchStateChange({ searchTime: duration });
            
            onStatusChange("")
            // Process results
            onSearchResults(vsimResults);
            
        } catch (error) {
            console.error("Zero vector search error:", error);
            onStatusChange("Error performing zero vector search");
            onSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    }, [vectorSetName, measureSearchTime, onSearchStateChange, onSearchResults, onStatusChange, fetchEmbeddings]);

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
        const vectorData = internalSearchState.searchQuery
            .split(",")
            .map((n) => parseFloat(n.trim()));
            
        let searchString = ""
        if (!vectorData.some(isNaN)) {
            // Valid vector data
            searchVector = vectorData;
            // Set status message to show the first 3 numbers of the vector
            const firstThreeNumbers = searchVector.slice(0, 3).join(', ');
            searchString = `Results for Vector [${firstThreeNumbers}${searchVector.length > 3 ? '...' : ''}]`
        } else {
            // Not a valid vector, try to convert text to vector
            searchVector = await getVectorFromText(internalSearchState.searchQuery);
            searchString = `Results for "${internalSearchState.searchQuery}"`
        }

        // Get and validate vector dimension
        const expectedDim = await redisCommands.vdim(vectorSetName);
        if (searchVector.length !== expectedDim) {
            throw new Error(`Vector dimension mismatch - expected ${expectedDim} but got ${searchVector.length}`);
        }

        // Perform vector-based search and measure time
        const [vsimResults, duration] = await measureSearchTime(
            () => redisCommands.vsim(vectorSetName!, searchVector, count, fetchEmbeddings, internalSearchState.searchFilter)
        );
        console.log("[useVectorSearch] Vector-based search = embeddings: ", fetchEmbeddings);
        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Process results
        onSearchResults(vsimResults);

        onStatusChange(searchString)

    }, [
        vectorSetName, 
        internalSearchState.searchQuery, 
        getVectorFromText, 
        measureSearchTime, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange,
        fetchEmbeddings,
        internalSearchState.searchFilter
    ]);

    // Handle Element type search
    const handleElementSearch = useCallback(async (count: number) => {
        if (!vectorSetName) return;
        
        onStatusChange(`Element: "${internalSearchState.searchQuery}"`);
        
        const [vsimResults, duration] = await measureSearchTime(
            () => redisCommands.vsim(vectorSetName!, internalSearchState.searchQuery, count, fetchEmbeddings, internalSearchState.searchFilter  )
        );
        console.log("[useVectorSearch] Element-based search = embeddings: ", fetchEmbeddings);

        // Store search time in state
        onSearchStateChange({ searchTime: duration });
        
        // Process results
        onSearchResults(vsimResults);
    }, [
        vectorSetName, 
        internalSearchState.searchQuery, 
        measureSearchTime, 
        onSearchStateChange, 
        onSearchResults, 
        onStatusChange,
        fetchEmbeddings,
        internalSearchState.searchFilter
    ]);

    // Main search function
    const performSearch = useCallback(async () => {
        // Skip if no vector set or if nothing has changed since last search
        if (!vectorSetName || 
            (lastSearchRef.current.query === internalSearchState.searchQuery &&
             lastSearchRef.current.type === internalSearchState.searchType &&
             lastSearchRef.current.count === internalSearchState.searchCount &&
             lastSearchRef.current.filter === internalSearchState.searchFilter)) {
            return;
        }

        // Update last search state
        lastSearchRef.current = {
            query: internalSearchState.searchQuery,
            type: internalSearchState.searchType,
            count: internalSearchState.searchCount,
            filter: internalSearchState.searchFilter
        };

        setIsSearching(true);
        const count = parseCount(internalSearchState.searchCount);

        try {
            // If we have no query but have a filter, use zero vector search
            if (internalSearchState.searchType === "Vector" && !internalSearchState.searchQuery.trim()) {
                await performZeroVectorSearch(count);
            } else if (internalSearchState.searchType === "Vector") {
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
        internalSearchState, 
        parseCount, 
        handleSearchError,
        handleVectorSearch,
        handleElementSearch,
        performZeroVectorSearch
    ]);

    return {
        searchType: internalSearchState.searchType,
        setSearchType: (type) => updateSearchState({ searchType: type }),
        searchQuery: internalSearchState.searchQuery,
        setSearchQuery: (query) => updateSearchState({ searchQuery: query }),
        searchFilter: internalSearchState.searchFilter,
        setSearchFilter: (filter) => updateSearchState({ searchFilter: filter }),
        searchCount: internalSearchState.searchCount,
        setSearchCount: (count) => updateSearchState({ searchCount: count }),
        isSearching,
        resultsTitle: internalSearchState.resultsTitle,
        setResultsTitle: (title) => updateSearchState({ resultsTitle: title }),
        searchTime: internalSearchState.searchTime
    };
} 