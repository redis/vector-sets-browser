"use client"

import { jobs } from "@/app/api/jobs"
import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"
import { vcard, vrem, vsim } from "@/app/redis-server/api"
import { VectorSetMetadata, createVectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { AlertCircle, Edit2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Dataset } from "../types/DatasetProvider"

interface SampleDataImporterProps {
    dataset: Dataset
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
    const [importCount, setImportCount] = useState<number>(5)
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

    const handleStartImport = async () => {
        setError(null)

        // Check compatibility
        if (metadata) {
            const isCompatible = dataset.validateEmbedding(metadata.embedding)

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
        setImportStarted(true)

        try {
            await checkAndRemovePlaceholderRecord()

            const { file, config } = await dataset.prepareImport({
                count: dataset.dataType === "image" ? importCount : undefined
            })

            if (metadata) {
                config.metadata = metadata
            }

            // Create the import job
            await jobs.createImportJob(vectorSetName, file, config)
        } catch (error) {
            console.error("Error importing sample dataset:", error)
            setError(
                `Error importing sample dataset: ${error instanceof Error ? error.message : String(error)
                }`
            )
            setIsImporting(false)
        }
    }

    // Function to check if the vectorset has only one record with "First Record (Default)"
    // and delete it if found to prevent issues with embedding type or REDUCE option
    const checkAndRemovePlaceholderRecord = async () => {
        try {
            // Check how many records are in the vector set
            const count = await vcard({ keyName: vectorSetName });

            // If there's only one record, check if it's the default placeholder
            if (count.result === 1) {
                // Get the record using vsim with high count to ensure we get the record
                const searchResult = await vsim({
                    keyName: vectorSetName,
                    count: 1,
                    searchElement: "First Vector (Default)"
                })

                if (searchResult.result) {
                    const recordName = searchResult.result[0][0]; // First element, element name

                    // Check if it's the default placeholder record
                    if (recordName === "First Vector (Default)") {
                        console.log("Removing placeholder record before import:", recordName);

                        // Delete the default record
                        await vrem({
                            keyName: vectorSetName,
                            element: recordName
                        });

                        console.log("Placeholder record removed successfully");
                    }
                }
            }
        } catch (error) {
            // Log but don't throw error - this is a best-effort operation
            console.error("Error checking/removing placeholder record:", error);
            // Continue with import regardless of this error
        }
    };

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
                                {dataset.dataType === "image" ?
                                    " You can specify how many images to import." :
                                    ""}
                            </p>

                            {/* Image count slider for image datasets */}
                            {dataset.dataType === "image" && (
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

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {!error && importStarted && (
                <p>
                    Import started. Track progress on the Import Tab.
                </p>
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