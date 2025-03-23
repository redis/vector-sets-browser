"use client"

import { useState, useEffect } from "react"
import { AlertCircle, BookOpen, Film, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Image from "next/image"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { EmbeddingConfig } from "@/app/embeddings/types/config"
import { getDefaultEmbeddingConfig } from "@/app/utils/embeddingUtils"

// Define the sample dataset interface
export interface SampleDataset {
    name: string
    description: string
    icon: React.ReactNode
    fileUrl: string
    columns: string[]
    recordCount: number
    elementTemplate: string
    vectorTemplate: string
    attributeColumns: string[]
    dataType: "text" | "image"
    embeddingType: "text" | "image"
    recommendedEmbedding: EmbeddingConfig
}

// Pre-defined sample datasets
export const sampleDatasets: SampleDataset[] = [
    {
        name: "Goodreads Books",
        description:
            "A collection of popular books with titles, authors, descriptions, and ratings from Goodreads",
        icon: <BookOpen className="h-5 w-5 text-blue-500" />,
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
        vectorTemplate:
            'The book titled "${title}", authored by ${authors}, was initially published in ${original_publication_year}. It has an average rating of ${average_rating} across ${ratings_count} ratings, and is available under ISBN ${isbn}. The description is as follows: ${description}.',
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
                apiUrl: "http://localhost:11434/api/embeddings"
            }
        }
    },
    {
        name: "UTK Faces",
        description: "UTKFace dataset with over 20,000 face images.",
        icon: <User className="h-5 w-5 text-violet-500" />,
        fileUrl: "/sample-data/UTKFace/images",
        columns: ["image", "age", "gender", "ethnicity"],
        recordCount: 20000,
        elementTemplate: "Face ${index}",
        vectorTemplate: "",
        attributeColumns: ["age", "gender", "ethnicity"],
        dataType: "image",
        embeddingType: "image",
        recommendedEmbedding: {
            provider: "image",
            image: {
                model: "mobilenet"
            }
        }
    },

    {
        name: "IMDB Movies",
        description:
            "A dataset of the top 1000 movies with titles, plot synopses, directors, and ratings from IMDB",
        icon: <Film className="h-5 w-5 text-amber-500" />,
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
        vectorTemplate:
            "Movie '${Series_Title}' was released in ${Released_Year} with a runtime of ${Runtime} minutes. Directed by ${Director}, this ${Genre} film has a rating of ${IMDB_Rating} on IMDB. Overview: ${Overview}. It stars ${Star1}, ${Star2}, ${Star3}, and ${Star4}.",
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
    },
]

interface SampleDataSelectProps {
    onSelect: (dataset: SampleDataset) => void
    onCancel: () => void
    selectedDataset?: string | null
    useCarousel?: boolean
}

