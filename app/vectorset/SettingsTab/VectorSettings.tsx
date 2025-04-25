import { vectorSets } from "@/app/api/vector-sets"
import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import {
    EmbeddingConfig,
    getEmbeddingDataFormat,
    getExpectedDimensions,
    getModelName,
    getProviderInfo
} from "@/app/embeddings/types/embeddingModels"
import { vadd, vcard, vdim, vrem, vsim } from "@/app/redis-server/api"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import AdvancedConfigEdit from "../AdvancedConfigEdit"
import { DEFAULT_EMBEDDING, DEFAULT_EMBEDDING_CONFIG } from "../constants"
import { 
    getEmbeddingIcon, 
    ImageEmbeddingIcon, 
    MultiModalEmbeddingIcon, 
    TextEmbeddingIcon 
} from "@/app/components/EmbeddingConfig/EmbeddingIcons"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"

interface VectorSettingsProps {
    vectorSetName: string
    metadata: VectorSetMetadata | null
    onMetadataUpdate?: (metadata: VectorSetMetadata) => void
}

export default function VectorSettings({
    vectorSetName,
    metadata,
    onMetadataUpdate,
}: VectorSettingsProps) {
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [isAdvancedConfigPanelOpen, setIsAdvancedConfigPanelOpen] =
        useState(false)
    const [workingMetadata, setWorkingMetadata] =
        useState<VectorSetMetadata | null>(null)
    const [isWarningDialogOpen, setIsWarningDialogOpen] = useState(false)
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false)
    const [pendingEmbeddingConfig, setPendingEmbeddingConfig] =
        useState<EmbeddingConfig | null>(null)
    const [successInfo, setSuccessInfo] = useState<{oldModel: string, newModel: string, dimensions: number} | null>(null)
    const [actualVectorDim, setActualVectorDim] = useState<number | null>(null)
    const [dimensionMismatch, setDimensionMismatch] = useState(false)

    // Fetch actual vector dimensions from Redis
    useEffect(() => {
        const fetchVectorDimensions = async () => {
            if (!vectorSetName) return;
            
            try {
                const dimResponse = await vdim({ keyName: vectorSetName });
                if (dimResponse.success && dimResponse.result !== undefined) {
                    setActualVectorDim(dimResponse.result);
                    
                    // Check for dimension mismatch
                    if (metadata?.embedding) {
                        const expectedDimensions = getExpectedDimensions(metadata.embedding);
                        setDimensionMismatch(expectedDimensions > 0 && dimResponse.result !== expectedDimensions);
                    }
                }
            } catch (error) {
                console.error("[VectorSettings] Error fetching vector dimensions:", error);
            }
        };
        
        fetchVectorDimensions();
    }, [vectorSetName, metadata]);

    const handleEditConfig = async (newConfig: EmbeddingConfig) => {
        try {
            if (!vectorSetName) {
                throw new Error("No vector set selected")
            }

            // Check if this is a different embedding model
            const isEmbeddingModelChange =
                metadata?.embedding &&
                (metadata.embedding.provider !== newConfig.provider ||
                    getModelName(metadata.embedding) !==
                        getModelName(newConfig))

            if (isEmbeddingModelChange) {
                // Check vector count
                const countResponse = await vcard({ keyName: vectorSetName })
                if (!countResponse.success) {
                    throw new Error("Failed to get vector count")
                }

                if (countResponse.result === 1) {
                    // Check if it's the default vector
                    const searchResult = await vsim({
                        keyName: vectorSetName,
                        count: 1,
                        searchElement: "Placeholder (Vector)",
                    })

                    if (
                        searchResult.success &&
                        searchResult.result &&
                        searchResult.result.length > 0
                    ) {
                        const recordName = searchResult.result[0][0]
                        if (recordName === "Placeholder (Vector)") {
                            // Delete the default vector
                            await vrem({
                                keyName: vectorSetName,
                                element: recordName,
                            })

                            // Add back the default vector (with the new config)
                            const dimensions =
                                getExpectedDimensions(newConfig) ||
                                DEFAULT_EMBEDDING.DIMENSIONS

                            const addResponse = await vadd({
                                keyName: vectorSetName,
                                element: "Placeholder (Vector)",
                                vector: Array(dimensions).fill(0),
                                reduceDimensions:
                                    metadata?.redisConfig?.reduceDimensions,
                                quantization:
                                    metadata?.redisConfig?.quantization,
                            })

                            if (!addResponse.success) {
                                throw new Error(
                                    `Failed to add default vector: ${addResponse.error}`
                                )
                            }

                            // Store success info before the update
                            setSuccessInfo({
                                oldModel: getModelName(metadata.embedding),
                                newModel: getModelName(newConfig),
                                dimensions
                            })

                            // Proceed with the update
                            await saveEmbeddingConfig(newConfig)

                            // Notify that dimensions have changed
                            eventBus.emit(
                                AppEvents.VECTORSET_DIMENSIONS_CHANGED,
                                {
                                    vectorSetName,
                                    dimensions,
                                }
                            )

                            // Show success dialog
                            setIsSuccessDialogOpen(true)

                            return
                        }
                    }
                }

                // If we get here, we need to show the warning dialog
                setPendingEmbeddingConfig(newConfig)
                setIsWarningDialogOpen(true)
                setIsEditConfigModalOpen(false)
                return
            }

            // If no warning needed, proceed with the update
            await saveEmbeddingConfig(newConfig)
        } catch (error) {
            console.error("[VectorSetPage] Error saving config:", error)
        }
    }

    const saveEmbeddingConfig = async (newConfig: EmbeddingConfig) => {
        const updatedMetadata: VectorSetMetadata = {
            ...metadata,
            embedding: newConfig,
            created: metadata?.created || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
        }

        await vectorSets.setMetadata({
            name: vectorSetName,
            metadata: updatedMetadata,
        })

        // Notify parent of metadata update
        onMetadataUpdate?.(updatedMetadata)

        setIsEditConfigModalOpen(false)
        setIsWarningDialogOpen(false)
        setIsSuccessDialogOpen(false)
        setPendingEmbeddingConfig(null)
        
        // Check for dimension mismatch after updating config
        if (actualVectorDim !== null) {
            const expectedDimensions = getExpectedDimensions(newConfig);
            setDimensionMismatch(expectedDimensions > 0 && actualVectorDim !== expectedDimensions);
        }
    }

    const handleConfirmEmbeddingChange = async () => {
        if (pendingEmbeddingConfig) {
            await saveEmbeddingConfig(pendingEmbeddingConfig)
        }
    }

    const handleSaveAdvancedConfig = async () => {
        try {
            if (!vectorSetName || !workingMetadata) {
                throw new Error("No vector set or metadata selected")
            }

            const updatedMetadata: VectorSetMetadata = {
                ...workingMetadata,
                lastUpdated: new Date().toISOString(),
                embedding: workingMetadata.embedding || {
                    provider: DEFAULT_EMBEDDING.PROVIDER,
                    none: {
                        model: DEFAULT_EMBEDDING.MODEL,
                        dimensions:
                            workingMetadata.dimensions ||
                            DEFAULT_EMBEDDING.DIMENSIONS,
                    },
                },
            }

            await vectorSets.setMetadata({
                name: vectorSetName,
                metadata: updatedMetadata,
            })

            // Notify parent of metadata update
            onMetadataUpdate?.(updatedMetadata)

            console.log("Advanced config saved successfully")
            setIsAdvancedConfigPanelOpen(false)
        } catch (error) {
            console.error(
                "[VectorSettings] Error saving advanced config:",
                error
            )
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center w-full space-x-2">
                        <CardTitle>Vector Set Options</CardTitle>
                        <div className="grow"></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600">
                        These advanced settings control how Redis manages and
                        stores your vector set. Modifying these settings may
                        require recreating the vector set.
                    </p>
                    <div className="flex items-center gap-4 p-4">
                        <div className="grow">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-600">
                                    Quantization:
                                </div>
                                <div>
                                    {metadata?.redisConfig?.quantization || (
                                        <span>
                                            Default:{" "}
                                            <span className="font-bold">
                                                Q8
                                            </span>
                                        </span>
                                    )}
                                </div>

                                <div className="text-gray-600">
                                    Reduced Dimensions:
                                </div>
                                <div>
                                    {metadata?.redisConfig
                                        ?.reduceDimensions || (
                                        <span>
                                            Default:{" "}
                                            <span className="font-bold">
                                                None (No dimension reduction)
                                            </span>
                                        </span>
                                    )}
                                </div>

                                <div className="text-gray-600">
                                    Default CAS:
                                </div>
                                <div>
                                    {metadata?.redisConfig?.defaultCAS !==
                                    undefined ? (
                                        metadata?.redisConfig.defaultCAS ? (
                                            "Enabled"
                                        ) : (
                                            "Disabled"
                                        )
                                    ) : (
                                        <span>
                                            Default:{" "}
                                            <span className="font-bold">
                                                Disabled
                                            </span>
                                        </span>
                                    )}
                                </div>

                                <div className="text-gray-600">
                                    Build Exploration Factor:
                                </div>
                                <div>
                                    {metadata?.redisConfig
                                        ?.buildExplorationFactor || (
                                        <span>
                                            Default:{" "}
                                            <span className="font-bold">
                                                200
                                            </span>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full flex">
                        <div className="grow"></div>
                        <Button
                            variant="default"
                            onClick={() => {
                                // For CLI-created vector sets, create a proper metadata structure
                                let initialMetadata: VectorSetMetadata

                                if (metadata) {
                                    // If metadata exists, use it as a base
                                    initialMetadata = { ...metadata }

                                    // If embedding doesn't exist, add a placeholder one to satisfy the type requirements
                                    if (!initialMetadata.embedding) {
                                        initialMetadata.embedding = {
                                            provider:
                                                DEFAULT_EMBEDDING.PROVIDER,
                                            none: {
                                                model: DEFAULT_EMBEDDING.MODEL,
                                                dimensions:
                                                    metadata.dimensions ||
                                                    DEFAULT_EMBEDDING.DIMENSIONS,
                                            },
                                        }
                                    }

                                    // If redisConfig doesn't exist, initialize it as an empty object
                                    if (!initialMetadata.redisConfig) {
                                        initialMetadata.redisConfig = {}
                                    }
                                } else {
                                    // If no metadata at all, create a minimal valid structure
                                    initialMetadata = {
                                        embedding: DEFAULT_EMBEDDING_CONFIG,
                                        created: new Date().toISOString(),
                                        lastUpdated: new Date().toISOString(),
                                        description: "",
                                        redisConfig: {},
                                    }
                                }

                                setWorkingMetadata(initialMetadata)
                                setIsAdvancedConfigPanelOpen(true)
                            }}
                        >
                            Edit
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center w-full space-x-2">
                        <CardTitle>Embedding Model Configuration</CardTitle>
                        <div className="grow"></div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="w-full flex items-center">
                        <div className="grow"></div>
                    </div>
                    <p className="text-sm text-gray-600">
                        The embedding engine is a convenience feature used by
                        vector-set-browser for <strong>VSIM</strong> and{" "}
                        <strong>VADD</strong> operations. It does not affect the
                        redis-server or the underlying vector-set data.
                    </p>

                    {/* Dimension mismatch warning */}
                    {dimensionMismatch && metadata?.embedding && metadata.embedding.provider !== "none" && (
                        <Alert variant="destructive" className="mt-4 mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Dimension Mismatch</AlertTitle>
                            <AlertDescription>
                                The selected embedding model produces vectors with {getExpectedDimensions(metadata.embedding)} dimensions, 
                                but the VectorSet contains vectors with {actualVectorDim} dimensions. 
                                This will cause compatibility issues when adding new items.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Toggle for using embedding model or not */}
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg mt-4 mb-2">
                        <div className="flex gap-2 items-center">
                            <span className="font-medium">
                                Use embedding model
                            </span>
                            <span className="text-xs text-gray-500">
                                (Required for search and import)
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Label htmlFor="embedding-toggle" className="text-sm text-gray-600">
                                {metadata?.embedding && metadata.embedding.provider === "none" ? "Disabled" : "Enabled"}
                            </Label>
                            <Switch
                                id="embedding-toggle"
                                checked={metadata?.embedding && metadata.embedding.provider !== "none"}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        // Toggle to use an embedding model
                                        setIsEditConfigModalOpen(true)
                                    } else if (metadata?.embedding && metadata.embedding.provider !== "none") {
                                        // Set to none provider
                                        const dimensions = metadata.embedding 
                                            ? getExpectedDimensions(metadata.embedding) || DEFAULT_EMBEDDING.DIMENSIONS
                                            : DEFAULT_EMBEDDING.DIMENSIONS;

                                        handleEditConfig({
                                            provider: "none",
                                            none: {
                                                model: "direct-vectors",
                                                dimensions,
                                            },
                                        })
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {metadata?.embedding &&
                    metadata.embedding.provider !== "none" ? (
                        <div className="flex items-center gap-4 p-4 border rounded-md">
                            <div className="grow flex gap-2 flex-col">
                                <div className="flex items-center space-x-2">
                                    <div className="text-gray-600">
                                        Data Format:
                                    </div>
                                    <div className="flex items-center space-x-1 font-bold">
                                        {(() => {
                                            const dataFormat =
                                                getEmbeddingDataFormat(
                                                    metadata.embedding
                                                )
                                            const Icon =
                                                getEmbeddingIcon(dataFormat)
                                            return (
                                                <>
                                                    <Icon />
                                                    <span className="capitalize">
                                                        {dataFormat.replace(
                                                            "-",
                                                            " & "
                                                        )}
                                                    </span>
                                                </>
                                            )
                                        })()}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="text-gray-600">
                                        Provider:
                                    </div>
                                    <div className="font-bold">
                                        {metadata?.embedding?.provider ? 
                                            getProviderInfo(metadata.embedding.provider).displayName :
                                            "None"}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <div className="text-gray-600">Model:</div>
                                    <div className="font-bold">
                                        {getModelName(metadata.embedding)}
                                    </div>
                                </div>
                                {actualVectorDim !== null && (
                                    <div className="flex items-center space-x-2">
                                        <div className="text-gray-600">
                                            Vector Dimensions:
                                        </div>
                                        <div className={`font-bold ${dimensionMismatch ? "text-red-600" : ""}`}>
                                            {getExpectedDimensions(metadata.embedding)} 
                                            {dimensionMismatch && actualVectorDim !== null && 
                                             ` (VectorSet has ${actualVectorDim})`}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Button
                                variant="default"
                                onClick={() => setIsEditConfigModalOpen(true)}
                            >
                                Configure
                            </Button>
                        </div>
                    ) : (
                        <div className="p-4 border rounded-md text-gray-600">
                            {metadata?.embedding && 
                             metadata.embedding.provider === "none" ? (
                                <div className="flex flex-col">
                                    <p className="mb-2">
                                        <span className="font-medium">
                                            Direct vector input mode.
                                        </span>{" "}
                                        No automatic encoding will be performed.
                                    </p>
                                    <p>
                                        <span className="font-medium">
                                            Vector dimensions:
                                        </span>{" "}
                                        {metadata.embedding.none
                                            ?.dimensions ||
                                            DEFAULT_EMBEDDING.DIMENSIONS}
                                        {dimensionMismatch && actualVectorDim !== null && 
                                         ` (VectorSet has ${actualVectorDim} - mismatch)`}
                                    </p>
                                </div>
                            ) : (
                                <div className="text-sm bg-yellow-50 border border-yellow-200 rounded p-4 w-full">
                                    <p className="font-medium text-yellow-800">
                                        No Embedding Configuration
                                    </p>
                                    <p className="text-yellow-700">
                                        This vector set was created outside of
                                        the browser and doesn{`'`}t have an
                                        embedding configuration. Enable
                                        embedding above to use VSIM search and
                                        VADD operations in the web interface.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={isAdvancedConfigPanelOpen}
                onOpenChange={setIsAdvancedConfigPanelOpen}
            >
                <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Advanced Configuration</DialogTitle>
                    </DialogHeader>
                    {workingMetadata && (
                        <div className="flex flex-col gap-4">
                            <AdvancedConfigEdit redisConfig={workingMetadata} />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="ghost"
                                    onClick={() =>
                                        setIsAdvancedConfigPanelOpen(false)
                                    }
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={handleSaveAdvancedConfig}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {isEditConfigModalOpen && (
                <EditEmbeddingConfigModal
                    isOpen={isEditConfigModalOpen}
                    onClose={() => setIsEditConfigModalOpen(false)}
                    config={
                        metadata?.embedding &&
                        metadata.embedding.provider !== "none"
                            ? metadata.embedding 
                            : {
                                // Default to a reasonable embedding config like OpenAI
                                provider: "openai",
                                openai: {
                                    model: "text-embedding-3-small",
                                    batchSize: 100,
                                },
                            }
                    }
                    onSave={handleEditConfig}
                />
            )}

            <Dialog
                open={isWarningDialogOpen}
                onOpenChange={setIsWarningDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Warning: Embedding Model Change
                        </DialogTitle>
                        <DialogDescription>
                            You are changing the vector embedding model, and
                            there are already vectors in this vectorset which
                            are possibly using a different model. Using vectors
                            from different embedding models in a single vector
                            set is not recommended and does not make sense.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setIsWarningDialogOpen(false)
                                setPendingEmbeddingConfig(null)
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmEmbeddingChange}
                        >
                            Change it anyway
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Success Dialog */}
            <Dialog
                open={isSuccessDialogOpen}
                onOpenChange={setIsSuccessDialogOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Embedding Model Updated Successfully
                        </DialogTitle>
                        <DialogDescription>
                            <div className="space-y-2 pt-2">
                                <p>
                                    The vector set has been updated to use a new
                                    embedding model:
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-600">
                                        Previous Model:
                                    </div>
                                    <div className="font-medium">
                                        {successInfo?.oldModel}
                                    </div>
                                    <div className="text-gray-600">
                                        New Model:
                                    </div>
                                    <div className="font-medium">
                                        {successInfo?.newModel}
                                    </div>
                                    <div className="text-gray-600">
                                        Vector Dimensions:
                                    </div>
                                    <div className="font-medium">
                                        {successInfo?.dimensions}
                                    </div>
                                </div>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="default"
                            onClick={() => setIsSuccessDialogOpen(false)}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
