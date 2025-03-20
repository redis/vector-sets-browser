"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, BookOpen, Film, User } from "lucide-react"
import { useState, useEffect } from "react"
import { 
    VectorSetMetadata, 
    EmbeddingConfig, 
    isImageEmbedding, 
    isTextEmbedding,
    createVectorSetMetadata
} from "@/app/embeddings/types/config"
import { Button } from "@/components/ui/button"
import { jobs, ImportJobConfig } from "@/app/api/jobs"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import Image from "next/image"
import { getImageEmbedding } from "@/app/utils/imageEmbedding"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"

interface SampleDataset {
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

interface ImportSampleDataProps {
    onClose: () => void
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onUpdateMetadata?: (metadata: VectorSetMetadata) => void
    selectionMode?: boolean
    importMode?: boolean
    onSelectDataset?: (datasetName: string) => void
    selectedDataset?: string | null
    carouselMode?: boolean
    useShadcnCarousel?: boolean
}

export default function ImportSampleData({ 
    onClose, 
    metadata, 
    vectorSetName, 
    onUpdateMetadata,
    selectionMode = false,
    importMode = false,
    onSelectDataset,
    selectedDataset: initialSelectedDataset = null,
    carouselMode = false,
    useShadcnCarousel = false
}: ImportSampleDataProps) {
    const [error, setError] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean
        dataset: SampleDataset | null
    }>({ open: false, dataset: null })
    const [importCount, setImportCount] = useState<number>(5)
    const [importProgress, setImportProgress] = useState<{
        current: number
        total: number
    } | null>(null)
    const [embeddingMismatch, setEmbeddingMismatch] = useState<{
        open: boolean
        dataset: SampleDataset | null
        currentEmbedding: VectorSetMetadata | null
    }>({ open: false, dataset: null, currentEmbedding: null })
    const [availableImageCount, setAvailableImageCount] = useState<number>(100)

    // Mode tracking - separating selection from import view
    const [viewMode, setViewMode] = useState<"select" | "import">(
        selectionMode ? "select" : "import"
    )

