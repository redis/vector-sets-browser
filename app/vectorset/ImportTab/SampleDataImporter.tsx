"use client"

import { useState, useEffect } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Edit2, CheckCircle2 } from "lucide-react"
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
import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import { EmbeddingConfig } from "@/app/embeddings/types/config"

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
    const [isEditingEmbedding, setIsEditingEmbedding] = useState(false)
    const [currentEmbeddingConfig, setCurrentEmbeddingConfig] = useState<EmbeddingConfig | null>(
        dataset.recommendedEmbedding || null
    )

    // Initialize the current embedding config from dataset's recommended embedding
    useEffect(() => {
        if (dataset && dataset.recommendedEmbedding) {
            setCurrentEmbeddingConfig(dataset.recommendedEmbedding)
        }
    }, [dataset])

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
            // If no metadata exists, create one with the current embedding config
            if (onUpdateMetadata && currentEmbeddingConfig) {
                const newMetadata = createVectorSetMetadata(
                    currentEmbeddingConfig,
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

    const handleEditEmbedding = () => {
        setIsEditingEmbedding(true)
    }

    const handleSaveEmbeddingConfig = (config: EmbeddingConfig) => {
        setCurrentEmbeddingConfig(config)
        setIsEditingEmbedding(false)
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
            {!importStarted && (
                <>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold">Dataset Summary</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Name:</span> {dataset.name}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Record Count:</span> {dataset.recordCount}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">Data Type:</span> {dataset.dataType}
                                </p>
                            </div>
                            <div>
                                <div className="flex flex-col">
                                    <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center gap-1">
                                            <span className="font-medium">Embedding Engine:</span> 
                                            <Badge variant="secondary" className="text-xs">
                                                {currentEmbeddingConfig?.provider}
                                                {currentEmbeddingConfig?.provider === "ollama" && 
                                                    currentEmbeddingConfig.ollama?.modelName && 
                                                    `: ${currentEmbeddingConfig.ollama.modelName}`}
                                                {currentEmbeddingConfig?.provider === "openai" &&
                                                    currentEmbeddingConfig.openai?.model &&
                                                    `: ${currentEmbeddingConfig.openai.model}`}
                                                {currentEmbeddingConfig?.provider === "tensorflow" &&
                                                    currentEmbeddingConfig.tensorflow?.model &&
                                                    `: ${currentEmbeddingConfig.tensorflow.model}`}
                                                {currentEmbeddingConfig?.provider === "image" &&
                                                    currentEmbeddingConfig.image?.model &&
                                                    `: ${currentEmbeddingConfig.image.model}`}
                                            </Badge>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="p-1 h-auto"
                                            onClick={handleEditEmbedding}
                                        >
                                            <Edit2 className="h-3.5 w-3.5 mr-1" />
                                            Change
                                        </Button>
                                    </div>
                                    
                                    {currentEmbeddingConfig?.provider === "ollama" && (
                                        <div className="text-xs text-green-600 font-medium mt-1">
                                            ✓ Using locally installed Ollama
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3">Import Preview</h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <p className="text-sm mb-3">
                                This will import the {dataset.name} dataset into your vector set.
                                {dataset.name === "UTK Faces" ? 
                                    " You can specify how many images to import." : 
                                    ""}
                            </p>
                            
                            {/* Image count slider for UTK Faces */}
                            {dataset.name === "UTK Faces" && (
                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between">
                                        <Label htmlFor="import-count">
                                            Number of images to import:
                                        </Label>
                                        <span className="font-medium">{importCount}</span>
                                    </div>
                                    <Slider 
                                        id="import-count"
                                        min={1}
                                        max={100}
                                        step={1}
                                        value={[importCount]}
                                        onValueChange={(values) => setImportCount(values[0])}
                                    />
                                    <p className="text-xs text-gray-500">
                                        Note: Images will be imported in batches
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-auto">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button onClick={handleStartImport} disabled={isImporting}>
                            Start Import
                        </Button>
                    </div>
                </>
            )}

            {/* Import progress */}
            {importStarted && (
                <>
                    <h3 className="text-lg mb-4">Importing {dataset.name}</h3>
                    {/* Progress UI */}
                    {importProgress && (
                        <div className="my-4">
                            <div className="flex justify-between text-sm mb-1">
                                <span>Progress</span>
                                <span>
                                    {importProgress.current} / {importProgress.total}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                                <div
                                    className="bg-blue-600 h-2.5 rounded-full"
                                    style={{
                                        width: `${Math.round(
                                            (importProgress.current /
                                                importProgress.total) *
                                                100
                                        )}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    )}
                    
                    <div className="flex justify-end mt-auto">
                        <Button variant="default" onClick={() => {
                            console.log("Import complete button clicked, closing dialog");
                            onClose();
                        }}>
                            {isImporting 
                              ? "Close" 
                              : "Import Complete - Close and Go to Vector Set"}
                        </Button>
                    </div>
                </>
            )}

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!error && importStarted && !isImporting && (
                <Alert variant="default" className="mt-4 bg-green-50 border-green-200">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700">
                        Import completed successfully! Click the button above to return to the Vector Set.
                    </AlertDescription>
                </Alert>
            )}

            {/* Edit embedding config dialog */}
            {isEditingEmbedding && (
                <EditEmbeddingConfigModal
                    isOpen={isEditingEmbedding}
                    onClose={() => setIsEditingEmbedding(false)}
                    config={currentEmbeddingConfig || undefined}
                    onSave={handleSaveEmbeddingConfig}
                    dataFormat={dataset.embeddingType}
                />
            )}

            {/* Image count dialog */}
            <Dialog open={showImageCountDialog} onOpenChange={setShowImageCountDialog}>
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

            {/* Embedding mismatch dialog */}
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