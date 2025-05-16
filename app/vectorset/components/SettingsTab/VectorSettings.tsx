import { vectorSets } from "@/app/api/vector-sets"
import EditEmbeddingConfigModal from "@/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import { 
    BinaryEmbeddingIcon, 
    getEmbeddingIcon, 
    ImageEmbeddingIcon, 
    MultiModalEmbeddingIcon, 
    TextEmbeddingIcon 
} from "@/components/EmbeddingConfig/EmbeddingIcons"
import {
    EmbeddingConfig,
    EmbeddingDataFormat,
    getEmbeddingDataFormat,
    getExpectedDimensions,
    getModelData,
    getModelName,
    getProviderInfo,
    isImageEmbedding,
    isMultiModalEmbedding,
    isTextEmbedding,
} from "@/lib/embeddings/types/embeddingModels"
import { vadd, vcard, vdim, vrem, vsim } from "@/lib/redis-server/api"
import { VectorSetMetadata } from "@/lib/types/vectors"
import eventBus, { AppEvents } from "@/lib/client/events/eventEmitter"
import {
    DEFAULT_EMBEDDING,
    DEFAULT_EMBEDDING_CONFIG,
} from "@/app/vectorset/utils/constants"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, BrainCircuit, Cpu, Image, LetterText } from "lucide-react"
import { useEffect, useState } from "react"

interface VectorSettingsProps {
    vectorSetName: string
    metadata: VectorSetMetadata | null
    onMetadataUpdate?: (metadata: VectorSetMetadata) => void
}

// Add this new component for the embedding process visualization
function EmbeddingProcessVisualization({ dataFormat }: { dataFormat: EmbeddingDataFormat }) {
    return (
        <div className="flex items-center justify-center mt-4 mb-2 py-3 bg-slate-50 rounded-md">
            <div className="flex items-center space-x-2">
                {/* Input side */}
                <div className="flex flex-col items-center">
                    {dataFormat === "text" && (
                        <div className="p-2 bg-white rounded-md border border-slate-200 w-16 h-16 flex items-center justify-center">
                            <LetterText className="h-8 w-8 text-blue-500" />
                        </div>
                    )}
                    {dataFormat === "image" && (
                        <div className="p-2 bg-white rounded-md border border-slate-200 w-16 h-16 flex items-center justify-center">
                            <Image className="h-8 w-8 text-purple-500" />
                        </div>
                    )}
                    {dataFormat === "text-and-image" && (
                        <div className="p-2 bg-white rounded-md border border-slate-200 w-16 h-16 flex flex-col items-center justify-center">
                            <LetterText className="h-5 w-5 text-blue-500" />
                            <div className="text-xs font-semibold">+</div>
                            <Image className="h-5 w-5 text-purple-500" />
                        </div>
                    )}
                    <div className="text-xs font-medium mt-1 text-slate-600">Input</div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                    <svg width="40" height="24" viewBox="0 0 40 24" className="text-slate-400">
                        <path 
                            d="M32 12H8M32 12L26 6M32 12L26 18" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            fill="none" 
                        />
                    </svg>
                    <div className="text-xs font-medium mt-1 text-slate-600">Embedding</div>
                </div>

                {/* Model */}
                <div className="flex flex-col items-center">
                    <div className="p-2 bg-white rounded-md border border-slate-200 w-16 h-16 flex items-center justify-center">
                        <BrainCircuit className="h-8 w-8 text-indigo-500" />
                    </div>
                    <div className="text-xs font-medium mt-1 text-slate-600">Model</div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-center">
                    <svg width="40" height="24" viewBox="0 0 40 24" className="text-slate-400">
                        <path 
                            d="M32 12H8M32 12L26 6M32 12L26 18" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            fill="none" 
                        />
                    </svg>
                    <div className="text-xs font-medium mt-1 text-slate-600">Output</div>
                </div>

                {/* Output side (vector) */}
                <div className="flex flex-col items-center">
                    <div className="p-2 bg-white rounded-md border border-slate-200 w-16 h-16 flex items-center justify-center">
                        <div className="text-xs font-mono text-slate-800 flex flex-col items-center">
                            <span>[0.23,</span>
                            <span>0.85,</span>
                            <span>-0.12,</span>
                            <span>...]</span>
                        </div>
                    </div>
                    <div className="text-xs font-medium mt-1 text-slate-600">Vector</div>
                </div>
            </div>
        </div>
    )
}