    // Default recommended embedding configurations for each data type
    const sampleDatasets: SampleDataset[] = [
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

    // Initialize the selected dataset from props if provided
    const [selectedDataset, setSelectedDataset] = useState<string | null>(
        initialSelectedDataset
    )
    const [selectedDatasetObject, setSelectedDatasetObject] =
        useState<SampleDataset | null>(
            initialSelectedDataset
                ? sampleDatasets.find(
                      (d) => d.name === initialSelectedDataset
                  ) || null
                : null
        )

    // If in import mode and a selected dataset is provided, import it immediately
    useEffect(() => {
        if (importMode && initialSelectedDataset && !importStarted) {
            console.log(
                `[ImportSampleData] Auto-importing dataset: ${initialSelectedDataset} (importMode: ${importMode})`
            )
            const dataset = sampleDatasets.find(
                (d) => d.name === initialSelectedDataset
            )
            if (dataset) {
                setSelectedDatasetObject(dataset)
                setViewMode("import")
                importDataset(dataset)
            }
        }
    }, [importMode, initialSelectedDataset, importStarted])

    // Check if current embedding is compatible with dataset
    const isEmbeddingCompatible = (
        dataset: SampleDataset,
        currentMetadata: VectorSetMetadata | null
    ): boolean => {
        if (!currentMetadata) return false

        if (dataset.dataType === "text") {
            return isTextEmbedding(currentMetadata.embedding)
        } else if (dataset.dataType === "image") {
            return isImageEmbedding(currentMetadata.embedding)
        }

        return false
    }

    const handleImportSampleDataset = async (dataset: SampleDataset) => {
        // If in selection mode, just select the dataset and notify parent
        if (selectionMode) {
            setSelectedDataset(dataset.name)
            setSelectedDatasetObject(dataset)
            if (onSelectDataset) {
                onSelectDataset(dataset.name)
            }
            return
        }

        // Check if there's metadata and if it's compatible with the dataset
        if (metadata) {
            const isCompatible = isEmbeddingCompatible(dataset, metadata)

            if (!isCompatible) {
                // Show mismatch dialog
                setEmbeddingMismatch({
                    open: true,
                    dataset,
                    currentEmbedding: metadata,
                })
                return
            }
        } else {
            // If no metadata exists, create one with the recommended embedding
            if (onUpdateMetadata) {
                const newMetadata = createVectorSetMetadata(
                    dataset.recommendedEmbedding as EmbeddingConfig,
                    `Automatically configured for ${dataset.name}`
                )
                onUpdateMetadata(newMetadata)
            }
        }

        // For image datasets, show confirmation dialog first
        if (dataset.name === "UTK Faces") {
            // Get the count of available images first
            try {
                const classesResponse = await fetch(
                    "/sample-data/UTKFace/images/_classes.csv"
                )
                if (!classesResponse.ok) {
                    throw new Error(
                        `Failed to fetch image classes: ${classesResponse.statusText}`
                    )
                }

                const classesText = await classesResponse.text()
                const lines = classesText
                    .split("\n")
                    .filter((line) => line.trim().length > 0)

                // Skip header row if it exists
                const startIdx = lines[0].startsWith("filename") ? 1 : 0
                const count = lines.length - startIdx

                // Set the available count and make sure import count doesn't exceed it
                setAvailableImageCount(count)
                setImportCount(Math.min(importCount, count))

                // Show the confirmation dialog
                setConfirmDialog({
                    open: true,
                    dataset,
                })
            } catch (error) {
                console.error("Error fetching image count:", error)
                setError(
                    `Failed to determine available image count: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                )
            }
            return
        }

        setSelectedDatasetObject(dataset)
        setViewMode("import")
        await importDataset(dataset)
    }

    // New function to handle starting the import from the UI
    const handleStartImport = () => {
        if (selectedDatasetObject) {
            console.log(
                `[ImportSampleData] Starting import for: ${selectedDatasetObject.name}`
            )
            setViewMode("import")
            importDataset(selectedDatasetObject)
        }
    }

    const importDataset = async (dataset: SampleDataset) => {
        console.log(
            `[ImportSampleData] importDataset called for: ${dataset.name}`
        )
        setError(null)
        setIsImporting(true)
        setImportProgress(null)
        setImportStarted(true) // Mark as started immediately to prevent duplicate calls

        try {
            // For regular CSV datasets
            if (dataset.dataType === "text") {
                // Step 1: Fetch the CSV file
                const response = await fetch(dataset.fileUrl)
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch sample dataset: ${response.statusText}`
                    )
                }

                // Convert the response to a Blob with CSV content type
                const csvBlob = await response.blob()

                // Create a File object from the Blob
                const file = new File(
                    [csvBlob],
                    `${dataset.name.toLowerCase().replace(/\s+/g, "-")}.csv`,
                    {
                        type: "text/csv",
                    }
                )

                // Step 2: Create the import job config
                const config: ImportJobConfig = {
                    delimiter: ",",
                    hasHeader: true,
                    skipRows: 0,
                    elementColumn: dataset.columns[0],
                    textColumn: dataset.columns[0],
                    elementTemplate: dataset.elementTemplate,
                    textTemplate: dataset.vectorTemplate,
                    attributeColumns: dataset.attributeColumns,
                    metadata: metadata || undefined,
                    fileType: "csv",
                }

                // Step 3: Create the import job
                await jobs.createImportJob(vectorSetName, file, config)
            }
            // For image dataset
            else {
                // Step 1: Get the list of images from the _classes.csv file
                const classesResponse = await fetch(
                    "/sample-data/UTKFace/images/_classes.csv"
                )
                if (!classesResponse.ok) {
                    throw new Error(
                        `Failed to fetch image classes: ${classesResponse.statusText}`
                    )
                }

                const classesText = await classesResponse.text()
                const lines = classesText
                    .split("\n")
                    .filter((line) => line.trim().length > 0)

                // Skip header row if it exists
                const startIdx = lines[0].startsWith("filename") ? 1 : 0

                // Prepare files to import (limit by importCount)
                const filesToImport = lines.slice(
                    startIdx,
                    startIdx + importCount
                )
                setImportProgress({ current: 0, total: filesToImport.length })

                const embeddings: number[][] = []

                // Process each image file
                for (let i = 0; i < filesToImport.length; i++) {
                    const line = filesToImport[i]
                    const [filename] = line.split(",")

                    // Fetch the image
                    const imageUrl = `/sample-data/UTKFace/images/${filename}`
                    const imageResponse = await fetch(imageUrl)
                    if (!imageResponse.ok) {
                        console.warn(`Could not fetch ${imageUrl}, skipping`)
                        continue
                    }

                    const imageBlob = await imageResponse.blob()

                    // Convert image to base64
                    const reader = new FileReader()
                    const imageDataPromise = new Promise<string>((resolve) => {
                        reader.onloadend = () => {
                            resolve(reader.result as string)
                        }
                    })
                    reader.readAsDataURL(imageBlob)
                    const imageData = await imageDataPromise

                    // Generate embedding
                    const imageConfig = { model: "mobilenet" }
                    const embedding = await getImageEmbedding(
                        imageData,
                        imageConfig
                    )
                    embeddings.push(embedding)

                    // Update progress
                    setImportProgress({
                        current: i + 1,
                        total: filesToImport.length,
                    })
                }

                // Create a sample image file for the import job
                // We'll use the first image as the representative file
                const sampleImageResponse = await fetch(
                    `/sample-data/UTKFace/images/${
                        filesToImport[0].split(",")[0]
                    }`
                )
                const sampleImageBlob = await sampleImageResponse.blob()
                const imageFile = new File(
                    [sampleImageBlob],
                    `UTK_Faces_${importCount}_images.jpg`,
                    {
                        type: "image/jpeg",
                    }
                )

                // Create job config with all the computed vectors
                const config: ImportJobConfig = {
                    delimiter: ",",
                    hasHeader: false,
                    skipRows: 0,
                    elementColumn: "image",
                    textColumn: "image",
                    elementTemplate: dataset.elementTemplate,
                    attributeColumns: dataset.attributeColumns,
                    metadata: metadata || undefined,
                    fileType: "images",
                    rawVectors: embeddings, // Include all pre-computed embeddings
                }

                // Create the import job
                await jobs.createImportJob(vectorSetName, imageFile, config)
            }

            setShowSuccessDialog(true)
            setIsImporting(false)
            setImportProgress(null)

            // Close the dialog after successful import
            onClose()
        } catch (error) {
            console.error("Error importing sample dataset:", error)
            setError(
                `Error importing sample dataset: ${
                    error instanceof Error ? error.message : String(error)
                }`
            )
            setIsImporting(false)
            setImportProgress(null)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="w-full">
                {viewMode === "import" ? (
                    <div className="mb-6">
                        <h3 className="text-lg mb-4">
                            {selectedDatasetObject
                                ? `Importing ${selectedDatasetObject.name}`
                                : "Importing Data"}
                        </h3>

                        <p className="text-gray-600 mb-4">
                            {!importStarted
                                ? "Click 'Start Import' to begin importing the selected dataset."
                                : "Your vector set has been created and the sample data is being imported. You can monitor the import progress from the Import Data tab."}
                        </p>

                        {selectedDatasetObject && !importStarted && (
                            <div className="bg-white rounded-lg border p-4 mb-4">
                                <div className="flex items-center mb-4">
                                    <div className="mr-3 bg-gray-50 p-2 rounded-full">
                                        {selectedDatasetObject.icon}
                                    </div>
                                    <h3 className="text-lg font-medium">
                                        {selectedDatasetObject.name}
                                    </h3>
                                    <Badge variant="outline" className="ml-2">
                                        {selectedDatasetObject.dataType}
                                    </Badge>
                                </div>

                                <p className="text-sm text-gray-600 mb-4">
                                    {selectedDatasetObject.description}
                                </p>

                                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                                    <span>
                                        Records:{" "}
                                        {selectedDatasetObject.recordCount.toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex items-center text-xs text-gray-500 mb-2">
                                    <span className="font-medium mr-1">
                                        Embedding Model:
                                    </span>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                        title="Recommended embedding provider and model"
                                    >
                                        {
                                            selectedDatasetObject
                                                .recommendedEmbedding.provider
                                        }
                                        {selectedDatasetObject
                                            .recommendedEmbedding.provider ===
                                            "openai" &&
                                            selectedDatasetObject
                                                .recommendedEmbedding.openai
                                                ?.model &&
                                            `: ${selectedDatasetObject.recommendedEmbedding.openai.model}`}
                                        {selectedDatasetObject
                                            .recommendedEmbedding.provider ===
                                            "tensorflow" &&
                                            selectedDatasetObject
                                                .recommendedEmbedding.tensorflow
                                                ?.model &&
                                            `: ${selectedDatasetObject.recommendedEmbedding.tensorflow.model}`}
                                        {selectedDatasetObject
                                            .recommendedEmbedding.provider ===
                                            "image" &&
                                            selectedDatasetObject
                                                .recommendedEmbedding.image
                                                ?.model &&
                                            `: ${selectedDatasetObject.recommendedEmbedding.image.model}`}
                                    </Badge>
                                </div>
                            </div>
                        )}

                        {importProgress && (
                            <div className="mb-4">
                                <div className="flex flex-col space-y-2">
                                    <p className="text-sm">
                                        Importing: {importProgress.current} of{" "}
                                        {importProgress.total}
                                    </p>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div
                                            className="bg-primary h-2.5 rounded-full"
                                            style={{
                                                width: `${
                                                    (importProgress.current /
                                                        importProgress.total) *
                                                    100
                                                }%`,
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            {!selectionMode && !importStarted && (
                                <Button
                                    variant="outline"
                                    onClick={() => setViewMode("select")}
                                >
                                    Change Dataset
                                </Button>
                            )}

                            {importStarted ? (
                                <Button variant="default" onClick={onClose}>
                                    Close and Go to Vector Set
                                </Button>
                            ) : (
                                <Button
                                    variant="default"
                                    onClick={handleStartImport}
                                    disabled={
                                        isImporting || !selectedDatasetObject
                                    }
                                >
                                    {isImporting
                                        ? "Importing..."
                                        : "Start Import"}
                                </Button>
                            )}
                        </div>

                        {error && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="text-lg font-medium mb-4">
                            Sample Datasets
                        </div>

                        {selectionMode && (
                            <p className="text-gray-600 mb-4">
                                Select a sample dataset to import after creating
                                your vector set
                            </p>
                        )}

                        {useShadcnCarousel ? (
                            <div className="relative w-full overflow-visible px-12">
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
                                                <div
                                                    className={`bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col h-full max-w-full
                                                      ${
                                                          selectionMode &&
                                                          selectedDataset ===
                                                              dataset.name
                                                              ? "ring-2 ring-primary border-primary"
                                                              : ""
                                                      }`}
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

                                                        <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                                                            <span>
                                                                Records:{" "}
                                                                {dataset.recordCount.toLocaleString()}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center text-xs text-gray-500 mb-2">
                                                            <span className="font-medium mr-1">
                                                                Embedding Model:
                                                            </span>
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                                title="Recommended embedding provider and model"
                                                            >
                                                                {
                                                                    dataset.recommendedEmbedding
                                                                        .provider
                                                                }
                                                                {dataset.recommendedEmbedding
                                                                    .provider === "openai" &&
                                                                    dataset.recommendedEmbedding
                                                                        .openai?.model &&
                                                                    `: ${dataset.recommendedEmbedding.openai.model}`}
                                                                {dataset.recommendedEmbedding
                                                                    .provider ===
                                                                    "tensorflow" &&
                                                                    dataset.recommendedEmbedding
                                                                        .tensorflow?.model &&
                                                                    `: ${dataset.recommendedEmbedding.tensorflow.model}`}
                                                                {dataset.recommendedEmbedding
                                                                    .provider === "image" &&
                                                                    dataset.recommendedEmbedding
                                                                        .image?.model &&
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
                                                            {dataset.columns
                                                                .slice(0, 6)
                                                                .join(", ")}
                                                            {dataset.columns.length > 6
                                                                ? "..."
                                                                : ""}
                                                        </div>
                                                    </div>

                                                    <div className="border-t p-4">
                                                        <Button
                                                            variant={
                                                                selectionMode &&
                                                                selectedDataset === dataset.name
                                                                    ? "secondary"
                                                                    : "default"
                                                            }
                                                            className="w-full"
                                                            onClick={() =>
                                                                handleImportSampleDataset(
                                                                    dataset
                                                                )
                                                            }
                                                            disabled={isImporting}
                                                        >
                                                            {isImporting
                                                                ? "Importing..."
                                                                : selectionMode
                                                                ? selectedDataset ===
                                                                  dataset.name
                                                                    ? "Selected"
                                                                    : "Select Dataset"
                                                                : "Select Dataset"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CarouselItem>
                                        ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-white border shadow-sm" />
                                    <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-white border shadow-sm" />
                                </Carousel>
                            </div>
                        ) : (
                            <div 
                                className={carouselMode 
                                    ? "flex overflow-x-auto space-x-6 pb-4 snap-x snap-mandatory no-scrollbar" 
                                    : "grid grid-cols-1 md:grid-cols-2 gap-6"
                                }
                                id="dataset-carousel"
                                style={carouselMode ? { 
                                    scrollbarWidth: 'none', 
                                    msOverflowStyle: 'none' 
                                } : {}}
                            >
                                {sampleDatasets.map((dataset) => (
                                    <div
                                        key={dataset.name}
                                        className={`${carouselMode 
                                            ? "flex-shrink-0 snap-center min-w-[330px] max-w-[330px]" 
                                            : ""} 
                                          bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col 
                                          ${
                                              selectionMode &&
                                              selectedDataset ===
                                                  dataset.name
                                                  ? "ring-2 ring-primary border-primary"
                                                  : ""
                                          }`}
                                    >
                                        <div className="p-6 flex-grow">
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

                                            <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                                                <span>
                                                    Records:{" "}
                                                    {dataset.recordCount.toLocaleString()}
                                                </span>
                                            </div>

                                            <div className="flex items-center text-xs text-gray-500 mb-2">
                                                <span className="font-medium mr-1">
                                                    Embedding Model:
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs"
                                                    title="Recommended embedding provider and model"
                                                >
                                                    {
                                                        dataset.recommendedEmbedding
                                                            .provider
                                                    }
                                                    {dataset.recommendedEmbedding
                                                        .provider === "openai" &&
                                                        dataset.recommendedEmbedding
                                                            .openai?.model &&
                                                        `: ${dataset.recommendedEmbedding.openai.model}`}
                                                    {dataset.recommendedEmbedding
                                                        .provider ===
                                                        "tensorflow" &&
                                                        dataset.recommendedEmbedding
                                                            .tensorflow?.model &&
                                                        `: ${dataset.recommendedEmbedding.tensorflow.model}`}
                                                    {dataset.recommendedEmbedding
                                                        .provider === "image" &&
                                                        dataset.recommendedEmbedding
                                                            .image?.model &&
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
                                                        {dataset.columns
                                                            .slice(0, 6)
                                                            .join(", ")}
                                                        {dataset.columns.length > 6
                                                            ? "..."
                                                            : ""}
                                                    </div>
                                        </div>

                                        <div className="border-t p-4">
                                            <Button
                                                variant={
                                                    selectionMode &&
                                                    selectedDataset === dataset.name
                                                        ? "secondary"
                                                        : "default"
                                                }
                                                className="w-full"
                                                onClick={() =>
                                                    handleImportSampleDataset(
                                                        dataset
                                                    )
                                                }
                                                disabled={isImporting}
                                            >
                                                {isImporting
                                                    ? "Importing..."
                                                    : selectionMode
                                                    ? selectedDataset ===
                                                      dataset.name
                                                        ? "Selected"
                                                        : "Select Dataset"
                                                    : "Select Dataset"}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {!selectionMode && (
                            <div className="flex justify-end mt-6">
                                <Button
                                    variant="default"
                                    onClick={() => {
                                        if (selectedDatasetObject) {
                                            setViewMode("import")
                                        } else {
                                            // If no dataset selected, just close
                                            onClose()
                                        }
                                    }}
                                >
                                    {selectedDatasetObject
                                        ? "Continue"
                                        : "Cancel"}
                                </Button>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive" className="mt-4">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </>
                )}
            </div>

            {/* Confirmation Dialog for UTK Faces */}
            <Dialog
                open={confirmDialog.open}
                onOpenChange={(open) =>
                    setConfirmDialog({ ...confirmDialog, open })
                }
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import UTK Faces Dataset</DialogTitle>
                        <DialogDescription>
                            The UTK Faces dataset contains over 20,000 face
                            images. Choose how many sample images to import
                            using the slider below.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Image
                            src="/sample-data/UTKFace/samples.png"
                            alt="UTK Faces sample"
                            width={400}
                            height={200}
                            className="rounded-md object-cover mb-4"
                        />

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="import-count">
                                    Number of images to import: {importCount}
                                </Label>
                                <Slider
                                    id="import-count"
                                    min={1}
                                    max={availableImageCount}
                                    step={1}
                                    value={[importCount]}
                                    onValueChange={(value) =>
                                        setImportCount(value[0])
                                    }
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>1</span>
                                    <span>
                                        {Math.round(availableImageCount / 2)}
                                    </span>
                                    <span>{availableImageCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setConfirmDialog({ open: false, dataset: null })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                setConfirmDialog({ open: false, dataset: null })
                                if (confirmDialog.dataset) {
                                    importDataset(confirmDialog.dataset)
                                }
                            }}
                        >
                            Import {importCount} Images
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Embedding Mismatch Dialog */}
            <Dialog
                open={embeddingMismatch.open}
                onOpenChange={(open) =>
                    setEmbeddingMismatch({ ...embeddingMismatch, open })
                }
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Embedding Type Mismatch</DialogTitle>
                        <DialogDescription>
                            {embeddingMismatch.dataset?.dataType === "image"
                                ? "This dataset contains images, but your current embedding engine is configured for text."
                                : "This dataset contains text, but your current embedding engine is configured for images."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm mb-4">
                            To proceed, we need to switch your embedding engine
                            to one that is compatible with{" "}
                            {embeddingMismatch.dataset?.dataType} data.
                        </p>
                        <div className="flex flex-col gap-4 bg-gray-50 p-3 rounded-md">
                            <div>
                                <h4 className="text-sm font-medium mb-1">
                                    Current Configuration
                                </h4>
                                <div className="flex items-center gap-2">
                                    <Badge className="text-xs">Provider</Badge>
                                    <span className="text-sm">
                                        {
                                            embeddingMismatch.currentEmbedding
                                                ?.embedding.provider
                                        }
                                    </span>
                                </div>
                                {embeddingMismatch.currentEmbedding?.embedding
                                    .provider === "openai" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs">Model</Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch
                                                    .currentEmbedding.embedding
                                                    .openai?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {embeddingMismatch.currentEmbedding?.embedding
                                    .provider === "tensorflow" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs">Model</Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch
                                                    .currentEmbedding.embedding
                                                    .tensorflow?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {embeddingMismatch.currentEmbedding?.embedding
                                    .provider === "image" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs">Model</Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch
                                                    .currentEmbedding.embedding
                                                    .image?.model
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-medium mb-1">
                                    Recommended Configuration
                                </h4>
                                <div className="flex items-center gap-2">
                                    <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                        Provider
                                    </Badge>
                                    <span className="text-sm">
                                        {
                                            embeddingMismatch.dataset
                                                ?.recommendedEmbedding.provider
                                        }
                                    </span>
                                </div>
                                {embeddingMismatch.dataset?.recommendedEmbedding
                                    .provider === "openai" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch.dataset
                                                    ?.recommendedEmbedding
                                                    .openai?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {embeddingMismatch.dataset?.recommendedEmbedding
                                    .provider === "tensorflow" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch.dataset
                                                    ?.recommendedEmbedding
                                                    .tensorflow?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {embeddingMismatch.dataset?.recommendedEmbedding
                                    .provider === "image" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                embeddingMismatch.dataset
                                                    ?.recommendedEmbedding.image
                                                    ?.model
                                            }
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() =>
                                setEmbeddingMismatch({
                                    open: false,
                                    dataset: null,
                                    currentEmbedding: null,
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                if (
                                    embeddingMismatch.dataset &&
                                    onUpdateMetadata
                                ) {
                                    // Create new metadata with the recommended embedding
                                    const newMetadata = createVectorSetMetadata(
                                        embeddingMismatch.dataset
                                            .recommendedEmbedding as EmbeddingConfig,
                                        embeddingMismatch.currentEmbedding
                                            ?.description ||
                                            `Automatically configured for ${embeddingMismatch.dataset.name}`
                                    )

                                    // Update parent component's metadata
                                    onUpdateMetadata(newMetadata)

                                    // Close dialog and continue with import
                                    setEmbeddingMismatch({
                                        open: false,
                                        dataset: null,
                                        currentEmbedding: null,
                                    })
                                    importDataset(embeddingMismatch.dataset)
                                }
                            }}
                        >
                            Switch & Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
