"use client"

import { useState, useEffect, useCallback } from "react"
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
    TENSORFLOW_MODELS,
    OLLAMA_MODELS,
    IMAGE_MODELS,
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
        provider: "TensorFlow",
        models: Object.entries(TENSORFLOW_MODELS).map(([id, model]) => ({
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

interface Field {
    name: string
    type: string
    dim?: number
    algorithm?: string
    distance?: string
    M?: number
    efConstruction?: number
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
    const M = 16

    // Index parameters
    const indexName = "myindex"
    const keyPrefix = "doc"
    const fields: Field[] = [
        {
            name: "vector",
            type: "VECTOR",
            dim: config.modelDim,
            algorithm: "HNSW",
            distance: "COSINE",
            M: M,
            efConstruction: 200
        }
    ]

    const generateRedisCommand = useCallback(() => {
        const command = `FT.CREATE ${indexName} ON HASH PREFIX 1 ${keyPrefix}: SCHEMA ${fields
            .map((field: Field) => {
                if (field.type === "VECTOR") {
                    return `${field.name} ${field.type} ${field.dim} ${field.algorithm === "FLAT"
                        ? "TYPE FLOAT32 DIM"
                        : `TYPE FLOAT32 DIM DISTANCE_METRIC ${field.distance} TYPE FLOAT32 DIM M ${field.M} EF_CONSTRUCTION ${field.efConstruction}`
                        }`
                }
                return `${field.name} ${field.type}`
            })
            .join(" ")}`
        return command
    }, [fields])

    const estimateHNSWMemoryUsageBytes = useCallback(() => {
        const hnsw_fields = fields.filter(
            (field: Field) => field.type === "VECTOR" && field.algorithm === "HNSW"
        )
        let total_bytes = 0
        for (const field of hnsw_fields) {
            // Base memory per vector
            const bytes_per_vector = (field.dim || 0) * 4 // 4 bytes per float32
            // Memory for graph structure
            const graph_memory = (field.M || 0) * 8 * (field.dim || 0) // Assuming 8 bytes per edge
            total_bytes += (bytes_per_vector + graph_memory) * config.numVectors
        }
        return total_bytes
    }, [fields, config.numVectors])

    function formatBytes(bytes: number) {
        if (bytes < 1024) return bytes + " B"
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB"
        else if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(2) + " MB"
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB"
    }

    useEffect(() => {
        const rawVectorBytesPerVec = 4 * config.modelDim
        const totalRawBytes = rawVectorBytesPerVec * config.numVectors
        const estimatedBytes = estimateHNSWMemoryUsageBytes()

        const redisCommand = generateRedisCommand()

        setResult({
            rawBytes: totalRawBytes,
            estimatedBytes,
            expansionFactor: estimatedBytes / totalRawBytes,
            redisCommand,
        })
    }, [config, estimateHNSWMemoryUsageBytes, generateRedisCommand])

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