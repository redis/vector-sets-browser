import RedisCommandBox from "@/components/RedisCommandBox"
import { vinfo } from "@/lib/redis-server/api"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useEffect, useState } from "react"

interface InfoPanelProps {
    vectorSetName: string
    dim: number | null
    metadata: VectorSetMetadata | null
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
}: InfoPanelProps) {
    const [vInfo, setVInfo] = useState<VInfo | null>(null)

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
        </div>
    )
}
