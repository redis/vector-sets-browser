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
import { getDefaultEmbeddingConfig } from "@/app/utils/embeddingUtils"
import { SampleDataset, sampleDatasets as configuredDatasets } from "./SampleDataSelect"

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
    const [embeddingConfigs, setEmbeddingConfigs] = useState<Record<string, EmbeddingConfig>>({})

    // Mode tracking - separating selection from import view
    const [viewMode, setViewMode] = useState<"select" | "import">(
        selectionMode ? "select" : "import"
    )

    // Load embedding configs when component mounts
    useEffect(() => {
        async function loadEmbeddingConfigs() {
            const configs: Record<string, EmbeddingConfig> = {};
            
            for (const dataset of configuredDatasets) {
                const config = await getDefaultEmbeddingConfig(dataset.embeddingType);
                configs[dataset.name] = config;
            }
            
            setEmbeddingConfigs(configs);
        }
        
        loadEmbeddingConfigs();
    }, []);

    // Use configured datasets from SampleDataSelect
    const sampleDatasets = configuredDatasets;

    // Track the selected dataset
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
        if (!currentMetadata || !currentMetadata.embedding) return true;
        
        // Get the embedding config for this dataset
        const embeddingConfig = embeddingConfigs[dataset.name];
        if (!embeddingConfig) return true; // If not loaded yet, assume compatible
        
        // Check if the embedding types match
        const isCurrentText = isTextEmbedding(currentMetadata.embedding);
        const isCurrentImage = isImageEmbedding(currentMetadata.embedding);
        
        if (dataset.embeddingType === "text" && isCurrentText) return true;
        if (dataset.embeddingType === "image" && isCurrentImage) return true;
        
        return false;
    }

    const handleImportSampleDataset = async (dataset: SampleDataset) => {
        // First check if this dataset is compatible with the current embedding settings
        if (metadata && !isEmbeddingCompatible(dataset, metadata)) {
            // If not compatible, show the mismatch dialog
            setEmbeddingMismatch({
                open: true,
                dataset: dataset,
                currentEmbedding: metadata,
            })
            return
        }

        // If there's no metadata or we're starting fresh, confirm with the user
        setConfirmDialog({
            open: true,
            dataset: dataset,
        })
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
        try {
            setError(null)
            setIsImporting(true)
            setImportStarted(true)
            
            // Get the embedding config for this dataset
            const embeddingConfig = embeddingConfigs[dataset.name] || 
                await getDefaultEmbeddingConfig(dataset.embeddingType);

            // Create job configuration
            const jobConfig: ImportJobConfig = {
                vectorSetName,
                datasetName: dataset.name,
                sourceUrl: dataset.fileUrl,
                fileColumns: dataset.columns,
                elementTemplate: dataset.elementTemplate,
                vectorTemplate: dataset.vectorTemplate,
                attributeColumns: dataset.attributeColumns,
                dataType: dataset.dataType,
                importLimit: dataset.dataType === "image" ? importCount : undefined,
                embedding: embeddingConfig,
            }

            const jobId = await jobs.createImportJob(jobConfig)
            const result = await jobs.startImportJob(jobId)

            setImportProgress(null)
            setShowSuccessDialog(true)
        } catch (err) {
            console.error("Error importing sample data:", err)
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to import sample data"
            )
        } finally {
            setIsImporting(false)
        }
    }

    // Handle embedding mismatch resolution
    const handleUpdateEmbedding = async () => {
        if (!embeddingMismatch.dataset) return;
        
        try {
            // Get the appropriate embedding config for the dataset
            const datasetName = embeddingMismatch.dataset.name;
            const embeddingConfig = embeddingConfigs[datasetName] || 
                await getDefaultEmbeddingConfig(embeddingMismatch.dataset.embeddingType);
            
            // Update the vector set's metadata with the new embedding config
            if (onUpdateMetadata && embeddingMismatch.dataset) {
                const newMetadata = {
                    ...metadata,
                    embedding: embeddingConfig,
                };
                onUpdateMetadata(newMetadata);
            }
            
            // Close the dialog and continue with import
            setEmbeddingMismatch({ open: false, dataset: null, currentEmbedding: null });
            
            // Show the confirm dialog
            setConfirmDialog({
                open: true,
                dataset: embeddingMismatch.dataset,
            });
        } catch (err) {
            console.error("Error updating embedding configuration:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to update embedding configuration"
            );
        }
    };

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
                            <div className="bg-[white] rounded-lg border p-4 mb-4">
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
                                                    className={`bg-[white] rounded-lg border shadow-sm overflow-hidden flex flex-col h-full max-w-full
                                                      ${
                                                          selectionMode &&
                                                          selectedDataset ===
                                                              dataset.name
                                                              ? "ring-2 ring-primary border-primary"
                                                              : ""
                                                      }`}
                                                >
                                                    <div className="p-4 grow">
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
                                    <CarouselPrevious className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
                                    <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
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
                                            ? "shrink-0 snap-center min-w-[330px] max-w-[330px]" 
                                            : ""} 
                                          bg-[white] rounded-lg border shadow-sm overflow-hidden flex flex-col 
                                          ${
                                              selectionMode &&
                                              selectedDataset ===
                                                  dataset.name
                                                  ? "ring-2 ring-primary border-primary"
                                                  : ""
                                          }`}
                                    >
                                        <div className="p-6 grow">
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
                            onClick={handleUpdateEmbedding}
                        >
                            Switch & Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
