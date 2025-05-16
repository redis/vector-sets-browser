import RedisCommandBox from "@/components/RedisCommandBox"
import { vinfo } from "@/lib/redis-server/api"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import AdvancedConfigEdit from "@/app/vectorset/components/AdvancedConfigEdit"
import eventBus, { AppEvents } from "@/lib/client/events/eventEmitter"

interface InfoPanelProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
    onMetadataUpdate?: (metadata: VectorSetMetadata) => void
}

interface VInfo {
    attributesCount: number
    hnswM: number
    hnswMaxNodeUid: number
    maxLevel: number
    quantType: string
    size: number
    vectorDim: number
    vsetUid: number
}

const VINFO_FRIENDLY_NAMES: Record<string, string> = {
    attributesCount: "Attributes Count",
    hnswM: "HNSW M Parameter",
    hnswMaxNodeUid: "HNSW Max Node UID",
    maxLevel: "Maximum Level",
    quantType: "Quantization Type",
    size: "Size",
    vectorDim: "Vector Dimensions",
    vsetUid: "Vector Set UID",
}

export default function InfoPanel({
    vectorSetName,
    dim,
    metadata,
    onMetadataUpdate,
}: InfoPanelProps) {
    const [vInfo, setVInfo] = useState<VInfo | null>(null)
    const [isAdvancedConfigPanelOpen, setIsAdvancedConfigPanelOpen] = useState(false)
    const [workingMetadata, setWorkingMetadata] = useState<VectorSetMetadata | null>(null)

    useEffect(() => {
        async function fetchVInfo() {
            try {
                const vInfoResponse = await vinfo({ keyName: vectorSetName })

                if (!vInfoResponse.success || !vInfoResponse.result) {
                    console.error("Failed to fetch vinfo:", vInfoResponse.error)
                    return
                }

                setVInfo({
                    attributesCount: Number(vInfoResponse.result["attributes-count"]),
                    hnswM: Number(vInfoResponse.result["hnsw-m"]),
                    hnswMaxNodeUid: Number(vInfoResponse.result["hnsw-max-node-uid"]),
                    maxLevel: Number(vInfoResponse.result["max-level"]),
                    quantType: String(vInfoResponse.result["quant-type"]),
                    size: Number(vInfoResponse.result["size"]),
                    vectorDim: Number(vInfoResponse.result["vector-dim"]),
                    vsetUid: Number(vInfoResponse.result["vset-uid"]),
                })
            } catch (error) {
                console.error("Failed to fetch vinfo:", error)
            }
        }
        fetchVInfo()
    }, [vectorSetName])

    const handleSaveAdvancedConfig = () => {
        if (workingMetadata && onMetadataUpdate) {
            onMetadataUpdate(workingMetadata)
            eventBus.emit(AppEvents.VectorSetMetadataUpdated, {
                vectorSetName,
                metadata: workingMetadata,
            })
        }
        setIsAdvancedConfigPanelOpen(false)
    }

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center w-full">
                        <CardTitle>Vector Set Info (VINFO)</CardTitle>
                        <div className="grow"></div>
                        <div className="text-gray-600">Created:</div>
                        <div>
                            {metadata?.created
                                ? new Date(metadata.created).toLocaleString()
                                : "Unknown"}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600">
                        This section contains information about the vector set
                        returned from the <strong>VINFO</strong> command
                    </p>
                    {vInfo && (
                        <div className="space-y-4 p-4">
                            <pre className="font-mono text-sm bg-slate-50 p-4 rounded-lg">
                                {Object.entries(vInfo)
                                    .map(([key, value]) => {
                                        const friendlyName =
                                            VINFO_FRIENDLY_NAMES[key]
                                        const displayName = friendlyName
                                            ? `${key} (${friendlyName})`
                                            : key
                                        return `${displayName.padEnd(40)} : ${value}\n`
                                    })
                                    .join("")}
                            </pre>
                        </div>
                    )}
                    <div>
                        <Label>Redis Command:</Label>
                        <RedisCommandBox
                            vectorSetName={vectorSetName}
                            dim={dim}
                            executedCommand={`VINFO ${vectorSetName}`}
                            searchQuery={""}
                            searchFilter={""}
                            showRedisCommand={true}
                        />
                    </div>
                </CardContent>
            </Card>

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
                                    Vector Quantization{" "}
                                    <span className="text-xs text-gray-400">
                                        (NOQUANT, Q8, BIN options)
                                    </span>
                                    :
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
                                    Reduced Dimensions{" "}
                                    <span className="text-xs text-gray-400">
                                        (REDUCE option)
                                    </span>
                                    :
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
                                    Default Check-and-Set{" "}
                                    <span className="text-xs text-gray-400">
                                        (CAS option)
                                    </span>
                                    :
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
                                    Build Exploration Factor{" "}
                                    <span className="text-xs text-gray-400">
                                        (EF option)
                                    </span>
                                    :
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
                        <Button
                            variant="default"
                            onClick={() => {
                                // For CLI-created vector sets, create a proper metadata structure
                                let initialMetadata: VectorSetMetadata
                                if (metadata) {
                                    initialMetadata = { ...metadata }
                                    if (!initialMetadata.redisConfig) {
                                        initialMetadata.redisConfig = {}
                                    }
                                } 
                                else {
                                    // If no metadata at all, create a minimal valid structure
                                    initialMetadata = {
                                        embedding: {
                                            provider: "none",
                                        },
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
        </div>
    )
}
