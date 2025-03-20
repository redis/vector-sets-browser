import { BaseDatasetImporter } from "./base-importer"
import { DatasetImportOptions, DatasetImportResult, PrecomputedVector, SampleDatasetImporter } from "./types"
import { createVectorSetMetadata } from "@/app/embeddings/types/config"

/**
 * Importer for the IMDB Movies dataset with precomputed vectors
 */
export class IMDBMoviesImporter extends BaseDatasetImporter implements SampleDatasetImporter {
    name = "IMDB Movies (Fast Import)"
    description = "A dataset of the top 1000 movies with titles, plot synopses, directors, and ratings from IMDB. Uses precomputed vectors for fast import."
    
    /**
     * Import the IMDB Movies dataset with precomputed vectors
     */
    async importDataset(options: DatasetImportOptions): Promise<DatasetImportResult> {
        try {
            console.log(`[IMDBMoviesImporter] Starting fast import of IMDB Movies dataset to ${options.vectorSetName}`)
            
            // Fetch the precomputed vectors from a JSON file
            const response = await fetch("/sample-data/precomputed/imdb_vectors.json")
            if (!response.ok) {
                throw new Error(`Failed to fetch precomputed vectors: ${response.statusText}`)
            }
            
            const data = await response.json()
            
            // Validate the data format
            if (!Array.isArray(data.vectors)) {
                throw new Error("Invalid precomputed vectors format: expected an array")
            }
            
            console.log(`[IMDBMoviesImporter] Loaded ${data.vectors.length} precomputed vectors, starting import...`)
            
            // Set metadata if not provided
            if (!options.metadata) {
                options.metadata = createVectorSetMetadata({
                    provider: "tensorflow",
                    tensorflow: {
                        model: "universal-sentence-encoder",
                    }
                }, "Precomputed IMDB Movies dataset")
            }
            
            // Use the base class import method with precomputed vectors
            return super.importDataset(data.vectors as PrecomputedVector[], options)
        } catch (error) {
            console.error("[IMDBMoviesImporter] Error importing dataset:", error)
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
export const imdbMoviesImporter = new IMDBMoviesImporter() 