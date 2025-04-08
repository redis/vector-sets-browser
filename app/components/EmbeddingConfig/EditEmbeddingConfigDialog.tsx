import {
    EmbeddingConfig,
    EmbeddingProvider,
    ImageModelName,
    OpenAIModelName,
    TensorFlowModelName,
} from "@/app/embeddings/types/embeddingModels"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { userSettings } from "@/app/utils/userSettings"
import { useEffect, useState } from "react"
import ImageModelSelector from "./ImageModelSelector"
import OllamaModelSelector from "./OllamaModelSelector"
import TensorFlowModelSelector from "./TensorFlowModelSelector"

const DEFAULT_CONFIG: EmbeddingConfig = {
    provider: "openai",
    openai: {
        model: "text-embedding-3-small",
        batchSize: 100,
    },
}

// Hook to manage OpenAI API key
function useOpenAIKey() {
    const [apiKey, setApiKey] = useState<string>("")
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const savedKey = userSettings.get<string>("openai_api_key")
        if (savedKey) {
            setApiKey(savedKey)
        }
        setIsLoaded(true)
    }, [])

    const saveApiKey = (key: string) => {
        if (key) {
            userSettings.set("openai_api_key", key)
            setApiKey(key)
        }
    }

    return { apiKey, saveApiKey, isLoaded }
}

interface EditEmbeddingConfigModalProps {
    isOpen: boolean
    onClose: () => void
    config?: EmbeddingConfig
    onSave: (config: EmbeddingConfig) => void
    dataFormat?: "text" | "image"
}

