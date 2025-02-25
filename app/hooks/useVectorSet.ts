import { useState, useEffect } from "react"
import { vdim, vcard, vsim, vemb, vrem, vadd } from "../services/redis"
import { VectorSetMetadata } from "../types/embedding"

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
    handleAddVector: (elementId: string, elementData: string | number[]) => Promise<void>
    handleDeleteVector: (elementId: string) => Promise<void>
    handleShowVector: (elementId: string) => Promise<void>
    handleRowClick: (elementId: string) => Promise<string>
}

export function useVectorSet(): UseVectorSetReturn {
    const [vectorSetName, setVectorSetName] = useState<string | null>(null)
    const [dim, setDim] = useState<number | null>(null)
    const [recordCount, setRecordCount] = useState<number | null>(null)
    const [metadata, setMetadata] = useState<VectorSetMetadata | null>(null)
    const [statusMessage, setStatusMessage] = useState("")
    const [results, setResults] = useState<[string, number, number[]][]>([])

    // Load metadata when vector set changes
    const loadMetadata = async () => {
        console.log("[useVectorSet] Loading metadata for vector set:", vectorSetName);
        if (!vectorSetName) return;
        try {
            const response = await fetch("/api/redis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "getMetadata",
                    params: { keyName: vectorSetName },
                }),
            });
            if (!response.ok) throw new Error("Failed to load metadata");
            const data = await response.json();
            console.log("[useVectorSet] Loaded metadata:", data.result);
            if (data.success) {
                setMetadata(data.result);
            } else {
                console.error("[useVectorSet] No metadata found in response:", data);
                setMetadata(null);
            }
        } catch (error) {
            console.error("[useVectorSet] Error loading metadata:", error);
            setMetadata(null);
        }
    };

    // Load vector set data when name changes
    const loadVectorSet = async () => {
        console.log("[useVectorSet] Loading vector set:", vectorSetName);
        if (!vectorSetName) return;
        try {
            //setStatusMessage("Loading vector set...");
            const [dimensions, count] = await Promise.all([
                vdim(vectorSetName),
                vcard(vectorSetName),
            ]);
            setDim(dimensions);
            setRecordCount(count);
            await loadMetadata();
            setStatusMessage("");
        } catch (error) {
            console.error("[useVectorSet] Error loading vector set:", error);
            setStatusMessage(error instanceof Error ? error.message : "Error loading vector set");
        }
    };

    // Handle adding a new vector
    const handleAddVector = async (elementId: string, elementData: string | number[]) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            return
        }

        try {
            let vector: number[] = []
            if (Array.isArray(elementData)) {
                vector = elementData
            } else if (metadata?.embedding && metadata.embedding.provider !== 'none') {
                const response = await fetch("/api/embedding", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        text: elementData,
                        config: metadata.embedding,
                    }),
                })
                if (!response.ok) {
                    throw new Error("Failed to get embedding")
                }
                vector = await response.json()
            } else {
                throw new Error("No embedding provider configured. Please provide vector data directly.")
            }

            const result = await vadd(vectorSetName, elementId, vector)
            console.log("Created vector result:", result)
            setStatusMessage(`Vector created successfully: ${JSON.stringify(result)}`)

            // Add the new vector to the results list
            setResults(prevResults => [...prevResults, [elementId, 1.0, vector]])

            // Update the record count
            const count = await vcard(vectorSetName)
            setRecordCount(count)
        } catch (error) {
            console.error("Error creating vector:", error)
            throw new Error("Failed to create vector")
        }
    }

    // Handle deleting a vector
    const handleDeleteVector = async (elementId: string) => {
        if (!vectorSetName) return

        try {
            await vrem(vectorSetName, elementId)
            setStatusMessage(`Successfully deleted vector for element "${elementId}"`)
            // Remove the deleted item from results
            setResults(results.filter((row) => row[0] !== elementId))
            // Update the record count
            const count = await vcard(vectorSetName)
            setRecordCount(count)
        } catch (error) {
            console.error("Error deleting vector:", error)
            setStatusMessage(`Failed to delete vector for element "${elementId}"`)
        }
    }

    // Handle showing a vector
    const handleShowVector = async (elementId: string) => {
        if (!vectorSetName) return
        try {
            const vector = await vemb(vectorSetName, elementId)
            console.log("Vector:", vector)
            navigator.clipboard.writeText(vector.join(", "))
            setStatusMessage(`Vector for element "${elementId}" copied to clipboard`)
        } catch (error) {
            console.error("Error showing vector:", error)
            setStatusMessage(`Failed to load vector for element "${elementId}"`)
        }
    }

    // Handle row click for similarity search
    const handleRowClick = async (elementId: string) => {
        if (!vectorSetName) return
        try {
            const vector = await vemb(vectorSetName, elementId)
            const startTime = performance.now()
            const searchResult = await vsim(vectorSetName, vector, 10)
            const endTime = performance.now()
            const duration = (endTime - startTime).toFixed(2)
            
            // Just use the IDs and scores without fetching vectors
            const resultsWithoutVectors = searchResult.map(([id, score]) => 
                [id, score, []] as [string, number, number[]]
            );
            
            setResults(resultsWithoutVectors)
            // Don't show search time in status message anymore
            setStatusMessage("")
            
            // Return the duration so it can be stored in the state
            return duration
        } catch (error) {
            console.error("Error processing row click:", error)
            setStatusMessage("Failed to load vector and perform search for the selected row.")
            return "Error"
        }
    }

    // Load metadata when vector set changes
    useEffect(() => {
        console.log("USE EFFECT for vector set:", vectorSetName)
        
        if (vectorSetName) {
            loadMetadata()
            loadVectorSet()
        } else {
            setDim(null)
            setRecordCount(null)
            setMetadata(null)
        }
    }, [vectorSetName])

    return {
        vectorSetName,
        setVectorSetName,
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
        handleRowClick
    }
} 