export function SampleDataSelect({ 
    onSelect, 
    onCancel, 
    selectedDataset: initialSelectedDataset = null,
    useCarousel = false 
}: SampleDataSelectProps) {
    const [selectedDataset, setSelectedDataset] = useState<string | null>(initialSelectedDataset)
    const [error, setError] = useState<string | null>(null)
    const [embeddingConfigs, setEmbeddingConfigs] = useState<Record<string, EmbeddingConfig | null>>({})
    const [isLoading, setIsLoading] = useState(true)

    // Load embedding configs for all datasets when component mounts
    useEffect(() => {
        async function loadEmbeddingConfigs() {
            setIsLoading(true)
            const configs: Record<string, EmbeddingConfig> = {}
            
            for (const dataset of sampleDatasets) {
                // Use recommended embedding as default if available, otherwise get default
                const config = dataset.recommendedEmbedding || 
                    await getDefaultEmbeddingConfig(dataset.embeddingType)
                configs[dataset.name] = config
            }
            
            setEmbeddingConfigs(configs)
            setIsLoading(false)
        }
        
        loadEmbeddingConfigs()
    }, [])

    const handleSelectDataset = (dataset: SampleDataset) => {
        setSelectedDataset(dataset.name)
    }

    const handleContinue = async () => {
        if (!selectedDataset) {
            setError("Please select a dataset first")
            return
        }
        
        const selected = sampleDatasets.find(d => d.name === selectedDataset)
        if (!selected) {
            setError("Dataset not found")
            return
        }
        
        onSelect(selected)
    }

    return (
        <div className="flex flex-col h-full">
            {/* <div className="text-lg font-medium mb-4">Sample Datasets</div>
             */}
            <p className="text-gray-600 mb-4">
                Select a sample dataset to import into your vector set
            </p>

            {isLoading ? (
                <div className="flex justify-center items-center h-40">
                    <p>Loading embedding configurations...</p>
                </div>
            ) : useCarousel ? (
                <div className="relative w-full overflow-visible px-12">
                    <Carousel 
                        className="w-full"
                        opts={{
                            align: "start",
                            slidesToScroll: 1
                        }}
                    >
                        <CarouselContent className="">
                            {sampleDatasets.map((dataset) => (
                                <CarouselItem key={dataset.name} className="pl-4 basis-full sm:basis-1/2 md:basis-1/2">
                                    <DatasetCard 
                                        dataset={dataset} 
                                        isSelected={selectedDataset === dataset.name}
                                        onSelect={handleSelectDataset}
                                        embeddingConfig={embeddingConfigs[dataset.name]}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
                        <CarouselNext className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
                    </Carousel>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sampleDatasets.map((dataset) => (
                        <DatasetCard 
                            key={dataset.name}
                            dataset={dataset} 
                            isSelected={selectedDataset === dataset.name}
                            onSelect={handleSelectDataset}
                            embeddingConfig={embeddingConfigs[dataset.name]}
                        />
                    ))}
                </div>
            )}

            <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button 
                    variant="default" 
                    onClick={handleContinue}
                    disabled={!selectedDataset || isLoading}
                >
                    Continue
                </Button>
            </div>

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}

interface DatasetCardProps {
    dataset: SampleDataset
    isSelected: boolean
    onSelect: (dataset: SampleDataset) => void
    embeddingConfig: EmbeddingConfig | null
}

function DatasetCard({ dataset, isSelected, onSelect, embeddingConfig }: DatasetCardProps) {
    return (
        <div
            className={`bg-[white] rounded-md border shadow-sm overflow-hidden flex flex-col h-full
              ${isSelected ? "border-red-500 border-2" : ""}`}
            onClick={() => onSelect(dataset)}
        >
            <div className="p-4 grow">
                <div className="flex items-center mb-4">
                    <div className="mr-3 bg-gray-50 p-2 rounded-full">
                        {dataset.icon}
                    </div>
                    <h3 className="text-lg font-medium">{dataset.name}</h3>
                    <Badge variant="outline" className="ml-2">
                        {dataset.dataType}
                    </Badge>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    {dataset.description}
                </p>

                <div className="flex flex-col gap-1">
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                        <span className="font-medium mr-1">
                            Embedding Engine:
                        </span>
                        {embeddingConfig ? (
                            <Badge variant="secondary" className="text-xs">
                                {embeddingConfig.provider}
                                {embeddingConfig.provider === "ollama" &&
                                    embeddingConfig.ollama?.modelName &&
                                    `: ${embeddingConfig.ollama.modelName}`}
                                {embeddingConfig.provider === "openai" &&
                                    embeddingConfig.openai?.model &&
                                    `: ${embeddingConfig.openai.model}`}
                                {embeddingConfig.provider === "tensorflow" &&
                                    embeddingConfig.tensorflow?.model &&
                                    `: ${embeddingConfig.tensorflow.model}`}
                                {embeddingConfig.provider === "image" &&
                                    embeddingConfig.image?.model &&
                                    `: ${embeddingConfig.image.model}`}
                            </Badge>
                        ) : (
                            <Badge
                                variant="outline"
                                className="text-xs animate-pulse"
                            >
                                Loading...
                            </Badge>
                        )}
                    </div>

                    {embeddingConfig?.provider === "ollama" && (
                        <div className="text-xs text-green-600 font-medium">
                            ✓ Using locally installed Ollama
                        </div>
                    )}
                </div>

                {dataset.name === "UTK Faces" && (
                    <div className="mt-4 mb-2">
                        <Image
                            src="/sample-data/UTKFace/samples.png"
                            alt="UTK Faces sample"
                            width={240}
                            height={120}
                            className="rounded-md object-cover"
                        />
                    </div>
                )}

                <div className="text-xs text-gray-500 mt-3">
                    <span className="font-medium">Includes:</span>{" "}
                    {dataset.columns.slice(0, 6).join(", ")}
                    {dataset.columns.length > 6 ? "..." : ""}
                </div>
            </div>

        </div>
    )
} 