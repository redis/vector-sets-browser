import { BaseDatasetImporter } from "./base-importer"
import { DatasetImportOptions, DatasetImportResult, PrecomputedVector, SampleDatasetImporter } from "./types"
import { createVectorSetMetadata } from "@/app/embeddings/types/config"

/**
 * Importer for the Goodreads Books dataset with precomputed vectors
 */
export class GoodreadsBooksImporter extends BaseDatasetImporter implements SampleDatasetImporter {
    name = "Goodreads Books (Fast Import)"
    description = "A collection of popular books with titles, authors, descriptions, and ratings from Goodreads. Uses precomputed vectors for fast import."
    
    /**
     * Import the Goodreads Books dataset with precomputed vectors
     */
    async importDataset(options: DatasetImportOptions): Promise<DatasetImportResult> {
        try {
            console.log(`[GoodreadsBooksImporter] Starting fast import of Goodreads Books dataset to ${options.vectorSetName}`)
            
            // Fetch the precomputed vectors from a JSON file
            const response = await fetch("/sample-data/precomputed/goodreads_vectors.json")
            if (!response.ok) {
                throw new Error(`Failed to fetch precomputed vectors: ${response.statusText}`)
            }
            
            const data = await response.json()
            
            // Validate the data format
            if (!Array.isArray(data.vectors)) {
                throw new Error("Invalid precomputed vectors format: expected an array")
            }
            
            console.log(`[GoodreadsBooksImporter] Loaded ${data.vectors.length} precomputed vectors, starting import...`)
            
            // Set metadata if not provided
            if (!options.metadata) {
                options.metadata = createVectorSetMetadata({
                    provider: "openai",
                    openai: {
                        apiKey: "",
                        model: "text-embedding-3-small",
                    }
                }, "Precomputed Goodreads Books dataset")
            }
            
            // Use the base class import method with precomputed vectors
            return super.importDataset(data.vectors as PrecomputedVector[], options)
        } catch (error) {
            console.error("[GoodreadsBooksImporter] Error importing dataset:", error)
            return {
                success: false,
                vectorSetName: options.vectorSetName,
                recordCount: 0,
                error: error instanceof Error ? error.message : String(error)
            }
        }
    }
}

// Export a singleton instance
export const goodreadsBooksImporter = new GoodreadsBooksImporter() 