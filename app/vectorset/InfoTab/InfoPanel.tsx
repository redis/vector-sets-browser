import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import {
    getEmbeddingDataFormat,
    getModelName,
    VectorSetMetadata,
} from "@/app/embeddings/types/config"

interface InfoPanelProps {
    vectorSetName: string
    recordCount: number | null
    dim: number | null
    metadata: VectorSetMetadata | null
    onEditConfig: () => void
}

interface VInfo {
    quantType: string
    vectorDim: number
    size: number
    maxLevel: number
    vsetUid: number
    hnswMaxNodeUid: number
}

export default function InfoPanel({
    vectorSetName,
    recordCount,
    dim,
    metadata,
    onEditConfig,
}: InfoPanelProps) {
    const [vInfo, setVInfo] = useState<VInfo | null>(null)

    useEffect(() => {
        async function fetchVInfo() {
            try {
                const response = await fetch("/api/redis/command/vinfo", {
                    method: "POST",
                    body: JSON.stringify({
                        keyName: vectorSetName,
                    }),
                })
                const data = await response.json()
                if (data.success) {
                    console.log(data)
                    setVInfo({
                        quantType: data.result["quant-type"],
                        vectorDim: data.result["vector-dim"],
                        size: data.result["size"],
                        maxLevel: data.result["max-level"],
                        vsetUid: data.result["vset-uid"],
                        hnswMaxNodeUid: data.result["hnsw-max-node-uid"],
                    })
                }
            } catch (error) {
                console.error("Failed to fetch vinfo:", error)
            }
        }
        fetchVInfo()
    }, [])

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
                    <div className="grid grid-cols-4 gap-2 p-4">
                        <div className="text-gray-600">Vectors:</div>
                        <div>
                            {recordCount !== null
                                ? recordCount.toLocaleString()
                                : "Loading..."}
                        </div>
                    </div>
                    {vInfo && (
                        <div className="grid grid-cols-4 gap-2 p-4">
                            <div className="text-gray-600">
                                Vector Dimensions:
                            </div>
                            <div>{vInfo.vectorDim}</div>
                            <div className="text-gray-600">
                                Quantization Type:
                            </div>
                            <div>{vInfo.quantType}</div>
                            <div className="text-gray-600">Size:</div>
                            <div>{vInfo.size}</div>
                            <div className="text-gray-600">Max Level:</div>
                            <div>{vInfo.maxLevel}</div>
                            <div className="text-gray-600">VSet UID:</div>
                            <div>{vInfo.vsetUid}</div>
                            <div className="text-gray-600">
                                HNSW Max Node UID:
                            </div>
                            <div>{vInfo.hnswMaxNodeUid}</div>
                        </div>
                    )}
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
                    {metadata?.embedding && (
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
                            <Button variant="default" onClick={onEditConfig}>
                                Edit
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {metadata?.redisConfig && (
                <Card>
                    <CardHeader>
                        <CardTitle>Redis Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-600">Quantization:</div>
                            <div>{metadata.redisConfig.quantization}</div>

                            {metadata.redisConfig.reduceDimensions && (
                                <>
                                    <div className="text-gray-600">
                                        Reduced Dimensions:
                                    </div>
                                    <div>
                                        {metadata.redisConfig.reduceDimensions}
                                    </div>
                                </>
                            )}

                            <div className="text-gray-600">Default CAS:</div>
                            <div>
                                {metadata.redisConfig.defaultCAS
                                    ? "Enabled"
                                    : "Disabled"}
                            </div>

                            {metadata.redisConfig.buildExplorationFactor && (
                                <>
                                    <div className="text-gray-600">
                                        Build EF:
                                    </div>
                                    <div>
                                        {
                                            metadata.redisConfig
                                                .buildExplorationFactor
                                        }
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
