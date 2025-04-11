import { vectorSets } from "@/app/api/vector-sets"
import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import {
    EmbeddingConfig,
    getEmbeddingDataFormat,
    getExpectedDimensions,
    getModelName,
} from "@/app/embeddings/types/embeddingModels"
import { vadd, vcard, vrem, vsim } from "@/app/redis-server/api"
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
import { useState } from "react"
import AdvancedConfigEdit from "../AdvancedConfigEdit"
import { DEFAULT_EMBEDDING, DEFAULT_EMBEDDING_CONFIG } from "../constants"

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
                        <CardTitle>Vector Set Advanced Configuration</CardTitle>
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
                        <CardTitle>Embedding Configuration</CardTitle>
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
                    {metadata?.embedding ? (
                        <div className="flex items-center gap-4 p-4">
                            <div>
                                <div className="flex space-x-2">
                                    <div className="text-gray-600">
                                        Provider:
                                    </div>
                                    <div className="font-bold">
                                        {metadata?.embedding?.provider ||
                                            "None"}
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <div className="text-gray-600">Model:</div>
                                    <div className="font-bold">
                                        {getModelName(metadata?.embedding)}
                                    </div>
                                </div>
                                <div className="flex space-x-2">
                                    <div className="text-gray-600">
                                        Data Format:
                                    </div>
                                    <div className="font-bold">
                                        {getEmbeddingDataFormat(
                                            metadata?.embedding
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="default"
                                onClick={() => setIsEditConfigModalOpen(true)}
                            >
                                Edit
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-start gap-4 p-4">
                            <div className="text-sm bg-yellow-50 border border-yellow-200 rounded p-4 w-full">
                                <p className="font-medium text-yellow-800">
                                    No Embedding Configuration
                                </p>
                                <p className="text-yellow-700">
                                    This vector set was created outside of the
                                    browser and doesn{`'`}t have an embedding
                                    configuration. Adding one will enable VSIM
                                    search and VADD operations in the web
                                    interface.
                                </p>
                            </div>
                            <Button
                                variant="default"
                                onClick={() => setIsEditConfigModalOpen(true)}
                            >
                                Add Embedding Config
                            </Button>
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
                        metadata?.embedding || {
                            provider: DEFAULT_EMBEDDING.PROVIDER,
                            none: {
                                model: DEFAULT_EMBEDDING.MODEL,
                                dimensions:
                                    metadata?.dimensions ||
                                    DEFAULT_EMBEDDING.DIMENSIONS,
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
                                    The vector set has been updated to use a new embedding model:
                                </p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-600">Previous Model:</div>
                                    <div className="font-medium">{successInfo?.oldModel}</div>
                                    <div className="text-gray-600">New Model:</div>
                                    <div className="font-medium">{successInfo?.newModel}</div>
                                    <div className="text-gray-600">Vector Dimensions:</div>
                                    <div className="font-medium">{successInfo?.dimensions}</div>
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
