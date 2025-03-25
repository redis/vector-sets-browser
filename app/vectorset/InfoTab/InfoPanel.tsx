import RedisCommandBox from "@/app/components/RedisCommandBox"
import { vinfo } from "@/app/redis-server/api"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
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
                            setShowRedisCommand={() => {}}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
