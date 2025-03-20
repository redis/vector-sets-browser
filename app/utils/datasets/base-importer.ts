import { vadd_multi, vcard } from "@/app/redis-server/api"
import { getRedisUrl } from "@/app/redis-server/server/commands"
import { createVectorSet } from "@/app/api/vector-sets"
import { VectorSetMetadata } from "@/app/embeddings/types/config"
import { DatasetImportOptions, DatasetImportResult, PrecomputedVector } from "./types"

/**
 * Base class for dataset importers with common functionality
 */
export abstract class BaseDatasetImporter {
    /**
     * Import a dataset with precomputed vectors
     */
    async importDataset(
        vectors: PrecomputedVector[],
        options: DatasetImportOptions
    ): Promise<DatasetImportResult> {
        try {
            const { vectorSetName, chunkSize = 100, onProgress, metadata } = options
            
            // Get Redis URL (needs to be done server-side)
            const redisUrl = await getRedisUrl()
            if (!redisUrl) {
                return {
                    success: false,
                    vectorSetName,
                    recordCount: 0,
                    error: "Redis URL not found in cookies"
                }
            }

            // Create the vector set first if metadata is provided
            if (metadata) {
                try {
                    await createVectorSet({
                        name: vectorSetName,
                        dimensions: metadata.dimensions || 0,
                        metadata
                    })
                } catch (error) {
                    console.warn("Error creating vector set, it may already exist:", error)
                    // Continue anyway as the set might already exist
                }
            }

            // Import vectors in chunks
            const totalVectors = vectors.length
            let processedCount = 0

            for (let i = 0; i < totalVectors; i += chunkSize) {
                const chunk = vectors.slice(i, i + chunkSize)
                
                // Process this chunk
                await this.importChunk(chunk, vectorSetName)
                
                // Update progress
                processedCount += chunk.length
                onProgress?.(processedCount, totalVectors)
            }

            // Get the final record count
            const recordCount = await vcard({ keyName: vectorSetName })
            
            return {
                success: true,
                vectorSetName,
                recordCount: recordCount as number
            }
        } catch (error) {
            console.error("Error importing dataset:", error)
            return {
                success: false,
                vectorSetName: options.vectorSetName,
                recordCount: 0,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }

    /**
     * Import a chunk of vectors using vadd_multi
     */
    private async importChunk(vectors: PrecomputedVector[], vectorSetName: string): Promise<void> {
        const elements = vectors.map(v => v.element)
        const embeddingVectors = vectors.map(v => v.vector)
        const attributes = vectors.map(v => v.attributes || {})

        await vadd_multi({
            keyName: vectorSetName,
            elements,
            vectors: embeddingVectors,
            attributes,
        })
    }
} 