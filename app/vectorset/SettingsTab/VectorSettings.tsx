import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import { EmbeddingConfig, getEmbeddingDataFormat, getModelName } from "@/app/embeddings/types/embeddingModels"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useState } from "react"
import AdvancedConfigEdit from "../AdvancedConfigEdit"
import { vectorSets } from "@/app/api/vector-sets"

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
    const [isAdvancedConfigPanelOpen, setIsAdvancedConfigPanelOpen] = useState(false)
    const [workingMetadata, setWorkingMetadata] = useState<VectorSetMetadata | null>(null)

    const handleEditConfig = async (newConfig: EmbeddingConfig) => {
        console.log(`[handleEditConfig] New config: ${JSON.stringify(newConfig)}`)
        try {
            if (!vectorSetName) {
                throw new Error("No vector set selected")
            }

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
        } catch (error) {
            console.error("[VectorSetPage] Error saving config:", error)
        }
    }

    const handleSaveAdvancedConfig = async () => {
        try {
            if (!vectorSetName || !workingMetadata) {
                throw new Error("No vector set or metadata selected")
            }

            const updatedMetadata = {
                ...workingMetadata,
                lastUpdated: new Date().toISOString(),
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
            console.error("[VectorSettings] Error saving advanced config:", error)
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
                                    {metadata?.redisConfig?.quantization || <span>Default: <span className="font-bold">Q8</span></span>}
                                </div>

                                <div className="text-gray-600">
                                    Reduced Dimensions:
                                </div>
                                <div>
                                    {metadata?.redisConfig?.reduceDimensions || <span>Default: <span className="font-bold">None (No dimension reduction)</span></span>}
                                </div>

                                <div className="text-gray-600">
                                    Default CAS:
                                </div>
                                <div>
                                    {metadata?.redisConfig?.defaultCAS !== undefined
                                        ? (metadata?.redisConfig.defaultCAS ? "Enabled" : "Disabled")
                                        : <span>Default: <span className="font-bold">Disabled</span></span>}
                                </div>

                                <div className="text-gray-600">
                                    Build Exploration Factor:
                                </div>
                                <div>
                                    {metadata?.redisConfig?.buildExplorationFactor || <span>Default: <span className="font-bold">200</span></span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full flex">
                        <div className="grow"></div>
                        <Button
                            variant="default"
                            onClick={() => {
                                setWorkingMetadata(metadata ? {...metadata} : null)
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
                                        {metadata?.embedding?.provider || "None"}
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
                                        {getEmbeddingDataFormat(metadata?.embedding)}
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
                                <p className="font-medium text-yellow-800">No Embedding Configuration</p>
                                <p className="text-yellow-700">
                                    This vector set was likely created from the CLI and doesn{`'`}t have embedding configuration.
                                    Adding an embedding configuration will enable VSIM search and VADD operations in the web interface.
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
                            <AdvancedConfigEdit
                                redisConfig={workingMetadata}
                            />
                            <div className="flex justify-end gap-2 mt-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setIsAdvancedConfigPanelOpen(false)}
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
                    config={metadata?.embedding || {
                        provider: "none",
                        none: {
                            model: "custom",
                            dimensions: metadata?.dimensions || 1536,
                        },
                    }}
                    onSave={handleEditConfig}
                />
            )}
        </div>
    )
}