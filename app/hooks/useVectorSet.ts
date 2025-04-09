import { ApiError } from "@/app/api/client"
import { vectorSets } from "@/app/api/vector-sets"
import { embeddings } from "@/app/embeddings/client"
import { getExpectedDimensions } from "@/app/embeddings/types/embeddingModels"
import {
    VectorTuple,
    vadd,
    vcard,
    vemb,
    vgetattr,
    vinfo,
    vrem
} from "@/app/redis-server/api"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"

import { validateVector } from "@/app/embeddings/utils/validation"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { useEffect, useRef, useState, useCallback } from "react"

interface UseVectorSetReturn {
    vectorSetName: string | null
    setVectorSetName: (name: string | null) => void
    dim: number | null
    recordCount: number | null
    metadata: VectorSetMetadata | null
    setMetadata: (metadata: VectorSetMetadata | null) => void
    statusMessage: string
    results: VectorTuple[]
    setResults: (results: VectorTuple[]) => void
    loadVectorSet: () => Promise<void>
    handleAddVector: (
        element: string,
        elementData: string | number[],
        useCAS?: boolean
    ) => Promise<void>
    handleDeleteVector: (element: string) => Promise<void>
    handleDeleteVector_multi: (elements: string[]) => Promise<void>
    handleShowVector: (element: string) => Promise<number[] | null>
    updateMetadata: (newMetadata: VectorSetMetadata) => Promise<void>
}

// Cache for vector set data to prevent unnecessary reloading
interface VectorSetCache {
    dim: number | null
    recordCount: number | null
    metadata: VectorSetMetadata | null
    loaded: boolean
}

