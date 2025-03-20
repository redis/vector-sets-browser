"use client"

import { useState } from "react"
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
        recommendedEmbedding: {
            provider: "openai",
            openai: {
                apiKey: "",
                model: "text-embedding-3-small",
            },
        } as EmbeddingConfig,
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
        recommendedEmbedding: {
            provider: "tensorflow",
            tensorflow: {
                model: "universal-sentence-encoder",
            },
        } as EmbeddingConfig,
    },
    {
        name: "UTK Faces",
        description:
            "UTKFace dataset with over 20,000 face images annotated with age, gender, and ethnicity. The images cover large variation in pose, facial expression, illumination, occlusion, and resolution.",
        icon: <User className="h-5 w-5 text-violet-500" />,
        fileUrl: "/sample-data/UTKFace/images",
        columns: ["image", "age", "gender", "ethnicity"],
        recordCount: 20000,
        elementTemplate: "Face ${index}",
        vectorTemplate: "",
        attributeColumns: ["age", "gender", "ethnicity"],
        dataType: "image",
        recommendedEmbedding: {
            provider: "image",
            image: {
                model: "mobilenet",
            },
        } as EmbeddingConfig,
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

    const handleSelectDataset = (dataset: SampleDataset) => {
        setSelectedDataset(dataset.name)
        onSelect(dataset)
    }

    return (
        <div className="flex flex-col h-full">
            {/* <div className="text-lg font-medium mb-4">Sample Datasets</div>
             */}
            <p className="text-gray-600 mb-4">
                Select a sample dataset to import into your vector set
            </p>

            {useCarousel ? (
                <div className="relative w-full overflow-visible px-6">
                    <Carousel 
                        className="w-full"
                        opts={{
                            align: "start",
                            slidesToScroll: 1
                        }}
                    >
                        <CarouselContent className="-ml-4">
                            {sampleDatasets.map((dataset) => (
                                <CarouselItem key={dataset.name} className="pl-4 basis-full sm:basis-1/2 md:basis-1/2">
                                    <DatasetCard 
                                        dataset={dataset} 
                                        isSelected={selectedDataset === dataset.name}
                                        onSelect={handleSelectDataset}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-white border shadow-sm" />
                        <CarouselNext className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-white border shadow-sm" />
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
                    onClick={() => {
                        const selected = sampleDatasets.find(d => d.name === selectedDataset)
                        if (selected) {
                            onSelect(selected)
                        } else {
                            setError("Please select a dataset first")
                        }
                    }}
                    disabled={!selectedDataset}
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
}

function DatasetCard({ dataset, isSelected, onSelect }: DatasetCardProps) {
    return (
        <div
            className={`bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col h-full
              ${isSelected ? "ring-2 ring-primary border-primary" : ""}`}
        >
            <div className="p-4 flex-grow">
                <div className="flex items-center mb-4">
                    <div className="mr-3 bg-gray-50 p-2 rounded-full">
                        {dataset.icon}
                    </div>
                    <h3 className="text-lg font-medium">
                        {dataset.name}
                    </h3>
                    <Badge
                        variant="outline"
                        className="ml-2"
                    >
                        {dataset.dataType}
                    </Badge>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    {dataset.description}
                </p>

                <div className="flex items-center text-xs text-gray-500 mb-2">
                    <span className="font-medium mr-1">
                        Embedding Model:
                    </span>
                    <Badge
                        variant="secondary"
                        className="text-xs"
                        title="Recommended embedding provider and model"
                    >
                        {dataset.recommendedEmbedding.provider}
                        {dataset.recommendedEmbedding.provider === "openai" &&
                            dataset.recommendedEmbedding.openai?.model &&
                            `: ${dataset.recommendedEmbedding.openai.model}`}
                        {dataset.recommendedEmbedding.provider === "tensorflow" &&
                            dataset.recommendedEmbedding.tensorflow?.model &&
                            `: ${dataset.recommendedEmbedding.tensorflow.model}`}
                        {dataset.recommendedEmbedding.provider === "image" &&
                            dataset.recommendedEmbedding.image?.model &&
                            `: ${dataset.recommendedEmbedding.image.model}`}
                    </Badge>
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

                <div className="text-xs text-gray-500">
                    <span className="font-medium">
                        Includes:
                    </span>{" "}
                    {dataset.columns.slice(0, 6).join(", ")}
                    {dataset.columns.length > 6 ? "..." : ""}
                </div>
            </div>

            <div className="border-t p-4">
                <Button
                    variant={isSelected ? "secondary" : "default"}
                    className="w-full"
                    onClick={() => onSelect(dataset)}
                >
                    {isSelected ? "Selected" : "Select Dataset"}
                </Button>
            </div>
        </div>
    )
} 