export default function EditEmbeddingConfigModal({
    isOpen,
    onClose,
    config = DEFAULT_CONFIG,
    onSave,
    dataFormat,
}: EditEmbeddingConfigModalProps) {
    const [error, setError] = useState<string | null>(null)
    const [provider, setProvider] = useState<EmbeddingProvider>(
        config?.provider || "openai"
    )
    const { apiKey, saveApiKey, isLoaded } = useOpenAIKey()
    const [tempApiKey, setTempApiKey] = useState("")

    // OpenAI specific state
    const [openaiConfig, setOpenaiConfig] = useState({
        model:
            config.openai?.model ??
            ("text-embedding-3-small" as OpenAIModelName),
        batchSize: config.openai?.batchSize ?? 100,
    })

    // Ollama specific state
    const [ollamaConfig, setOllamaConfig] = useState({
        apiUrl:
            config.ollama?.apiUrl ?? "http://localhost:11434",
        modelName: config.ollama?.modelName ?? "llama2",
        promptTemplate: config.ollama?.promptTemplate ?? "",
    })

    // TensorFlow specific state
    const [tensorflowConfig, setTensorflowConfig] = useState({
        model: config.tensorflow?.model || "universal-sentence-encoder",
    })

    // Image specific state
    const [imageConfig, setImageConfig] = useState({
        model: config.image?.model || ("mobilenet" as ImageModelName),
        inputSize: config.image?.inputSize || 224,
    })

    // Initialize temp API key when user's saved API key is loaded
    useEffect(() => {
        if (isLoaded) {
            setTempApiKey(apiKey || "")
        }
    }, [isLoaded, apiKey])

    // Update state when config changes
    useEffect(() => {
        if (config) {
            setProvider(config.provider || "openai")
            if (config.provider === "openai" && config.openai) {
                setOpenaiConfig({
                    model: config.openai.model ?? "text-embedding-3-small",
                    batchSize: config.openai.batchSize ?? 100,
                })
            } else if (config.provider === "ollama" && config.ollama) {
                setOllamaConfig({
                    apiUrl:
                        config.ollama.apiUrl ??
                        "http://localhost:11434",
                    modelName: config.ollama.modelName ?? "llama2",
                    promptTemplate: config.ollama.promptTemplate ?? "",
                })
            } else if (config.provider === "tensorflow" && config.tensorflow) {
                setTensorflowConfig({
                    model:
                        config.tensorflow.model || "universal-sentence-encoder",
                })
            } else if (config.provider === "image" && config.image) {
                setImageConfig({
                    model: config.image.model || "mobilenet",
                    inputSize: config.image.inputSize || 224,
                })
            }
        }
    }, [config])

    // Update provider if it doesn't match the dataFormat
    useEffect(() => {
        if (!dataFormat) return

        const isCurrentProviderValid =
            (dataFormat === "text" && ["openai", "ollama", "tensorflow"].includes(provider)) ||
            (dataFormat === "image" && ["image"].includes(provider))

        if (!isCurrentProviderValid) {
            // Set default provider based on data format
            if (dataFormat === "text") {
                setProvider("tensorflow")
            } else if (dataFormat === "image") {
                setProvider("image")
            }
        }
    }, [dataFormat, provider])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        try {
            let newConfig: EmbeddingConfig = {
                provider,
            }
            if (provider === "openai") {
                // Check if we have an API key either globally or in the form
                if (!apiKey && !tempApiKey) {
                    setError("Please enter an OpenAI API key")
                    return
                }

                // If user entered a new API key in the form, save it globally
                if (tempApiKey && tempApiKey !== apiKey) {
                    saveApiKey(tempApiKey)
                }

                // No need to include apiKey in the config anymore
                newConfig.openai = {
                    model: openaiConfig.model,
                    batchSize: openaiConfig.batchSize,
                }
            } else if (provider === "ollama") {
                if (!ollamaConfig.apiUrl) {
                    setError("Please enter an Ollama API URL")
                    return
                }
                newConfig.ollama = ollamaConfig
            } else if (provider === "tensorflow") {
                newConfig.tensorflow = {
                    model: tensorflowConfig.model as TensorFlowModelName,
                }
            } else if (provider === "image") {
                newConfig.image = {
                    model: imageConfig.model as ImageModelName,
                    inputSize: imageConfig.inputSize,
                }
            } else if (provider === "clip") {
                newConfig = {
                    provider: "clip",
                    clip: {
                        model: "clip-vit-base-patch32"
                    }
                }
            }

            onSave(newConfig)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        }
    }

    // Filter providers based on dataFormat
    const getFilteredProviders = () => {
        if (!dataFormat) {
            return ["tensorflow", "image", "ollama", "openai", "clip"]
        }

        if (dataFormat === "text") {
            return ["tensorflow", "ollama", "openai", "clip"]
        } else {
            return ["image", "clip"]
        }
    }

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        Embedding Provider
                    </DialogTitle>
                    <DialogDescription>
                        The Vector Set Browser will auto-encode new vectors when
                        you add them to a set, and use the encoder to encode
                        search queries.
                        {provider}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-2">
                        <Label
                            htmlFor="provider"
                            className="text-lg font-medium"
                        >
                            Choose a Provider
                        </Label>
                        <Select
                            value={provider}
                            onValueChange={(value: EmbeddingProvider) =>
                                setProvider(value)
                            }
                        >
                            <SelectTrigger className="w-full h-18">
                                <SelectValue placeholder="Select provider" />
                            </SelectTrigger>
                            <SelectContent className="w-full">
                                {getFilteredProviders().includes("tensorflow") && (
                                    <SelectItem key="tensorflow" value="tensorflow">
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-lg">
                                                TensorFlow - Text Embeddings
                                                (built-in)
                                            </div>
                                            <div className="  text-gray-500">
                                                Built in model for text embeddings -
                                                uses Tensorflow.js
                                            </div>
                                        </div>
                                    </SelectItem>
                                )}
                                {getFilteredProviders().includes("clip") && (
                                    <SelectItem key="clip" value="clip">
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-lg">
                                                CLIP - Text & Image Embeddings
                                            </div>
                                            <div className="text-gray-500">
                                                OpenAI{`'`}s CLIP model for text-to-image and image-to-image search
                                            </div>
                                        </div>
                                    </SelectItem>
                                )}
                                {getFilteredProviders().includes("image") && (
                                    <SelectItem key="image" value="image">
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-lg">
                                                TensorFlow - Image Embeddings
                                                (built-in)
                                            </div>
                                            <div className=" text-gray-500">
                                                Built in model for image embeddings
                                                - uses Tensorflow.js
                                            </div>
                                        </div>
                                    </SelectItem>
                                )}
                                {getFilteredProviders().includes("ollama") && (
                                    <SelectItem key="ollama" value="ollama">
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-lg">
                                                Ollama
                                            </div>
                                            <div className="text-gray-500">
                                                Ollama provider - uses Ollama API
                                            </div>
                                        </div>
                                    </SelectItem>
                                )}
                                {getFilteredProviders().includes("openai") && (
                                    <SelectItem key="openai" value="openai">
                                        <div className="flex flex-col items-start">
                                            <div className="font-medium text-lg">
                                                OpenAI
                                            </div>
                                            <div className="text-gray-500">
                                                OpenAI provider - uses OpenAI API
                                            </div>
                                        </div>
                                    </SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 p-4 border rounded-md">
                        {provider === "openai" ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="apiKey">
                                        OpenAI API Key {apiKey ? "(Saved)" : "(Not Saved)"}
                                    </Label>
                                    <Input
                                        id="apiKey"
                                        type="password"
                                        value={tempApiKey}
                                        onChange={(e) =>
                                            setTempApiKey(e.target.value)
                                        }
                                        placeholder={apiKey ? "Using saved API key" : "Enter API key"}
                                    />
                                    {apiKey && (
                                        <p className="text-xs text-gray-500">
                                            A global API key is already saved. Leave empty to use the saved key,
                                            or enter a new one to update it.
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="model"
                                        className="font-medium"
                                    >
                                        Choose a Model
                                    </Label>
                                    <Select
                                        value={openaiConfig.model}
                                        onValueChange={(
                                            value: OpenAIModelName
                                        ) =>
                                            setOpenaiConfig({
                                                ...openaiConfig,
                                                model: value,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="text-embedding-3-small">
                                                text-embedding-3-small
                                            </SelectItem>
                                            <SelectItem value="text-embedding-3-large">
                                                text-embedding-3-large
                                            </SelectItem>
                                            <SelectItem value="text-embedding-ada-002">
                                                text-embedding-ada-002 (Legacy)
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="batchSize">
                                        Batch Size
                                    </Label>
                                    <Input
                                        id="batchSize"
                                        type="number"
                                        value={openaiConfig.batchSize}
                                        onChange={(e) =>
                                            setOpenaiConfig({
                                                ...openaiConfig,
                                                batchSize: parseInt(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                    />
                                </div>
                            </>
                        ) : provider === "ollama" ? (
                            <>
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="apiUrl"
                                        className="font-medium"
                                    >
                                        API URL
                                    </Label>
                                    <Input
                                        id="apiUrl"
                                        type="text"
                                        value={ollamaConfig.apiUrl}
                                        onChange={(e) =>
                                            setOllamaConfig({
                                                ...ollamaConfig,
                                                apiUrl: e.target.value,
                                            })
                                        }
                                        placeholder="http://localhost:11434/api/embeddings"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="modelName"
                                        className="font-medium"
                                    >
                                        Choose a Model
                                    </Label>
                                    <OllamaModelSelector
                                        value={ollamaConfig.modelName}
                                        onChange={(value) =>
                                            setOllamaConfig({
                                                ...ollamaConfig,
                                                modelName: value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="promptTemplate">
                                        Prompt Template (optional)
                                    </Label>
                                    <Input
                                        id="promptTemplate"
                                        type="text"
                                        value={ollamaConfig.promptTemplate}
                                        onChange={(e) =>
                                            setOllamaConfig({
                                                ...ollamaConfig,
                                                promptTemplate: e.target.value,
                                            })
                                        }
                                        placeholder="Use {text} as placeholder for input text"
                                    />
                                </div>
                            </>
                        ) : provider === "tensorflow" ? (
                            <>
                                <div className="space-y-2">
                                    <Label
                                        htmlFor="model"
                                        className="font-medium"
                                    >
                                        Choose a Model
                                    </Label>
                                    <TensorFlowModelSelector
                                        value={tensorflowConfig.model}
                                        onChange={(value) =>
                                            setTensorflowConfig({
                                                ...tensorflowConfig,
                                                model: value,
                                            })
                                        }
                                    />
                                </div>
                                <div className="text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
                                    <p>
                                        TensorFlow.js models run directly in the
                                        browser. The first use may take a moment
                                        to download the model.
                                    </p>
                                </div>
                            </>
                        ) : provider === "image" ? (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="model">Image Model</Label>
                                    <ImageModelSelector
                                        value={imageConfig.model}
                                        onChange={(value) =>
                                            setImageConfig({
                                                ...imageConfig,
                                                model: value as ImageModelName,
                                            })
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="inputSize">
                                        Input Size (px)
                                    </Label>
                                    <Input
                                        id="inputSize"
                                        type="number"
                                        value={imageConfig.inputSize}
                                        onChange={(e) =>
                                            setImageConfig({
                                                ...imageConfig,
                                                inputSize: parseInt(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                        placeholder="224"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Images will be resized to this size
                                        before processing. Default is 224px.
                                    </p>
                                </div>
                                <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
                                    <p>
                                        Image embedding models run directly in
                                        the browser using TensorFlow.js. The
                                        first use may take a moment to download
                                        the model.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
                                No additional configuration needed. This
                                provider will not generate embeddings.
                            </div>
                        )}
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end space-x-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Save</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