const useVectorSet = (): UseVectorSetReturn => {
    const [vectorSetName, setVectorSetName] = useState<string | null>(null)
    const [dim, setDim] = useState<number | null>(null)
    const [recordCount, setRecordCount] = useState<number | null>(null)
    const [metadata, setMetadata] = useState<VectorSetMetadata | null>(null)
    const [statusMessage, setStatusMessage] = useState("")
    const [results, setResults] = useState<VectorTuple[]>([])

    // Cache for vector set data
    const vectorSetCacheRef = useRef<Record<string, VectorSetCache>>({})

    // Load metadata when vector set changes
    const loadMetadata = useCallback(async () => {
        if (!vectorSetName) return null

        // Check if metadata is already cached
        const cache = vectorSetCacheRef.current[vectorSetName]
        if (cache?.metadata) {
            setMetadata(cache.metadata)
            return cache.metadata
        }

        try {
            const metadataResult = await vectorSets.getMetadata(vectorSetName)
            setMetadata(metadataResult)

            // Cache the metadata
            vectorSetCacheRef.current[vectorSetName] = {
                ...vectorSetCacheRef.current[vectorSetName],
                metadata: metadataResult,
            }

            return metadataResult
        } catch (error) {
            console.error("[useVectorSet] Error loading metadata:", error)
            setMetadata(null)
            return null
        }
    }, [vectorSetName])

    // Load vector set data when name changes
    const loadVectorSet = useCallback(async () => {
        if (!vectorSetName) return

        try {
            // Clear any previous results
            setResults([])

            // Set status message
            setStatusMessage(`Loading vector set "${vectorSetName}"...`)

            // Load information from the vector set
            // use vinfo to get the dimensions and record count
            const infoResponse = await vinfo({ keyName: vectorSetName })
            if (!infoResponse.success || !infoResponse.result) {
                throw new Error(infoResponse.error || "Failed to get vector set info")
            }
            const dim = Number(infoResponse.result["vector-dim"])
            const recordCount = Number(infoResponse.result["size"])

            setDim(dim)
            setRecordCount(recordCount)

            // Always load fresh metadata when loadVectorSet is called
            const metadataValue = await loadMetadata()

            // Update the cache with fresh data
            vectorSetCacheRef.current[vectorSetName] = {
                dim,
                recordCount,
                metadata: metadataValue,
                loaded: true,
            }

            setStatusMessage("")
        } catch (error) {
            console.error("[useVectorSet] Error loading vector set:", error)
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : "Error loading vector set"
            )
        }
    }, [vectorSetName, loadMetadata])

    useEffect(() => {
        if (vectorSetName) {
            loadVectorSet();
        } else {
            setDim(null);
            setRecordCount(null);
            setMetadata(null);
            setStatusMessage("");
            setResults([]);
        }
    }, [vectorSetName, loadVectorSet]);

    // Handle adding a new vector
    const handleAddVector = async (
        element: string,
        elementData: string | number[],
        useCAS?: boolean
    ) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            throw new Error("No vector set selected")
        }

        try {
            setStatusMessage(`Creating vector for "${element}"...`)
            let newVector: number[]

            // If the data is already a vector, validate it
            if (Array.isArray(elementData)) {
                if (dim && elementData.length !== dim) {
                    throw new Error(
                        `Vector dimensions mismatch: expected ${dim}, got ${elementData.length}`
                    )
                }

                newVector = elementData
            } else {
                // Assume elementData is text that needs to be embedded
                if (!metadata?.embedding) {
                    throw new Error(
                        "Embedding configuration is required for text input"
                    )
                }

                setStatusMessage(`Generating embedding for "${element}"...`)
                const embeddingResult = await embeddings.getEmbedding(
                    metadata.embedding,
                    elementData
                )

                if (!embeddingResult.success || !embeddingResult.result) {
                    throw new Error("Failed to generate embedding")
                }

                newVector = embeddingResult.result
            }

            // Validate the vector (no normalization)
            const validationResult = validateVector(
                newVector,
                metadata?.embedding ? getExpectedDimensions(metadata?.embedding) : undefined,
            )

            // If the vector is not valid, throw an error
            if (!validationResult.isValid) {
                throw new Error(`Invalid vector: ${validationResult.error || "contains NaN or Infinity values"}`)
            }

            // Create an empty attributes object
            const attrs = {}

            // Use original vector
            const result = await vadd({
                keyName: vectorSetName,
                element,
                vector: newVector as number[],
                attributes: JSON.stringify(attrs),
                useCAS: useCAS || metadata?.redisConfig?.defaultCAS,
                reduceDimensions: metadata?.redisConfig?.reduceDimensions,
                ef: metadata?.redisConfig?.buildExplorationFactor,
            })

            if (!result.success) {
                throw new Error(result.error || "Failed to add vector")
            }

            // Get the attributes for the element
            const attributes = await vgetattr({
                keyName: vectorSetName,
                element,
                returnCommandOnly: false
            })

            if (!attributes.success) {
                throw new Error(attributes.error || "Failed to get attributes")
            }

            // Get the new record count
            const newRecordCountResponse = await vcard({
                keyName: vectorSetName,
            })

            if (!newRecordCountResponse.success || newRecordCountResponse.result === undefined) {
                throw new Error(newRecordCountResponse.error || "Failed to get updated record count")
            }

            setRecordCount(newRecordCountResponse.result)

            // Update the cache
            if (vectorSetCacheRef.current[vectorSetName]) {
                vectorSetCacheRef.current[vectorSetName].recordCount = newRecordCountResponse.result
            }

            // Emit the vector added event
            eventBus.emit(AppEvents.VECTOR_ADDED, {
                vectorSetName,
                element,
                newCount: newRecordCountResponse.result
            })

            setStatusMessage("Vector created successfully")

            // Add to results with attributes
            setResults((prevResults) => [
                ...prevResults,
                [element, 1.0, newVector, attributes.result || ""] as VectorTuple
            ])
        } catch (error) {
            console.error("Error creating vector:", error)
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : "Error creating vector"
            )
            // Re-throw the error so it can be caught by the caller
            throw error
        }
    }

    // Handle deleting a vector
    const handleDeleteVector = async (element: string) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            return
        }

        try {
            setStatusMessage(`Deleting element "${element}"...`)

            // Delete the vector
            await vrem({
                keyName: vectorSetName,
                element,
            })

            // Get the new record count
            const newRecordCountResponse = await vcard({
                keyName: vectorSetName,
            })

            if (!newRecordCountResponse.success || newRecordCountResponse.result === undefined) {
                throw new Error(newRecordCountResponse.error || "Failed to get updated record count")
            }

            setRecordCount(newRecordCountResponse.result)

            // Update the cache
            if (vectorSetCacheRef.current[vectorSetName]) {
                vectorSetCacheRef.current[vectorSetName].recordCount = newRecordCountResponse.result
            }

            // Emit event to notify other components
            eventBus.emit(AppEvents.VECTOR_DELETED, {
                vectorSetName,
                element,
                newCount: newRecordCountResponse.result
            })

            setStatusMessage("Vector deleted successfully")

            // Remove the vector from the results list
            setResults((prevResults) =>
                prevResults.filter(([id]) => id !== element)
            )
        } catch (error) {
            console.error("Error deleting vector:", error)
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : "Error deleting vector"
            )
        }
    }

    const handleDeleteVector_multi = async (elements: string[]) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            return
        }
        try {
            setStatusMessage(`Deleting elements "${elements}"...`)
            // Delete the vectors

            await vrem({
                keyName: vectorSetName,
                elements,
            })

            // Get the new record count
            const newRecordCountResponse = await vcard({
                keyName: vectorSetName,
            })

            if (!newRecordCountResponse.success || newRecordCountResponse.result === undefined) {
                throw new Error(newRecordCountResponse.error || "Failed to get updated record count")
            }

            setRecordCount(newRecordCountResponse.result)

            // Update the cache
            if (vectorSetCacheRef.current[vectorSetName]) {
                vectorSetCacheRef.current[vectorSetName].recordCount = newRecordCountResponse.result
            }

            // Emit event to notify other components
            eventBus.emit(AppEvents.VECTOR_DELETED, {
                vectorSetName,
                elements,
                newCount: newRecordCountResponse.result
            })

            setStatusMessage("Vectors deleted successfully")

            // Remove the vectors from the results list
            setResults((prevResults) =>
                prevResults.filter(([id]) => !elements.includes(id))
            )
        } catch (error) {
            console.error("Error deleting vectors:", error)
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : "Error deleting vector"
            )
        }
    }

    // Handle showing a vector
    const handleShowVector = async (element: string) => {
        if (!vectorSetName) {
            setStatusMessage("Please select a vector set first")
            return null
        }

        try {
            setStatusMessage(`Fetching embedding for "${element}"...`)

            // First check if we have the vector in the current results
            const existingResult = results.find(
                (result) => result[0] === element
            )

            if (
                existingResult &&
                existingResult[2] !== null &&
                Array.isArray(existingResult[2]) &&
                existingResult[2].length > 0
            ) {
                // Use the existing vector and update results to ensure it's at the top
                setResults((prevResults) => {
                    const filteredResults = prevResults.filter(
                        (r) => r[0] !== element
                    )
                    return [...filteredResults, existingResult]
                })
                setStatusMessage("Vector retrieved from results")
                return existingResult[2]
            }

            const response = await vemb({
                keyName: vectorSetName,
                element,
            })

            if (!response.success || !response.result) {
                throw new Error(response.error || "Failed to get vector")
            }

            // Update results with the retrieved vector
            setResults((prevResults) => {
                const filteredResults = prevResults.filter(
                    (r) => r[0] !== element
                )
                return [...filteredResults, [element, 1.0, response.result, ""] as VectorTuple]
            })
            setStatusMessage("Vector retrieved successfully")
            return response.result
        } catch (error) {
            console.error("Error retrieving vector:", error)
            setStatusMessage(
                error instanceof ApiError
                    ? error.message
                    : "Error retrieving vector"
            )
            return null
        }
    }

    // Add a new method specifically for metadata updates
    const updateMetadata = async (newMetadata: VectorSetMetadata) => {
        if (!vectorSetName) return;

        try {
            // Save to server
            await vectorSets.setMetadata({
                name: vectorSetName,
                metadata: newMetadata,
            });

            // Update local state and cache
            setMetadata(newMetadata);
            vectorSetCacheRef.current[vectorSetName] = {
                ...vectorSetCacheRef.current[vectorSetName],
                metadata: newMetadata,
            };

            // Emit event for other components that might need to know
            eventBus.emit(AppEvents.METADATA_UPDATED, {
                vectorSetName,
                metadata: newMetadata
            });
        } catch (error) {
            console.error("[useVectorSet] Error updating metadata:", error);
            throw error;
        }
    };

    return {
        vectorSetName,
        setVectorSetName,
        dim,
        recordCount,
        metadata,
        setMetadata,
        statusMessage,
        results,
        setResults,
        loadVectorSet,
        handleAddVector,
        handleDeleteVector,
        handleDeleteVector_multi,
        handleShowVector,
        updateMetadata,
    }
}

export { useVectorSet };
