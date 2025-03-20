import { ApiError } from "@/app/api/client"
import { 
    VectorTuple, 
    vdim, 
    vcard, 
    vadd, 
    vemb, 
    vgetattr, 
    vrem 
} from "@/app/redis-server/api"
import { vectorSets } from "@/app/api/vector-sets"
import { embeddings } from "@/app/embeddings/client"
import { VectorSetMetadata } from "@/app/embeddings/types/config"
import { validateAndNormalizeVector } from "@/app/embeddings/utils/validation"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { useEffect, useRef, useState } from "react"

interface UseVectorSetReturn {
    vectorSetName: string | null
    setVectorSetName: (name: string | null) => void
    dim: number | null
    recordCount: number | null
    metadata: VectorSetMetadata | null
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
    const [results, setResults] = useState<VectorTuple[]>([])

    // Cache for vector set data
    const vectorSetCacheRef = useRef<Record<string, VectorSetCache>>({})

    // Load metadata when vector set changes
    const loadMetadata = async () => {
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
    }

    // Load vector set data when name changes
    const loadVectorSet = async () => {
        if (!vectorSetName) return

        // Check if vector set data is already cached
        const cache = vectorSetCacheRef.current[vectorSetName]
        if (cache?.loaded) {
            setDim(cache.dim)
            setRecordCount(cache.recordCount)
            setMetadata(cache.metadata)
            setStatusMessage("")
            return
        }

        try {
            // Clear any previous results
            setResults([])

            // Set status message
            setStatusMessage(`Loading vector set "${vectorSetName}"...`)

            // Load information from the vector set
            const [dimResult, recordCountResult] = await Promise.all([
                vdim({ keyName: vectorSetName }),
                vcard({ keyName: vectorSetName }),
            ])

            setDim(dimResult)
            setRecordCount(recordCountResult)

            // Load metadata if not already cached and get the result
            let metadataValue = cache?.metadata
            if (!metadataValue) {
                metadataValue = await loadMetadata()
            }

            // Cache the vector set data with the correct metadata
            vectorSetCacheRef.current[vectorSetName] = {
                dim: dimResult,
                recordCount: recordCountResult,
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
    }

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

            // Validate and normalize the vector
            let normalizedVector = validateAndNormalizeVector(
                newVector,
                metadata?.embedding?.provider || "none",
                dim
            )

            // If the vector is not valid, throw an error
            if (!normalizedVector.isValid) {
                throw new Error(`Invalid vector: ${normalizedVector.error || "contains NaN or Infinity values"}`)
            }

            // Add the vector to Redis
            const options = useCAS ? { nx: true } : {}
            const result = await vadd({
                keyName: vectorSetName,
                element,
                vector: normalizedVector.vector,
                ...options,
            })

            if (result === 0 && useCAS === true) {
                throw new Error(
                    `Element "${element}" already exists in vector set "${vectorSetName}"`
                )
            }

            setStatusMessage("Vector created successfully")

            // Get the attributes for the added vector
            const attributes = await vgetattr({
                keyName: vectorSetName,
                element,
            })
            setResults((prevResults) => [
                ...prevResults,
                [element, 1.0, newVector, attributes || ""],
            ])

            // Update the record count
            const newRecordCount = await vcard({
                keyName: vectorSetName,
            })
            setRecordCount(newRecordCount)

            // Update the cache
            if (vectorSetCacheRef.current[vectorSetName]) {
                vectorSetCacheRef.current[vectorSetName].recordCount =
                    newRecordCount
            }

            // Emit event to notify other components
            eventBus.emit(AppEvents.VECTOR_ADDED, { 
                vectorSetName, 
                element, 
                newCount: newRecordCount 
            })
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

            // Delete the vector from Redis
            await vrem({
                keyName: vectorSetName,
                element,
            })
            setStatusMessage("Vector deleted successfully")

            // Remove the vector from the results list
            setResults((prevResults) =>
                prevResults.filter(([id]) => id !== element)
            )

            // Update the record count
            const newRecordCount = await vcard({
                keyName: vectorSetName,
            })
            setRecordCount(newRecordCount)

            // Update the cache
            if (vectorSetCacheRef.current[vectorSetName]) {
                vectorSetCacheRef.current[vectorSetName].recordCount =
                    newRecordCount
            }

            // Emit event to notify other components
            eventBus.emit(AppEvents.VECTOR_DELETED, { 
                vectorSetName, 
                element, 
                newCount: newRecordCount 
            })
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
             // Delete the vectors from Redis
                 
             await vrem({
                 keyName: vectorSetName,
                 elements,
             })
             setStatusMessage("Vectors deleted successfully")

             // Remove the vector from the results list
             setResults((prevResults) =>
                 prevResults.filter(([id]) => !elements.includes(id))
             )

             // Update the record count
             const newRecordCount = await vcard({
                 keyName: vectorSetName,
             })
             setRecordCount(newRecordCount)

             // Update the cache
             if (vectorSetCacheRef.current[vectorSetName]) {
                 vectorSetCacheRef.current[vectorSetName].recordCount =
                     newRecordCount
             }

             // Emit event to notify other components
             eventBus.emit(AppEvents.VECTOR_DELETED, { 
                 vectorSetName, 
                 elements, 
                 newCount: newRecordCount 
             })
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

            // Extract vector from response
            let vector = null
            if (
                response &&
                typeof response === "object" &&
                "success" in response
            ) {
                // Handle response in {success: true, result: [...]} format
                vector =
                    response.success &&
                    "result" in response &&
                    Array.isArray(response.result)
                        ? response.result
                        : null
            } else if (Array.isArray(response)) {
                // Handle direct array response
                vector = response
            }
            console.log("[handleShowVector] Extracted vector:", vector)

            // Verify that we got a valid vector
            if (!Array.isArray(vector) || vector.length === 0) {
                console.error(
                    "[handleShowVector] Invalid vector received:",
                    vector
                )
                throw new Error("Retrieved vector is empty or invalid")
            }

            // Add the vector to results without removing existing results
            setResults((prevResults) => {
                const filteredResults = prevResults.filter(
                    (r) => r[0] !== element
                )
                return [...filteredResults, [element, 1.0, vector, ""]]
            })
            setStatusMessage("Vector retrieved successfully")
            return vector
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

    // Load vector set data when name changes
    useEffect(() => {
        if (vectorSetName) {
            loadVectorSet()
        } else {
            setDim(null)
            setRecordCount(null)
            setMetadata(null)
            setStatusMessage("")
            setResults([])
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
        handleDeleteVector_multi,
        handleShowVector,
    }
}
