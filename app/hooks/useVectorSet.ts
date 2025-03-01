import { useState, useEffect, useRef } from "react"
import { VectorSetMetadata } from "../types/embedding"
import { validateAndNormalizeVector } from "../utils/vectorValidation"

interface UseVectorSetReturn {
    vectorSetName: string | null
    setVectorSetName: (name: string | null) => void
    dim: number | null
    recordCount: number | null
    metadata: VectorSetMetadata | null
    statusMessage: string
    results: [string, number, number[]][]
    setResults: (results: [string, number, number[]][]) => void
    loadVectorSet: () => Promise<void>
    handleAddVector: (element: string, elementData: string | number[]) => Promise<void>
    handleDeleteVector: (element: string) => Promise<void>
    handleShowVector: (element: string) => Promise<void>
    handleRowClick: (element: string) => Promise<string | undefined>
}

// Cache for vector set data to prevent unnecessary reloading
interface VectorSetCache {
    dim: number | null
    recordCount: number | null
    metadata: VectorSetMetadata | null
    loaded: boolean
}

export function useVectorSet(): UseVectorSetReturn {
    const [vectorSetName, setVectorSetName] = useState<string | null>(null)
    const [dim, setDim] = useState<number | null>(null)
    const [recordCount, setRecordCount] = useState<number | null>(null)
    const [metadata, setMetadata] = useState<VectorSetMetadata | null>(null)
    const [statusMessage, setStatusMessage] = useState("")
    const [results, setResults] = useState<[string, number, number[]][]>([])
    
    // Cache for vector set data
    const vectorSetCacheRef = useRef<Record<string, VectorSetCache>>({})

    // Load metadata when vector set changes
    const loadMetadata = async () => {
        if (!vectorSetName) return null;
        
        // Check if metadata is already cached
        const cache = vectorSetCacheRef.current[vectorSetName]
        if (cache?.metadata) {
            setMetadata(cache.metadata);
            return cache.metadata;
        }
        
        try {
            const response = await fetch("/api/vectorset/" + vectorSetName + "/metadata", {
                method: "GET",
            });
            if (!response.ok) throw new Error("Failed to load metadata");
            const data = await response.json();
            if (data.success) {
                const metadataResult = data.result;
                setMetadata(metadataResult);
                
                // Cache the metadata
                vectorSetCacheRef.current[vectorSetName] = {
                    ...vectorSetCacheRef.current[vectorSetName],
                    metadata: metadataResult,
                };
                
                return metadataResult;
            } else {
                console.error("[useVectorSet] No metadata found in response:", data);
                setMetadata(null);
                return null;
            }
        } catch (error) {
            console.error("[useVectorSet] Error loading metadata:", error);
            setMetadata(null);
            return null;
        }
    };

    // Load vector set data when name changes
    const loadVectorSet = async () => {
        if (!vectorSetName) return;
        
        // Check if vector set data is already cached
        const cache = vectorSetCacheRef.current[vectorSetName]
        if (cache?.loaded) {
            setDim(cache.dim);
            setRecordCount(cache.recordCount);
            setMetadata(cache.metadata);
            setStatusMessage("");
            return;
        }
        
        try {
            //setStatusMessage("Loading vector set...");
            const [dimResponse, cardResponse] = await Promise.all([
                fetch("/api/redis/command/vdim", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        keyName: vectorSetName,
                    }),
                }),
                fetch("/api/redis/command/vcard", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        keyName: vectorSetName,
                    }),
                }),
            ]);

            if (!dimResponse.ok || !cardResponse.ok) {
                throw new Error("Failed to load vector set data");
            }

            const [dimData, cardData] = await Promise.all([
                dimResponse.json(),
                cardResponse.json(),
            ]);

            if (!dimData.success || !cardData.success) {
                throw new Error(dimData.error || cardData.error || "Failed to load vector set data");
            }

            const dimValue = dimData.result;
            const recordCountValue = cardData.result;
            
            setDim(dimValue);
            setRecordCount(recordCountValue);
            
            // Load metadata if not already cached and get the result
            let metadataValue = cache?.metadata;
            if (!metadataValue) {
                metadataValue = await loadMetadata();
            }
            
            // Cache the vector set data with the correct metadata
            vectorSetCacheRef.current[vectorSetName] = {
                dim: dimValue,
                recordCount: recordCountValue,
                metadata: metadataValue,
                loaded: true,
            };
            
            setStatusMessage("");
        } catch (error) {
            console.error("[useVectorSet] Error loading vector set:", error);
            setStatusMessage(error instanceof Error ? error.message : "Error loading vector set");
        }
    };

    // Handle adding a new vector
    const handleAddVector = async (element: string, elementData: string | number[]) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            return
        }

        try {
            let vector: number[] = []
            let validationResult: any = null;
            
            if (Array.isArray(elementData)) {
                // Validate and normalize the raw vector data
                validationResult = validateAndNormalizeVector(elementData, 'unknown', dim || undefined);
                if (!validationResult.isValid) {
                    throw new Error(`Invalid vector data: ${validationResult.error}`);
                }
                vector = validationResult.vector;
            } else if (metadata?.embedding && metadata.embedding.provider !== 'none') {
                // Determine if we're using an image embedding model
                const isImageEmbedding = metadata.embedding.provider === 'image';
                
                // For image embeddings, we'll use the API endpoint which will handle
                // both server-side and client-side processing as needed
                const response = await fetch("/api/embedding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        // Send as imageData if using image embedding, otherwise as text
                        ...(isImageEmbedding ? { imageData: elementData } : { text: elementData }),
                        config: metadata.embedding,
                    }),
                })
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || "Failed to get embedding");
                }
                const data = await response.json()
                vector = data.embedding
            } else {
                throw new Error("No embedding provider configured. Please provide vector data directly.")
            }

            // Log validation details for debugging
            if (validationResult) {
                console.log('Vector validation result:', validationResult);
            }

            const addResponse = await fetch("/api/redis/command/vadd", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyName: vectorSetName,
                    element: element,
                    vector: vector,
                }),
            });

            if (!addResponse.ok) {
                throw new Error(`HTTP error! status: ${addResponse.status}`);
            }

            const addData = await addResponse.json();
            if (!addData.success) {
                throw new Error(addData.error || "Failed to add vector");
            }

            console.log("Created vector result:", addData.result);
            setStatusMessage(`Vector created successfully: ${JSON.stringify(addData.result)}`);

            // Add the new vector to the results list
            setResults(prevResults => [...prevResults, [element, 1.0, vector]]);

            // Update the record count
            const cardResponse = await fetch("/api/redis/command/vcard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyName: vectorSetName,
                }),
            });

            if (!cardResponse.ok) {
                throw new Error(`HTTP error! status: ${cardResponse.status}`);
            }

            const cardData = await cardResponse.json();
            if (cardData.success) {
                const newRecordCount = cardData.result;
                setRecordCount(newRecordCount);
                
                // Update the cache
                if (vectorSetCacheRef.current[vectorSetName]) {
                    vectorSetCacheRef.current[vectorSetName].recordCount = newRecordCount;
                }
            }
        } catch (error) {
            console.error("Error creating vector:", error)
            setStatusMessage(error instanceof Error ? error.message : "Failed to create vector")
            throw error
        }
    }

    // Handle deleting a vector
    const handleDeleteVector = async (element: string) => {
        if (!vectorSetName) return

        try {
            const remResponse = await fetch("/api/redis/command/vrem", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyName: vectorSetName,
                    element: element,
                }),
            });

            if (!remResponse.ok) {
                throw new Error(`HTTP error! status: ${remResponse.status}`);
            }

            const remData = await remResponse.json();
            if (!remData.success) {
                throw new Error(remData.error || "Failed to delete vector");
            }

            setStatusMessage(`Successfully deleted vector for element "${element}"`);
            
            // Remove the deleted item from results
            setResults(results.filter((row) => row[0] !== element));
            
            // Update the record count
            const cardResponse = await fetch("/api/redis/command/vcard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyName: vectorSetName,
                }),
            });

            if (!cardResponse.ok) {
                throw new Error(`HTTP error! status: ${cardResponse.status}`);
            }

            const cardData = await cardResponse.json();
            if (cardData.success) {
                const newRecordCount = cardData.result;
                setRecordCount(newRecordCount);
                
                // Update the cache
                if (vectorSetCacheRef.current[vectorSetName]) {
                    vectorSetCacheRef.current[vectorSetName].recordCount = newRecordCount;
                }
            }
        } catch (error) {
            console.error("Error deleting vector:", error)
            setStatusMessage(`Failed to delete vector for element "${element}"`)
        }
    }

    // Handle showing a vector
    const handleShowVector = async (element: string) => {
        if (!vectorSetName) return
        try {
            const embResponse = await fetch("/api/redis/command/vemb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keyName: vectorSetName,
                    element: element,
                }),
            });

            if (!embResponse.ok) {
                throw new Error(`HTTP error! status: ${embResponse.status}`);
            }

            const embData = await embResponse.json();
            if (!embData.success) {
                throw new Error(embData.error || "Failed to get vector");
            }

            const vector = embData.result;
            navigator.clipboard.writeText(vector.join(", "));
            setStatusMessage(`Vector for element "${element}" copied to clipboard`);
        } catch (error) {
            console.error("Error showing vector:", error)
            setStatusMessage(`Failed to load vector for element "${element}"`)
        }
    }

    // Clear state when changing vector sets
    const handleSetVectorSetName = (name: string | null) => {
        // If switching to a different vector set, clear the current results
        if (name !== vectorSetName) {
            setResults([]);
        }
        setVectorSetName(name);
    }

    // Load metadata and vector set data when vector set changes
    useEffect(() => {
        
        if (vectorSetName) {
            // Check if we already have cached data
            const cache = vectorSetCacheRef.current[vectorSetName]
            if (cache?.loaded) {
                setDim(cache.dim);
                setRecordCount(cache.recordCount);
                setMetadata(cache.metadata);
            } else {
                // Load data if not cached
                loadVectorSet()
            }
        } else {
            setDim(null)
            setRecordCount(null)
            setMetadata(null)
        }
    }, [vectorSetName])

    return {
        vectorSetName,
        setVectorSetName: handleSetVectorSetName,
        dim,
        recordCount,
        metadata,
        statusMessage,
        results,
        setResults,
        loadVectorSet,
        handleAddVector,
        handleDeleteVector,
        handleShowVector,
    }
} 