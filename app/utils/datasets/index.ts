import { goodreadsBooksImporter } from "./goodreads-books"
import { imdbMoviesImporter } from "./imdb-movies"
import { SampleDatasetImporter } from "./types"

// Export types
export * from "./types"

// Export base importer
export * from "./base-importer"

// Export all dataset importers
export const datasetImporters: SampleDatasetImporter[] = [
    goodreadsBooksImporter,
    imdbMoviesImporter,
]

// Export individual importers
export {
    goodreadsBooksImporter,
    imdbMoviesImporter,
} 