// Add this component for supported data type badges
function DataTypeBadges({ config }: { config: EmbeddingConfig }) {
    const supportsText = isTextEmbedding(config)
    const supportsImage = isImageEmbedding(config)
    const isMultiModal = isMultiModalEmbedding(config)
    
    return (
        <div className="flex items-center gap-2 my-2">
            <div className="text-sm text-slate-600 mr-1">Supports:</div>
            {supportsText && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isMultiModal ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}`}>
                    <LetterText className="h-3 w-3" />
                    <span>Text</span>
                </div>
            )}
            {supportsImage && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isMultiModal ? 'bg-indigo-100 text-indigo-800' : 'bg-purple-100 text-purple-800'}`}>
                    <Image className="h-3 w-3" />
                    <span>Image</span>
                </div>
            )}
            {isMultiModal && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                    <BrainCircuit className="h-3 w-3" />
                    <span>Multi-modal</span>
                </div>
            )}
        </div>
    )
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
    const [successInfo, setSuccessInfo] = useState<{
        oldModel: string
        newModel: string
        dimensions: number
    } | null>(null)
    const [actualVectorDim, setActualVectorDim] = useState<number | null>(null)
    const [dimensionMismatch, setDimensionMismatch] = useState(false)

    // Fetch actual vector dimensions from Redis
    useEffect(() => {
        const fetchVectorDimensions = async () => {
            if (!vectorSetName) return

            try {
                const dimResponse = await vdim({ keyName: vectorSetName })
                if (dimResponse.success && dimResponse.result !== undefined) {
                    setActualVectorDim(dimResponse.result)

                    // Check for dimension mismatch
                    if (metadata?.embedding) {
                        const expectedDimensions = getExpectedDimensions(
                            metadata.embedding
                        )
                        setDimensionMismatch(
                            expectedDimensions > 0 &&
                                dimResponse.result !== expectedDimensions
                        )
                    }
                }
            } catch (error) {
                console.error(
                    "[VectorSettings] Error fetching vector dimensions:",
                    error
                )
            }
        }

        fetchVectorDimensions()
    }, [vectorSetName, metadata])

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
                                dimensions,
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
            const expectedDimensions = getExpectedDimensions(newConfig)
            setDimensionMismatch(
                expectedDimensions > 0 && actualVectorDim !== expectedDimensions
            )
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

    const handleEnableEmbedding = (checked: boolean) => {
        if (checked) {
            // Open the modal to configure embedding
            setIsEditConfigModalOpen(true)
        }
    }

    return (
        <div className="flex flex-col gap-4">
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
                    {dimensionMismatch &&
                        metadata?.embedding &&
                        metadata.embedding.provider !== "none" && (
                            <Alert variant="destructive" className="mt-4 mb-2">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Dimension Mismatch</AlertTitle>
                                <AlertDescription>
                                    The selected embedding model produces
                                    vectors with{" "}
                                    {getExpectedDimensions(metadata.embedding)}{" "}
                                    dimensions, but the VectorSet contains
                                    vectors with {actualVectorDim} dimensions.
                                    This will cause compatibility issues when
                                    adding new items.
                                </AlertDescription>
                            </Alert>
                        )}

                    {/* Embedding content */}
                    {metadata?.embedding && metadata.embedding.provider !== "none" ? (
                        <div className="flex flex-col p-4 bg-white rounded-md border border-slate-200">
                            {/* Top part with model info */}
                            <div className="flex items-start">
                                {/* Provider logo and model info */}
                                <div className="grow">
                                    <div className="flex items-center mb-2">
                                        <div className="p-2 bg-slate-100 rounded-md mr-3 flex items-center justify-center">
                                            {getEmbeddingDataFormat(metadata.embedding) === "text" && (
                                                <TextEmbeddingIcon />
                                            )}
                                            {getEmbeddingDataFormat(metadata.embedding) === "image" && (
                                                <ImageEmbeddingIcon />
                                            )}
                                            {getEmbeddingDataFormat(metadata.embedding) === "text-and-image" && (
                                                <MultiModalEmbeddingIcon />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-sm font-semibold text-slate-500">
                                                {getProviderInfo(metadata.embedding.provider).displayName}
                                            </div>
                                            <div className="text-lg font-bold">
                                                {getModelName(metadata.embedding)}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Data type badges */}
                                    <DataTypeBadges config={metadata.embedding} />
                                    
                                    {/* Dimensions info */}
                                    {actualVectorDim !== null && (
                                        <div className="flex items-center mt-2">
                                            <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-800 rounded-md text-xs font-mono">
                                                <Cpu className="h-3 w-3" />
                                                <span>
                                                    {getExpectedDimensions(metadata.embedding)}-d
                                                    {dimensionMismatch &&
                                                        actualVectorDim !== null &&
                                                        ` (VectorSet: ${actualVectorDim}-d)`}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Configure button */}
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditConfigModalOpen(true)}
                                >
                                    Configure
                                </Button>
                            </div>
                            
                            {/* Embedding process visualization */}
                            <EmbeddingProcessVisualization 
                                dataFormat={getEmbeddingDataFormat(metadata.embedding)} 
                            />
                            
                            {/* Additional info based on model */}
                            {metadata.embedding.provider === "clip" && (
                                <div className="text-xs text-slate-600 mt-2 p-2 bg-slate-50 rounded">
                                    <p className="font-medium">Multi-modal embedding:</p>
                                    <p>This model creates embeddings where text and images share the same vector space, 
                                    enabling similarity search across different data types.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 p-4">
                            <div className="grow">
                                {metadata?.embedding?.provider === "none" ? (
                                    <div className="flex justify-between items-center w-full">
                                        <div className="font-bold text-red-600">
                                            Embedding is disabled
                                        </div>
                                        <Switch
                                            id="enable-embedding"
                                            checked={false}
                                            onCheckedChange={(checked) => {
                                                handleEnableEmbedding(checked)
                                            }}
                                        />
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
                        </div>
                    )}
                </CardContent>
            </Card>

            <EditEmbeddingConfigModal
                isOpen={isEditConfigModalOpen}
                onClose={() => setIsEditConfigModalOpen(false)}
                config={metadata?.embedding as EmbeddingConfig || DEFAULT_EMBEDDING}
                onSave={handleEditConfig}
            />
        </div>
    )
}
