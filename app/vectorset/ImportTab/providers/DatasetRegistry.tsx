import { DatasetProvider } from "../types/DatasetProvider"
import { ImageDatasetProvider } from "./ImageDatasetProvider"
import { TextDatasetProvider } from "./TextDatasetProvider"
import { BookIcon, MovieIcon, FaceIcon } from "./DatasetIcons"

// Initialize text datasets
const textDatasetProvider = new TextDatasetProvider([
    {
        name: "Goodreads Books",
        description: "A collection of popular books with titles, authors, descriptions, and ratings from Goodreads",
        icon: BookIcon,
        fileUrl: "/sample-data/top2k_book_descriptions.csv",
        columns: [
            "title",
            "authors",
            "description",
            "average_rating",
            "isbn",
            "original_publication_year",
            "ratings_count",
            "language_code",
        ],
        recordCount: 2000,
        elementTemplate: "${title} (ISBN: ${isbn})",
        vectorTemplate: 'The book titled "${title}", authored by ${authors}, was initially published in ${original_publication_year}. It has an average rating of ${average_rating} across ${ratings_count} ratings, and is available under ISBN ${isbn}. The description is as follows: ${description}.',
        attributeColumns: [
            "average_rating",
            "original_publication_year",
            "authors",
            "isbn",
            "ratings_count",
            "language_code",
        ],
        dataType: "text",
        embeddingType: "text",
        recommendedEmbedding: {
            provider: "ollama",
            ollama: {
                modelName: "mxbai-embed-large",
                apiUrl: "http://localhost:11434"
            }
        }
    },
    {
        name: "IMDB Movies",
        description: "A dataset of the top 1000 movies with titles, plot synopses, directors, and ratings from IMDB",
        icon: MovieIcon,
        fileUrl: "/sample-data/imdb_top_1000.csv",
        columns: [
            "Poster_Link",
            "Series_Title",
            "Released_Year",
            "Certificate",
            "Runtime",
            "Genre",
            "IMDB_Rating",
            "Overview",
            "Meta_score",
            "Director",
            "Star1",
            "Star2",
            "Star3",
            "Star4",
            "No_of_Votes",
            "Gross",
        ],
        recordCount: 1000,
        elementTemplate: "${Series_Title} (${Released_Year})",
        vectorTemplate: "Movie '${Series_Title}' was released in ${Released_Year} with a runtime of ${Runtime} minutes. Directed by ${Director}, this ${Genre} film has a rating of ${IMDB_Rating} on IMDB. Overview: ${Overview}. It stars ${Star1}, ${Star2}, ${Star3}, and ${Star4}.",
        attributeColumns: [
            "IMDB_Rating",
            "Released_Year",
            "Director",
            "Genre",
            "Runtime",
            "Meta_score",
        ],
        dataType: "text",
        embeddingType: "text",
        recommendedEmbedding: {
            provider: "tensorflow",
            tensorflow: {
                model: "universal-sentence-encoder"
            }
        }
    }
])

// Initialize image datasets
const imageDatasetProvider = new ImageDatasetProvider([
    {
        name: "UTK Faces",
        description: "UTKFace dataset with over 20,000 face images",
        icon: FaceIcon,
        baseUrl: "/sample-data/UTKFace/images",
        classesFile: "/sample-data/UTKFace/images/_classes.csv",
        recordCount: 20000,
        elementTemplate: "Face ${index}",
        attributeColumns: ["age", "gender", "ethnicity"],
        dataType: "image",
        embeddingType: "image",
        recommendedEmbedding: {
            provider: "image",
            image: {
                model: "mobilenet"
            }
        }
    }
])

class DatasetRegistry {
    private providers: DatasetProvider[] = []

    constructor() {
        this.providers = [textDatasetProvider, imageDatasetProvider]
    }

    getAllDatasets() {
        return this.providers.flatMap(provider => provider.getDatasets())
    }

    getDatasetByName(name: string) {
        const dataset = this.getAllDatasets().find(d => d.name === name)
        if (!dataset) {
            throw new Error(`Dataset ${name} not found`)
        }
        return dataset
    }

    registerProvider(provider: DatasetProvider) {
        this.providers.push(provider)
    }
}

// Export singleton instance
export const datasetRegistry = new DatasetRegistry() 