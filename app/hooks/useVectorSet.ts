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
            throw new Error("Please select a vector set first")
        }

        try {
            let vector: number[]

            if (Array.isArray(elementData)) {
                // Validate and normalize the raw vector data
                const validationResult = validateAndNormalizeVector(
                    elementData,
                    "unknown"
                )
                if (!validationResult.isValid) {
                    throw new Error(
                        `Invalid vector data: ${validationResult.error}`
                    )
                }
                vector = validationResult.vector
            } else if (
                metadata?.embedding &&
                metadata.embedding.provider !== "none"
            ) {
                // Determine if we're using an image embedding model
                const isImageEmbedding = metadata.embedding.provider === "image"

                // Get embedding using our embeddings API client
                const response = await embeddings.getEmbedding(
                    metadata.embedding,
                    isImageEmbedding ? undefined : elementData,
                    isImageEmbedding ? elementData : undefined
                )
                
                if (!response.success || !response.result) {
                    throw new Error(
                        `Failed to get embedding: ${
                            response.error || "Unknown error"
                        }`
                    )
                }
                vector = response.result

            } else if (
                metadata?.embedding &&
                metadata.embedding.provider === "none"
            ) {
                vector = validateAndNormalizeVector(
                    elementData,
                    "unknown"
                ).vector
            } else {
                throw new Error("Error with Vector Set configuration.")
            }
            const reduceDimensions = metadata?.redisConfig?.reduceDimensions
                ? metadata?.redisConfig?.reduceDimensions
                : undefined
            // Add the vector using Redis commands
            await vadd({
                keyName: vectorSetName,
                element,
                vector,
                attributes: undefined,
                useCAS,
                reduceDimensions
            })

            setStatusMessage("Vector created successfully")

            // Add the new vector to the results list
            const newVector = await vemb({
                keyName: vectorSetName,
                element,
            })
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
        } catch (error) {
            console.error("Error deleting vector:", error)
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
        handleShowVector,
    }
}
