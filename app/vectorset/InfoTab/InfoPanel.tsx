import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useEffect, useState } from "react"
import {
    getEmbeddingDataFormat,
    getModelName,
    VectorSetMetadata,
} from "@/app/embeddings/types/config"
import { vinfo } from "@/app/redis-server/api"

interface InfoPanelProps {
    vectorSetName: string
    recordCount: number | null
    dim: number | null
    metadata: VectorSetMetadata | null
    onEditConfig: () => void
    onEditRedisConfig?: () => void
}

/* 
    attributes-count
    hnsw-m
    hnsw-max-node-uid
    max-level
    quant-type
    size
    vector-dim
    vset-uid
*/

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

export default function InfoPanel({
    vectorSetName,
    recordCount,
    dim,
    metadata,
    onEditConfig,
    onEditRedisConfig,
}: InfoPanelProps) {
    const [vInfo, setVInfo] = useState<VInfo | null>(null)

    useEffect(() => {
        async function fetchVInfo() {
            try {
                console.log("Fetching vinfo for:", vectorSetName)
                console.log("Metadata:", metadata)
                const vInfoData = await vinfo({ keyName: vectorSetName })

                if (!vInfoData) {
                    console.error("Failed to fetch vinfo:", vInfoData)
                    return
                }
                console.log("VINFO data:", vInfoData)

                setVInfo({
                    attributesCount: Number(vInfoData["attributes-count"]),
                    hnswM: Number(vInfoData["hnsw-m"]),
                    hnswMaxNodeUid: Number(vInfoData["hnsw-max-node-uid"]),
                    maxLevel: Number(vInfoData["max-level"]),
                    quantType: String(vInfoData["quant-type"]),
                    size: Number(vInfoData["size"]),
                    vectorDim: Number(vInfoData["vector-dim"]),
                    vsetUid: Number(vInfoData["vset-uid"]),
                })
            } catch (error) {
                console.error("Failed to fetch vinfo:", error)
            }
        }
        fetchVInfo()
    }, [vectorSetName])

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
                        <div className="grid grid-cols-4 gap-2 p-4">
                            <div className="text-gray-600">Size:</div>
                            <div>{vInfo.size}</div>
                            <div className="text-gray-600">
                                Vector Dimensions:
                            </div>
                            <div>{vInfo.vectorDim}</div>
                            <div className="text-gray-600">
                                Quantization Type:
                            </div>
                            <div>{vInfo.quantType}</div>
                            <div className="text-gray-600">Max Level:</div>
                            <div>{vInfo.maxLevel}</div>
                            <div className="text-gray-600">VSet UID:</div>
                            <div>{vInfo.vsetUid}</div>
                            <div className="text-gray-600">
                                HNSW Max Node UID:
                            </div>
                            <div>{vInfo.hnswMaxNodeUid}</div>
                            <div className="text-gray-600">HNSW M:</div>
                            <div>{vInfo.hnswM}</div>
                            <div className="text-gray-600">
                                Attributes Count:
                            </div>
                            <div>{vInfo.attributesCount}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

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
                    {metadata?.redisConfig && (
                        <div className="flex items-center gap-4 p-4">
                            <div className="grow">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-gray-600">
                                        Quantization:
                                    </div>
                                    <div>
                                        {metadata.redisConfig.quantization}
                                    </div>

                                    {metadata.redisConfig.reduceDimensions && (
                                        <>
                                            <div className="text-gray-600">
                                                Reduced Dimensions:
                                            </div>
                                            <div>
                                                {
                                                    metadata.redisConfig
                                                        .reduceDimensions
                                                }
                                            </div>
                                        </>
                                    )}

                                    <div className="text-gray-600">
                                        Default CAS:
                                    </div>
                                    <div>
                                        {metadata.redisConfig.defaultCAS
                                            ? "Enabled"
                                            : "Disabled"}
                                    </div>

                                    {metadata.redisConfig
                                        .buildExplorationFactor && (
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
                            </div>
                            <Button
                                variant="default"
                                onClick={onEditRedisConfig}
                            >
                                Edit
                            </Button>
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
        </div>
    )
}
