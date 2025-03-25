import {
    EmbeddingConfig,
    getExpectedDimensions,
} from "@/app/embeddings/types/embeddingModels"
import { VectorSetMetadata, createVectorSetMetadata } from "@/app/types/vectorSetMetaData"

import { vadd } from "@/app/redis-server/api"
import {
    getDefaultTextEmbeddingConfig
} from "@/app/utils/embeddingUtils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import EditEmbeddingConfigModal from "../components/EmbeddingConfig/EditEmbeddingConfigDialog"
import RedisCommandBox from "../components/RedisCommandBox"
import AdvancedConfigEdit from "./AdvancedConfigEdit"
import { userSettings } from "@/app/utils/userSettings"

interface CreateVectorSetModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (
        name: string,
        dimensions: number,
        metadata: VectorSetMetadata,
        customData?: { element: string; vector: number[] }
    ) => Promise<void>
}

export default function CreateVectorSetModal({
    isOpen,
    onClose,
    onCreate,
}: CreateVectorSetModalProps) {
    // Basic form state
    const [name, setName] = useState("")
    const [dimensions, setDimensions] = useState(256)
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    
    // Vector data choice and embedding config
    const [vectorDataChoice, setVectorDataChoice] = useState<"manual" | "embedding">("embedding")
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
        provider: "tensorflow",
        tensorflow: {
            model: "universal-sentence-encoder",
        },
    })
    const [isOllamaAvailable, setIsOllamaAvailable] = useState(false)
    const [isConfigInitialized, setIsConfigInitialized] = useState(false)
    
    // UI state
    const [activePanel, setActivePanel] = useState<string | null>(null)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [previewCommand, setPreviewCommand] = useState<string | null>(null)
    
    // Metadata state for advanced configuration
    const [metadata, setMetadata] = useState<VectorSetMetadata>(() => 
        createVectorSetMetadata(embeddingConfig)
    )

    // Initialize embedding configurations
    useEffect(() => {
        async function initEmbeddingConfig() {
            try {
                console.log("[CreateVectorSetDialog] Initializing embedding config...")
                const defaultConfig = await getDefaultTextEmbeddingConfig()
                console.log(`[CreateVectorSetDialog] Default config loaded: ${JSON.stringify(defaultConfig)}`)

                setEmbeddingConfig(defaultConfig)
                setIsOllamaAvailable(defaultConfig.provider === "ollama")
                setMetadata(createVectorSetMetadata(defaultConfig))
                setIsConfigInitialized(true)
            } catch (error) {
                console.error("Error initializing embedding config:", error)
            }
        }

        initEmbeddingConfig()
    }, [])

    // Function to get the current effective embedding config based on user choices
    const getCurrentEmbeddingConfig = (): EmbeddingConfig => {
        if (vectorDataChoice === "manual") {
            return {
                provider: "none",
                none: {
                    model: "manual",
                    dimensions: dimensions,
                },
            }
        }
        return embeddingConfig
    }

    // Function to get the expected dimensions for the current configuration
    const getEffectiveDimensions = (): number => {
        const config = getCurrentEmbeddingConfig()
        if (vectorDataChoice === "manual") {
            return dimensions
        }
        return getExpectedDimensions(config)
    }

    // Update preview command when relevant state changes
    useEffect(() => {
        const updatePreviewCommand = async () => {
            if (!name || !isConfigInitialized) return

            const config = getCurrentEmbeddingConfig()
            console.log(`[CreateVectorSetDialog] Updating preview with provider: ${config.provider}`)

            try {
                const effectiveDimensions = getEffectiveDimensions()
                console.log(`[CreateVectorSetDialog] Using dimensions: ${effectiveDimensions}`)

                // Create a sample vector for preview
                const sampleVector = Array(effectiveDimensions).fill(0)

                // Create the request to get the command
                const request = {
                    keyName: name.trim(),
                    element: `initial_vector`,
                    vector: sampleVector,
                    attributes: JSON.stringify({ preview: true }),
                    useCAS: metadata.redisConfig?.defaultCAS,
                    reduceDimensions: metadata.redisConfig?.reduceDimensions,
                    ef: metadata.redisConfig?.buildExplorationFactor,
                    quantization: metadata.redisConfig?.quantization || undefined,
                    returnCommandOnly: true,
                }

                const result = await vadd(request)
                if (result.executedCommand) {
                    setPreviewCommand(result.executedCommand)
                }
            } catch (error) {
                console.error("Error generating preview command:", error)
            }
        }

        updatePreviewCommand()
    }, [name, dimensions, vectorDataChoice, embeddingConfig, metadata, isConfigInitialized])

    // Handle edit config changes
    const handleEditConfig = (config: EmbeddingConfig) => {
        console.log(`[CreateVectorSetDialog] Updating embedding config: ${JSON.stringify(config)}`)
        setEmbeddingConfig(config)
        setMetadata(prev => ({
            ...prev,
            embedding: config
        }))
    }

    // Form submission
    const handleSubmit = async () => {
        try {
            setError(null)
            setIsCreating(true)

            // Validation
            if (!name.trim()) {
                setError("Please enter a name for the vector set")
                return
            }

            if (vectorDataChoice === "manual") {
                if (!dimensions || dimensions < 2) {
                    setError("Please enter valid dimensions (minimum 2)")
                    return
                }
            } else if (vectorDataChoice === "embedding") {
                if (embeddingConfig.provider === "openai" && !userSettings.get<string>("openai_api_key")) {
                    setError("Please configure OpenAI API key in your user settings")
                    return
                }

                if (embeddingConfig.provider === "ollama" && (!embeddingConfig.ollama || !embeddingConfig.ollama.apiUrl)) {
                    setError("Please configure Ollama embedding settings")
                    return
                }
            }

            const effectiveDimensions = getEffectiveDimensions()

            // For manual mode, create a zero vector of correct dimensions
            let customData = undefined
            if (vectorDataChoice === "manual") {
                customData = {
                    element: `First Vector (Default)`,
                    vector: Array(effectiveDimensions).fill(0),
                }
            }

            await onCreate(name.trim(), effectiveDimensions, metadata, customData)
            onClose()
        } catch (err) {
            console.error("Error in CreateVectorSetModal handleSubmit:", err)
            setError(err instanceof Error ? err.message : "Failed to create vector set")
        } finally {
            setIsCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[white] rounded-lg p-6 w-[900px] min-h-[600px] max-h-[90vh] overflow-hidden relative">
                {/* Main Content */}
                <div className={`transition-transform duration-300 ${activePanel ? "transform -translate-x-full" : ""} w-full`}>
                    <div className="mb-4">
                        <h1 className="text-2xl font-semibold">Create Vector Set</h1>
                        <p className="text-gray-600 mb-4">
                            Create a new vector set to store and query your embeddings.
                        </p>
                    </div>

                    <p className="text-gray-600 mb-4 text-lg">
                        We&apos;ve chosen the defaults for you, all you have to do is provide the name of your vector set,
                        but you can customize the settings below.
                    </p>

                    <div className="flex flex-col gap-2 h-full">
                        <div className="form-body">
                            <div className="form-section">
                                <div className="form-item border-none">
                                    <label className="form-label">Vector Set Name</label>
                                    <Input
                                        className="text-right border-none"
                                        placeholder="Enter a name for your vector set"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                    {error && <div className="text-red-500 text-sm mt-1">{error}</div>}
                                </div>
                            </div>

                            <div className="form-section">
                                {/* Vector Data Button */}
                                <div className="w-full cursor-pointer" onClick={() => setActivePanel("vectorData")}>
                                    <div className="flex w-full space-x-2 items-center">
                                        <label className="form-label">Vector Data (Embeddings)</label>
                                        <div className="grow"></div>
                                        <div className="text-right text-gray-500 flex flex-col">
                                            <div className="font-bold">
                                                {vectorDataChoice === "manual" && "Manual"}
                                                {vectorDataChoice === "embedding" && "Automatic"}
                                            </div>
                                            {vectorDataChoice === "embedding" && (
                                                <div>Using {embeddingConfig.provider}</div>
                                            )}
                                        </div>
                                        <div>
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                {/* Advanced Configuration Button */}
                                <div className="w-full cursor-pointer flex items-center" onClick={() => setActivePanel("advancedConfiguration")}>
                                    <label className="form-label">Advanced Vector Settings</label>
                                    <div className="grow"></div>
                                    <div>
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>

                            {/* Command Preview */}
                            {name && (
                                <div className="p-2">
                                    <label className="form-label">Redis Command:</label>
                                    <RedisCommandBox
                                        vectorSetName={name.trim()}
                                        dim={getEffectiveDimensions()}
                                        executedCommand={previewCommand || ""}
                                        searchQuery={""}
                                        searchFilter={""}
                                        showRedisCommand={true}
                                        setShowRedisCommand={() => {}}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="grow"></div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button type="button" variant="ghost" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button variant="default" disabled={isCreating} onClick={handleSubmit}>
                                {isCreating ? "Creating..." : "Create Vector Set"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Vector Data Panel */}
                <div
                    className={`absolute top-0 left-0 w-full h-full bg-[white] p-6 transition-transform duration-300 transform ${
                        activePanel === "vectorData" ? "translate-x-0" : "translate-x-full"
                    } overflow-y-auto`}
                >
                    <div className="flex items-center mb-4 border-b pb-4">
                        <Button variant="ghost" size="icon" className="mr-2" onClick={() => setActivePanel(null)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-xl font-semibold">Vector Data</h2>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg mb-2">Tell us about the vectors you&apos;ll store here</h3>
                        <p className="text-gray-600 text-sm mb-4">Choose how you want to create and manage your vector data</p>
                    </div>

                    <div className="flex space-x-4 w-full min-h-[350px]">
                        {/* Manual Option Panel */}
                        <div
                            className={`border w-full rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                vectorDataChoice === "manual" ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-gray-400"
                            }`}
                            onClick={() => setVectorDataChoice("manual")}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div
                                        className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mr-3 mt-1 ${
                                            vectorDataChoice === "manual" ? "border-primary" : "border-gray-300"
                                        }`}
                                    >
                                        {vectorDataChoice === "manual" && <div className="w-3 h-3 rounded-full bg-red-500"></div>}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium">Manual</h4>
                                        <p className="text-sm text-gray-600 mt-1">I&apos;ll add my own vectors directly</p>
                                    </div>
                                </div>
                            </div>

                            {vectorDataChoice === "manual" && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="flex-col">
                                        <div className="flex items-center gap-2">
                                            <label className="form-label">Vector Dimensions</label>
                                            <Input
                                                type="number"
                                                className="border-gray-300"
                                                placeholder="1536"
                                                min="2"
                                                value={dimensions}
                                                onChange={(e) => setDimensions(parseInt(e.target.value))}
                                            />
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Number of dimensions for each vector</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Embedding Model Option Panel */}
                        <div
                            className={`w-full border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                vectorDataChoice === "embedding" ? "border-primary ring-2 ring-primary/20 shadow-md" : "hover:border-gray-400"
                            }`}
                            onClick={() => setVectorDataChoice("embedding")}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div
                                        className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mr-3 mt-1 ${
                                            vectorDataChoice === "embedding" ? "border-primary" : "border-gray-300"
                                        }`}
                                    >
                                        {vectorDataChoice === "embedding" && <div className="w-3 h-3 rounded-full bg-red-500"></div>}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium">Embedding Model</h4>
                                        <p className="text-sm text-gray-600 mt-1">Use an embedding engine for automatic vector creation</p>
                                        <p className="text-sm text-primary-600 mt-1">You can change this later</p>
                                    </div>
                                </div>
                            </div>

                            {vectorDataChoice === "embedding" && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="bg-gray-50 rounded p-4 flex flex-col gap-2">
                                        <div className="text-sm text-black font-bold">Text Embeddings (default)</div>
                                        <div className="flex flex-col gap-2">
                                            {isOllamaAvailable && (
                                                <div className="text-xs text-green-600 font-medium mb-2">
                                                    ✓ Using locally installed Ollama
                                                </div>
                                            )}
                                            {embeddingConfig.provider === "openai" && embeddingConfig.openai && (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">
                                                        OpenAI
                                                    </span>
                                                    <p className="text-sm text-gray-600">{embeddingConfig.openai.model}</p>
                                                </div>
                                            )}
                                            {embeddingConfig.provider === "ollama" && embeddingConfig.ollama && (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                                                        Ollama
                                                    </span>
                                                    <p className="text-sm text-gray-600">{embeddingConfig.ollama.modelName}</p>
                                                </div>
                                            )}
                                            {embeddingConfig.provider === "tensorflow" && embeddingConfig.tensorflow && (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                                                        TensorFlow
                                                    </span>
                                                    <p className="text-sm text-gray-600">{embeddingConfig.tensorflow.model} (built-in)</p>
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setIsEditConfigModalOpen(true)
                                            }}
                                        >
                                            Change
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* <div className="flex justify-end mt-6">
                        <Button variant="default" onClick={() => setActivePanel(null)}>
                            Done
                        </Button>
                    </div> */}
                </div>

                {/* Advanced Configuration Panel */}
                <div
                    className={`absolute top-0 left-0 w-full h-full bg-[white] p-6 transition-transform duration-300 transform ${
                        activePanel === "advancedConfiguration" ? "translate-x-0" : "translate-x-full"
                    } overflow-y-auto`}
                >
                    <div className="flex items-center mb-4 border-b pb-4">
                        <Button variant="ghost" size="icon" className="mr-2" onClick={() => setActivePanel(null)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-xl font-semibold">Vector Settings</h2>
                    </div>
                    
                    <AdvancedConfigEdit redisConfig={metadata} />

                    {/* <div className="flex justify-end mt-6">
                        <Button variant="default" onClick={() => setActivePanel(null)}>
                            Done
                        </Button>
                    </div> */}
                </div>

                <EditEmbeddingConfigModal
                    isOpen={isEditConfigModalOpen}
                    onClose={() => setIsEditConfigModalOpen(false)}
                    config={embeddingConfig}
                    onSave={handleEditConfig}
                />
            </div>
        </div>
    )
}
