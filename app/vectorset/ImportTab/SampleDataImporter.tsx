"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { SampleDataset } from "./SampleDataSelect"
import { VectorSetMetadata, isImageEmbedding, isTextEmbedding, createVectorSetMetadata } from "@/app/embeddings/types/config"
import { jobs, ImportJobConfig } from "@/app/api/jobs"
import { getImageEmbedding } from "@/app/utils/imageEmbedding"

interface SampleDataImporterProps {
    dataset: SampleDataset
    vectorSetName: string
    metadata: VectorSetMetadata | null
    onUpdateMetadata?: (metadata: VectorSetMetadata) => void
    onClose: () => void
}

export function SampleDataImporter({
    dataset,
    vectorSetName,
    metadata,
    onUpdateMetadata,
    onClose
}: SampleDataImporterProps) {
    const [error, setError] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [importProgress, setImportProgress] = useState<{
        current: number
        total: number
    } | null>(null)
    const [importCount, setImportCount] = useState<number>(5)
    const [availableImageCount, setAvailableImageCount] = useState<number>(100)
    const [showImageCountDialog, setShowImageCountDialog] = useState(false)
    const [embeddingMismatch, setEmbeddingMismatch] = useState<{
        open: boolean
        currentEmbedding: VectorSetMetadata | null
    }>({ open: false, currentEmbedding: null })

    // Check if the embedding is compatible with the dataset
    const isEmbeddingCompatible = (
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

    const handleStartImport = async () => {
        setError(null)
        
        // Check compatibility
        if (metadata) {
            const isCompatible = isEmbeddingCompatible(metadata)

            if (!isCompatible) {
                // Show mismatch dialog
                setEmbeddingMismatch({
                    open: true,
                    currentEmbedding: metadata,
                })
                return
            }
        } else {
            // If no metadata exists, create one with the recommended embedding
            if (onUpdateMetadata) {
                const newMetadata = createVectorSetMetadata(
                    dataset.recommendedEmbedding,
                    `Automatically configured for ${dataset.name}`
                )
                onUpdateMetadata(newMetadata)
            }
        }

        // For image datasets, show the image count dialog first
        if (dataset.name === "UTK Faces") {
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
                setShowImageCountDialog(true)
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

        // For non-image datasets, start import directly
        startImport()
    }

    const startImport = async () => {
        setIsImporting(true)
        setImportProgress(null)
        setImportStarted(true)

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

            setIsImporting(false)
            setImportProgress(null)
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
            {importStarted && (
                <h3 className="text-lg mb-4">`Importing ${dataset.name}`</h3>
            )}

            <div className="bg-white rounded-lg border p-4 mb-4">
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

                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                    <span>Records: {dataset.recordCount.toLocaleString()}</span>
                </div>

                <div className="flex items-center text-xs text-gray-500 mb-2">
                    <span className="font-medium mr-1">Embedding Model:</span>
                    <Badge
                        variant="secondary"
                        className="text-xs"
                        title="Recommended embedding provider and model"
                    >
                        {dataset.recommendedEmbedding.provider}
                        {dataset.recommendedEmbedding.provider === "openai" &&
                            dataset.recommendedEmbedding.openai?.model &&
                            `: ${dataset.recommendedEmbedding.openai.model}`}
                        {dataset.recommendedEmbedding.provider ===
                            "tensorflow" &&
                            dataset.recommendedEmbedding.tensorflow?.model &&
                            `: ${dataset.recommendedEmbedding.tensorflow.model}`}
                        {dataset.recommendedEmbedding.provider === "image" &&
                            dataset.recommendedEmbedding.image?.model &&
                            `: ${dataset.recommendedEmbedding.image.model}`}
                    </Badge>
                </div>
            </div>

            <p className="text-gray-600 mb-4">
                {!importStarted
                    ? "Click 'Start Import' to begin importing the selected dataset."
                    : "Your vector set has been created and the sample data is being imported. You can monitor the import progress from the Import Data tab."}
            </p>

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

            <div className="flex gap-3 w-full">
                <div className="grow"></div>
                {importStarted ? (
                    <Button variant="default" onClick={onClose}>
                        Close and Go to Vector Set
                    </Button>
                ) : (
                    <>
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={handleStartImport}
                            disabled={isImporting}
                        >
                            {isImporting ? "Importing..." : "Start Import"}
                        </Button>
                    </>
                )}
            </div>

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Image Count Dialog for UTK Faces */}
            <Dialog
                open={showImageCountDialog}
                onOpenChange={setShowImageCountDialog}
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
                            onClick={() => setShowImageCountDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                setShowImageCountDialog(false)
                                startImport()
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
                            {dataset.dataType === "image"
                                ? "This dataset contains images, but your current embedding engine is configured for text."
                                : "This dataset contains text, but your current embedding engine is configured for images."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm mb-4">
                            To proceed, we need to switch your embedding engine
                            to one that is compatible with {dataset.dataType}{" "}
                            data.
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
                                        {dataset.recommendedEmbedding.provider}
                                    </span>
                                </div>
                                {dataset.recommendedEmbedding.provider ===
                                    "openai" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                dataset.recommendedEmbedding
                                                    .openai?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {dataset.recommendedEmbedding.provider ===
                                    "tensorflow" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                dataset.recommendedEmbedding
                                                    .tensorflow?.model
                                            }
                                        </span>
                                    </div>
                                )}
                                {dataset.recommendedEmbedding.provider ===
                                    "image" && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="text-xs bg-green-100 text-green-800 hover:bg-green-100">
                                            Model
                                        </Badge>
                                        <span className="text-sm">
                                            {
                                                dataset.recommendedEmbedding
                                                    .image?.model
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
                                    currentEmbedding: null,
                                })
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            onClick={() => {
                                if (onUpdateMetadata) {
                                    // Create new metadata with the recommended embedding
                                    const newMetadata = createVectorSetMetadata(
                                        dataset.recommendedEmbedding,
                                        embeddingMismatch.currentEmbedding
                                            ?.description ||
                                            `Automatically configured for ${dataset.name}`
                                    )

                                    // Update parent component's metadata
                                    onUpdateMetadata(newMetadata)

                                    // Close dialog and continue with import
                                    setEmbeddingMismatch({
                                        open: false,
                                        currentEmbedding: null,
                                    })
                                    startImport()
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