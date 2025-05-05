import { ApiError } from "@/app/api/client"
import {
    EmbeddingConfig,
    getEmbeddingDataFormat,
    getExpectedDimensions,
    getModelName,
    getProviderInfo
} from "@/app/embeddings/types/embeddingModels"
import {
    createVectorSetMetadata,
    VectorSetMetadata,
} from "@/app/types/vectorSetMetaData"

import EditEmbeddingConfigModal from "@/app/components/EmbeddingConfig/EditEmbeddingConfigDialog"
import {
    getEmbeddingIcon
} from "@/app/components/EmbeddingConfig/EmbeddingIcons"
import RedisCommandBox from "@/app/components/RedisCommandBox"
import { vadd } from "@/app/redis-server/api"
import { getDefaultTextEmbeddingConfig } from "@/app/utils/embeddingUtils"
import { userSettings } from "@/app/utils/userSettings"
import AdvancedConfigEdit from "@/app/vectorset/components/AdvancedConfigEdit"
import { DEFAULT_EMBEDDING } from "@/app/vectorset/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, ChevronRight, MessageSquareText } from "lucide-react"
import { useEffect, useRef, useState } from "react"

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
    const nameInputRef = useRef<HTMLInputElement>(null)

    // Vector data choice and embedding config
    const [vectorDataChoice, setVectorDataChoice] = useState<
        "manual" | "embedding"
    >("embedding")
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
        provider: "clip",
        clip: {
            model: "clip-vit-base-patch32",
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
                console.log(
                    "[CreateVectorSetDialog] Initializing embedding config..."
                )
                const defaultConfig = await getDefaultTextEmbeddingConfig()
                console.log(
                    `[CreateVectorSetDialog] Default config loaded: ${JSON.stringify(
                        defaultConfig
                    )}`
                )

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

    // Auto-focus the name input when dialog opens
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure the dialog is fully mounted
            setTimeout(() => {
                nameInputRef.current?.focus()
            }, 0)
        }
    }, [isOpen])

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
            console.log(
                `[CreateVectorSetDialog] Updating preview with provider: ${config.provider}`
            )

            try {
                const effectiveDimensions = getEffectiveDimensions()
                console.log(
                    `[CreateVectorSetDialog] Using dimensions: ${effectiveDimensions}`
                )

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
                    quantization:
                        metadata.redisConfig?.quantization || undefined,
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
    }, [
        name,
        dimensions,
        vectorDataChoice,
        embeddingConfig,
        metadata,
        isConfigInitialized,
    ])

    // Handle edit config changes
    const handleEditConfig = (config: EmbeddingConfig) => {
        console.log(
            `[CreateVectorSetDialog] Updating embedding config: ${JSON.stringify(
                config
            )}`
        )
        setEmbeddingConfig(config)
        setMetadata((prev) => ({
            ...prev,
            embedding: config,
        }))
    }

    // Handle Enter key press
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSubmit()
        }
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
                if (
                    embeddingConfig.provider === "openai" &&
                    !userSettings.get<string>("openai_api_key")
                ) {
                    setError(
                        "Please configure OpenAI API key in your user settings"
                    )
                    return
                }

                if (
                    embeddingConfig.provider === "ollama" &&
                    (!embeddingConfig.ollama || !embeddingConfig.ollama.apiUrl)
                ) {
                    setError("Please configure Ollama embedding settings")
                    return
                }
            }

            const effectiveDimensions = getEffectiveDimensions()

            // For manual mode, create a zero vector of correct dimensions
            let customData = undefined
            if (vectorDataChoice === "manual") {
                customData = {
                    element: `Placeholder (Vector)`,
                    vector: Array(effectiveDimensions).fill(0),
                }
            }

            await onCreate(
                name.trim(),
                effectiveDimensions,
                metadata,
                customData
            )
            // Only close if successful
            onClose()
        } catch (err) {
            console.error("Error in CreateVectorSetModal handleSubmit:", err)
            // Handle ApiError specifically since that's what we'll get from vectorSets.create
            if (err instanceof ApiError) {
                setError(err.message)
            } else {
                setError(
                    err instanceof Error ? err.message : "Failed to create vector set"
                )
            }
        } finally {
            setIsCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[white] rounded-lg p-6 w-4xl min-h-[600px] max-h-[90vh] overflow-hidden relative">
                {/* Error Alert */}
                {error && (
                    <div className="absolute top-0 left-0 right-0 bg-red-50 border-b border-red-200 p-4 rounded-t-lg">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-5 w-5 text-red-400"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">
                                    Error Creating Vector Set
                                </h3>
                                <div className="mt-1 text-sm text-red-700">
                                    {error}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {/* Main Content */}
                <div
                    className={`transition-transform duration-300 ${
                        activePanel ? "transform -translate-x-full" : ""
                    } w-full ${error ? "mt-20" : ""}`}
                >
                    <div className="mb-4">
                        <h1 className="text-2xl font-semibold">
                            Create Vector Set
                        </h1>
                        <p className="text-gray-600 mb-4">
                            Create a new vector set to store and query your
                            embeddings.
                        </p>
                    </div>

                    <p className="text-gray-600 mb-4">
                        We&apos;ve chosen the defaults for you, all you have to
                        do is provide the name of your vector set, but you can
                        customize the settings below.
                    </p>

                    <div className="flex flex-col gap-2 min-h-[400px] max-h-[90vh] ">
                        <div className="form-body">
                            <div className="form-section">
                                <div className="form-item border-none">
                                    <div className="flex flex-col gap-2">
                                        <label className="form-label">
                                            Vector Set Name
                                        </label>
                                    </div>
                                    <Input
                                        ref={nameInputRef}
                                        className="text-right border-none"
                                        placeholder="Enter a name for your vector set"
                                        value={name}
                                        onChange={(e) =>
                                            setName(e.target.value)
                                        }
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                {/* Vector Data Button */}
                                <div
                                    className="w-full cursor-pointer p-2"
                                    onClick={() => setActivePanel("vectorData")}
                                >
                                    <div className="flex w-full">
                                        <div className="flex-1">
                                            <label className="form-label">
                                                Vector Data (Embedding size & model)
                                            </label>
                                        </div>
                                        <div className="flex-1 flex flex-col items-end pr-2">
                                            <div className="font-bold text-right">
                                                {vectorDataChoice === "manual" && "Manual"}
                                                {vectorDataChoice === "embedding" && (() => {
                                                    const dataFormat = getEmbeddingDataFormat(embeddingConfig);
                                                    switch(dataFormat) {
                                                        case "text": return "Text Embedding Model";
                                                        case "image": return "Image Embedding Model";
                                                        case "text-and-image": return "Multi-Modal Embedding Model";
                                                        default: return "Embedding Model";
                                                    }
                                                })()}
                                            </div>
                                            {vectorDataChoice === "manual" && (
                                                <div className="text-sm text-gray-500 text-right">
                                                    {dimensions} dimensions
                                                </div>
                                            )}
                                            {vectorDataChoice === "embedding" && (
                                                <div className="flex flex-col text-xs text-gray-500 text-right">
                                                    <div>
                                                        Provider: {
                                                            getProviderInfo(
                                                                embeddingConfig.provider
                                                            ).displayName
                                                        }
                                                        {getProviderInfo(
                                                            embeddingConfig.provider
                                                        ).isBuiltIn && " (Built-in)"}
                                                    </div>
                                                    <div>
                                                        Model: {getModelName(embeddingConfig)}
                                                    </div>
                                                    <div>
                                                        Dimensions: {getExpectedDimensions(embeddingConfig)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center">
                                            <ChevronRight className="h-5 w-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="form-section">
                                {/* Advanced Configuration Button */}
                                <div
                                    className="w-full cursor-pointer flex items-center"
                                    onClick={() =>
                                        setActivePanel("advancedConfiguration")
                                    }
                                >
                                    <label className="form-label">
                                        Advanced Vector Settings
                                    </label>
                                    <div className="grow"></div>
                                    <div>
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>

                            {/* Command Preview */}
                            {name && (
                                <div className="p-2">
                                    <label className="form-label">
                                        Redis Command:
                                    </label>
                                    <RedisCommandBox
                                        vectorSetName={name.trim()}
                                        dim={getEffectiveDimensions()}
                                        executedCommand={previewCommand || ""}
                                        searchQuery={""}
                                        searchFilter={""}
                                        showRedisCommand={true}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="grow"></div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                disabled={isCreating}
                                onClick={handleSubmit}
                            >
                                {isCreating
                                    ? "Creating..."
                                    : "Create Vector Set"}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Vector Data Panel */}
                <div
                    className={`absolute top-0 left-0 w-full h-full bg-[white] p-6 transition-transform duration-300 transform ${
                        activePanel === "vectorData"
                            ? "translate-x-0"
                            : "translate-x-full"
                    } overflow-y-auto`}
                >
                    <div className="flex items-center mb-4 border-b pb-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-2"
                            onClick={() => setActivePanel(null)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-xl font-semibold">Vector Data</h2>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-lg mb-2">
                            Tell us about the vectors you&apos;ll store here
                        </h3>
                        <p className="text-gray-600 text-sm mb-4">
                            Choose how you want to create and manage your vector
                            data
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 w-full min-h-[350px]">
                        {/* Manual Option Panel */}
                        <div
                            className={`border w-full rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                vectorDataChoice === "manual"
                                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                                    : "hover:border-gray-400"
                            }`}
                            onClick={() => setVectorDataChoice("manual")}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div
                                        className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mr-3 mt-1 ${
                                            vectorDataChoice === "manual"
                                                ? "border-primary"
                                                : "border-gray-300"
                                        }`}
                                    >
                                        {vectorDataChoice === "manual" && (
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium">
                                            Manual
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Set the dimensions manually. No
                                            built-in embedding model
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {vectorDataChoice === "manual" && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="bg-gray-50 rounded p-4 flex flex-col gap-3">
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Data Format:
                                            </div>
                                            <div className="flex items-center space-x-1 font-bold">
                                                <MessageSquareText className="h-5 w-5 text-blue-500" />
                                                <span>Direct Vector Input</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Vector Dimensions:
                                            </div>
                                            <div className="font-bold">
                                                {dimensions}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <label className="text-gray-600">
                                                Change Dimensions:
                                            </label>
                                            <Input
                                                type="number"
                                                className="border-gray-300 w-32"
                                                placeholder={DEFAULT_EMBEDDING.DIMENSIONS.toString()}
                                                min="2"
                                                value={dimensions}
                                                onChange={(e) =>
                                                    setDimensions(
                                                        parseInt(e.target.value)
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Embedding Model Option Panel */}
                        <div
                            className={`w-full border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                vectorDataChoice === "embedding"
                                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                                    : "hover:border-gray-400"
                            }`}
                            onClick={() => setVectorDataChoice("embedding")}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start">
                                    <div
                                        className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center mr-3 mt-1 ${
                                            vectorDataChoice === "embedding"
                                                ? "border-primary"
                                                : "border-gray-300"
                                        }`}
                                    >
                                        {vectorDataChoice === "embedding" && (
                                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-medium">
                                            Embedding Model
                                        </h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Use an embedding engine for
                                            automatic vector creation
                                        </p>
                                        <p className="text-sm text-primary-600 mt-1">
                                            You can change this later
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {vectorDataChoice === "embedding" && (
                                <div className="mt-6 border-t pt-4">
                                    <div className="bg-gray-50 rounded p-4 flex flex-col gap-3  text-sm">
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Data Format:
                                            </div>
                                            <div className="flex items-center space-x-1 font-bold">
                                                {(() => {
                                                    const dataFormat =
                                                        getEmbeddingDataFormat(
                                                            embeddingConfig
                                                        )
                                                    const Icon =
                                                        getEmbeddingIcon(
                                                            dataFormat
                                                        )
                                                    return (
                                                        <>
                                                            <Icon />
                                                            <span className="capitalize">
                                                                {dataFormat.replace(
                                                                    "-",
                                                                    " & "
                                                                )}
                                                            </span>
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Provider:
                                            </div>
                                            <div className="font-bold">
                                                {embeddingConfig.provider
                                                    ? getProviderInfo(
                                                          embeddingConfig.provider
                                                      ).displayName
                                                    : "None"}
                                                {embeddingConfig.provider && 
                                                 getProviderInfo(embeddingConfig.provider).isBuiltIn && 
                                                 " (Built-in)"}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Model:
                                            </div>
                                            <div className="font-bold">
                                                {getModelName(embeddingConfig)}
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="text-gray-600">
                                                Vector Dimensions:
                                            </div>
                                            <div className="font-bold">
                                                {getExpectedDimensions(
                                                    embeddingConfig
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setIsEditConfigModalOpen(true)
                                            }}
                                            className="mt-2"
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
                        activePanel === "advancedConfiguration"
                            ? "translate-x-0"
                            : "translate-x-full"
                    } overflow-y-auto`}
                >
                    <div className="flex items-center mb-4 border-b pb-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="mr-2"
                            onClick={() => setActivePanel(null)}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h2 className="text-xl font-semibold">
                            Vector Settings
                        </h2>
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
