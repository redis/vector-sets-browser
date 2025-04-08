"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
    OPENAI_MODELS,
    OLLAMA_MODELS,
    IMAGE_MODELS,
    CLIP_MODELS,
} from "@/app/embeddings/types/embeddingModels"

// Group models by provider for the dropdown
const GROUPED_MODELS = [
    {
        provider: "OpenAI",
        models: Object.entries(OPENAI_MODELS).map(([id, model]) => ({
            id,
            name: model.name,
            dimensions: model.dimensions,
        })),
    },
    {
        provider: "Ollama",
        models: Object.entries(OLLAMA_MODELS).map(([id, model]) => ({
            id,
            name: model.name,
            dimensions: model.dimensions,
        })),
    },
    {
        provider: "Image Models",
        models: Object.entries(IMAGE_MODELS).map(([id, model]) => ({
            id,
            name: model.name,
            dimensions: model.dimensions,
        })),
    },
]

interface CalculationResult {
    rawBytes: number
    estimatedBytes: number
    expansionFactor: number
    redisCommand: string
}

export default function VectorSetCalculator() {
    const [config, setConfig] = useState({
        modelDim: 1536, // Default to OpenAI's text-embedding-ada-002
        numVectors: 1000000,
        quantization: "Q8", // Default to Q8
        reduceDimensions: "",
        modelType: "text-embedding-ada-002", // Default model
        vectorSize: "", // For manual vector size input
    })

    const [result, setResult] = useState<CalculationResult>({
        rawBytes: 0,
        estimatedBytes: 0,
        expansionFactor: 1,
        redisCommand: "",
    })

    // HNSW parameters (kept constant as in original calculator)
    const p = 0.25
    const M = 16
    const M0 = 32
    const maxThreads = 128
    const MAX_LEVELS = 16

    function generateRedisCommand(modelDim: number, storeDim: number | null, quantization: string) {
        let cmd = "VADD myindex"
        
        if (storeDim && storeDim < modelDim) {
            cmd += ` REDUCE ${storeDim}`
        }
        
        cmd += ` VALUES ${modelDim} <vector_values...> my_element`
        
        if (quantization === "NOQUANT") {
            cmd += " NOQUANT"
        } else if (quantization === "BIN") {
            cmd += " BIN"
        }
        // Q8 is default, so no need to add a flag
        
        return cmd
    }

    function estimateHNSWMemoryUsagePerNode(storeDim: number, quantType: string) {
        // Node struct base overhead
        const nodeStructOverhead =
            4 * maxThreads + // visited_epoch array
            4 + // uid
            4 + // level
            4 * MAX_LEVELS + // num_neighbors array
            8 * MAX_LEVELS // neighbors pointer array

        // Average number of levels and pointers
        const avgLevels = 1.0 + p / (1.0 - p)
        const effectiveUpperLayers = Math.max(avgLevels - 1.0, 0.0)
        const avgPointers = M0 + effectiveUpperLayers * M
        const pointerBytes = avgPointers * 8.0

        // Vector storage based on quantization
        let vectorBytes = 0.0
        switch (quantType) {
            case "NOQUANT": // FP32
                vectorBytes = 4.0 * storeDim
                break
            case "Q8": // Q8
                vectorBytes = storeDim + 8.0 // 1 byte per dim + 8 bytes for range
                break
            case "BIN": // BIN
                vectorBytes = Math.ceil(storeDim / 8.0)
                break
            default:
                vectorBytes = 4.0 * storeDim
        }

        return Math.floor(nodeStructOverhead + pointerBytes + vectorBytes + 0.5)
    }

    function estimateHNSWMemoryUsage(
        N: number,
        originalDim: number,
        storeDim: number,
        quantType: string,
        useProjection: boolean
    ) {
        // Per-node usage
        const perNode = estimateHNSWMemoryUsagePerNode(storeDim, quantType)

        // Total for all N nodes
        let total = perNode * N

        // If we keep the projection matrix in memory, add it
        if (useProjection && storeDim < originalDim) {
            const matrixBytes = originalDim * storeDim * 4
            total += matrixBytes
        }

        return total
    }

    function formatBytes(bytes: number) {
        if (bytes < 1024) return bytes + " B"
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
        else if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(2) + " MB"
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"
    }

    useEffect(() => {
        // Calculate memory usage whenever config changes
        const storeDim = config.reduceDimensions
            ? parseInt(config.reduceDimensions)
            : config.modelDim
        const useProjection = config.reduceDimensions !== ""

        const rawVectorBytesPerVec = 4 * config.modelDim
        const totalRawBytes = rawVectorBytesPerVec * config.numVectors

        const estimateBytes = estimateHNSWMemoryUsage(
            config.numVectors,
            config.modelDim,
            storeDim,
            config.quantization,
            useProjection
        )

        const redisCommand = generateRedisCommand(
            config.modelDim,
            config.reduceDimensions ? parseInt(config.reduceDimensions) : null,
            config.quantization
        )

        setResult({
            rawBytes: totalRawBytes,
            estimatedBytes: estimateBytes,
            expansionFactor: estimateBytes / totalRawBytes,
            redisCommand,
        })
    }, [config])

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-2 gap-4 bg-gray-100 p-4">
                <div className="form-section border-none">
                    <div className="space-y-4">
                        <div className="p-2">
                            <div className="">
                                <Label htmlFor="model-select" className="grow">Vector Size</Label>
                                <div className="w-full">
                                    <Select
                                        value={config.modelType}
                                        onValueChange={(value) => {
                                            if (value === "manual") {
                                                setConfig({
                                                    ...config,
                                                    modelType: value,
                                                    modelDim: config.vectorSize ? parseInt(config.vectorSize) : 0,
                                                })
                                            } else {
                                                const model = GROUPED_MODELS
                                                    .flatMap(g => g.models)
                                                    .find(m => m.id === value)
                                                
                                                setConfig({
                                                    ...config,
                                                    modelType: value,
                                                    modelDim: model?.dimensions || 1536,
                                                    vectorSize: "",
                                                })
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select vector source" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {GROUPED_MODELS.map((group) => (
                                                <div key={group.provider}>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                                        {group.provider}
                                                    </div>
                                                    {group.models.map((model) => (
                                                        <SelectItem
                                                            key={model.id}
                                                            value={model.id}
                                                        >
                                                            {model.name}{" "}
                                                            <span className="text-muted-foreground">
                                                                (DIM {model.dimensions})
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                    {group.provider === "Image Models" && (
                                                        <SelectItem value="manual">
                                                            Manual Vector Size
                                                        </SelectItem>
                                                    )}
                                                </div>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Enter the size (in dimensions) of your source vector or select a model from the list. Each dimension typically uses 4 bytes in the source vector.
                            </p>
                        </div>

                        {config.modelType === "manual" && (
                            <div className="">
                                <Label htmlFor="vector-size" className="grow">Custom Vector Size</Label>
                                <div className="w-full">
                                    <Input
                                        id="vector-size"
                                        type="number"
                                        value={config.vectorSize}
                                        onChange={(e) => {
                                            const size = e.target.value
                                            setConfig({
                                                ...config,
                                                vectorSize: size,
                                                modelDim: size ? parseInt(size) : 0,
                                            })
                                        }}
                                        placeholder="Enter vector dimensions"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="form-section border-none">
                    <div className="space-y-4">
                        <div className="p-2">
                            <div className="">
                                <Label htmlFor="num-vectors" className="grow">Number of Vectors</Label>
                                <div className="w-full">
                                    <Input
                                        id="num-vectors"
                                        type="number"
                                        value={config.numVectors}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                numVectors: parseInt(e.target.value) || 0,
                                            })
                                        }
                                        placeholder="Enter number of vectors"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                The total number of vectors you plan to store in your vector set.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="form-section border-none">
                    <div className="space-y-4">
                        <div className="p-2">
                            <div className="">
                                <Label htmlFor="quantization" className="grow">Vector Quantization</Label>
                                <div className="w-full">
                                    <Select
                                        value={config.quantization}
                                        onValueChange={(value) =>
                                            setConfig({ ...config, quantization: value })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select quantization" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NOQUANT">
                                                None (full precision)
                                            </SelectItem>
                                            <SelectItem value="Q8">
                                                8-bit quantization (default)
                                            </SelectItem>
                                            <SelectItem value="BIN">
                                                Binary quantization
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-1 mt-2">
                                <p className="text-xs text-muted-foreground">
                                    Quantization reduces memory usage by storing vectors with lower precision:
                                </p>
                                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 space-y-1">
                                    <li>Full precision: 4 bytes per dimension</li>
                                    <li>8-bit (Q8): 1 byte per dimension (75% reduction)</li>
                                    <li>Binary (BIN): 1 bit per dimension (97% reduction)</li>
                                </ul>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Lower precision slightly reduces accuracy but significantly improves memory efficiency.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-section border-none">
                    <div className="space-y-4">
                        <div className="p-2">
                            <div className="">
                                <Label htmlFor="reduce-dim" className="grow">Dimension Reduction</Label>
                                <div className="w-full">
                                    <Input
                                        id="reduce-dim"
                                        type="number"
                                        value={config.reduceDimensions}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                reduceDimensions: e.target.value,
                                            })
                                        }
                                        placeholder="Enter reduced dimensions"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1 mt-2 text-xs">
                                <p className="text-xs text-muted-foreground">
                                    Dimension reduction projects vectors into a lower-dimensional space:
                                </p>
                                <ul className="text-xs text-muted-foreground list-disc list-inside ml-2 space-y-1">
                                    <li>Reduces memory usage and search time</li>
                                    <li>Trade-off between performance and accuracy</li>
                                    <li>Recommended: Keep at least 25% of original dimensions</li>
                                </ul>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Leave empty to keep original dimensions.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-lg font-semibold">Memory Usage Comparison</h3>
                
                <div className="space-y-6">
                    {/* Raw Vector Data Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="text-sm font-medium">Raw Vector Data</div>
                            <div className="text-sm font-mono">{formatBytes(result.rawBytes)}</div>
                        </div>
                        <div className="relative w-full h-6 bg-muted rounded-lg overflow-hidden">
                            <div
                                className="absolute h-full bg-blue-500/80 transition-all duration-300"
                                style={{
                                    width: "100%",
                                }}
                            ></div>
                        </div>
                    </div>

                    {/* HNSW Usage Bar */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div className="text-sm font-medium">Redis Vector Set Size</div>
                            <div className="text-sm font-mono">{formatBytes(result.estimatedBytes)}</div>
                        </div>
                        <div className="relative w-full h-6 bg-muted rounded-lg overflow-hidden">
                            <div
                                className="absolute h-full bg-primary transition-all duration-300"
                                style={{
                                    width: `${Math.min((result.estimatedBytes / result.rawBytes) * 100, 100)}%`,
                                }}
                            ></div>
                        </div>
                        <div className="flex items-center justify-end gap-2 h-6">
                            {result.estimatedBytes > result.rawBytes ? (
                                <div className="text-sm text-red-500">
                                    +{formatBytes(result.estimatedBytes - result.rawBytes)} increase in size
                                </div>
                            ) : (
                                <div className="text-sm text-green-500">
                                    {formatBytes(result.rawBytes - result.estimatedBytes)} saved
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-8 space-y-2">
                    <h3 className="text-lg font-semibold">Redis Command</h3>
                    <Card className="p-4 bg-muted">
                        <code className="text-sm font-mono whitespace-pre-wrap break-all">
                            {result.redisCommand}
                        </code>
                    </Card>
                    <div className="text-sm text-muted-foreground">
                        This command represents your current vector set configuration.
                        Replace <code className="text-xs">myindex</code> with your index name and <code className="text-xs">&lt;vector_values...&gt;</code> with your actual vector values.
                    </div>
                </div>
            </div>
        </div>
    )
} 