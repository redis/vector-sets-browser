import {
    EmbeddingConfig,
    EmbeddingDataFormat,
    EmbeddingProvider,
    getDefaultModelForProvider,
    getEmbeddingDataFormat,
    getModelData,
    getProviderInfo,
    getProvidersByDataFormat
} from "@/lib/embeddings/types/embeddingModels"
import { defaultOllamaUrl } from "@/lib/embeddings/utils"
import { userSettings } from "@/lib/storage/userSettings"
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
import { useEffect, useState } from "react"
import {
    ImageEmbeddingIcon,
    MultiModalEmbeddingIcon,
    TextEmbeddingIcon
} from "./EmbeddingIcons"
import ModelSelector from "./ModelSelector"
import ProviderSelector from "./ProviderSelector"

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
    dataFormat?: EmbeddingDataFormat
}

export default function EditEmbeddingConfigModal({
    isOpen,
    onClose,
    config = DEFAULT_CONFIG,
    onSave,
    dataFormat: initialDataFormat,
}: EditEmbeddingConfigModalProps) {
    const [error, setError] = useState<string | null>(null)
    const [provider, setProvider] = useState<EmbeddingProvider>(
        config?.provider || "openai"
    )
    const [selectedDataFormat, setSelectedDataFormat] = useState<EmbeddingDataFormat>(
        initialDataFormat || getEmbeddingDataFormat(config) || "text"
    )
    const { apiKey, saveApiKey, isLoaded } = useOpenAIKey()
    const [tempApiKey, setTempApiKey] = useState("")

    // OpenAI specific state
    const [openaiConfig, setOpenaiConfig] = useState({
        model: config.openai?.model ?? "text-embedding-3-small",
        batchSize: config.openai?.batchSize ?? 100,
    })

    // Ollama specific state
    const [ollamaConfig, setOllamaConfig] = useState({
        apiUrl: config.ollama?.apiUrl ?? defaultOllamaUrl(),
        modelName: config.ollama?.modelName ?? "mxbai-embed-large",
        promptTemplate: config.ollama?.promptTemplate ?? "",
    })

    // Image specific state
    const [imageConfig, setImageConfig] = useState({
        model: config.image?.model || "mobilenet",
        inputSize: config.image?.inputSize || 224,
    })

    // CLIP specific state
    const [clipConfig, setClipConfig] = useState({
        model: config.clip?.model || "clip-vit-base-patch32",
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
                    apiUrl: config.ollama.apiUrl ?? defaultOllamaUrl(),
                    modelName: config.ollama.modelName ?? "mxbai-embed-large",
                    promptTemplate: config.ollama.promptTemplate ?? "",
                })
            } else if (config.provider === "image" && config.image) {
                setImageConfig({
                    model: config.image.model || "mobilenet",
                    inputSize: config.image.inputSize || 224,
                })
            } else if (config.provider === "clip" && config.clip) {
                setClipConfig({
                    model: config.clip.model || "clip-vit-base-patch32",
                })
            }
        }
    }, [config])

    // When data format changes, select an appropriate provider
    useEffect(() => {
        const providers = getProvidersByDataFormat(selectedDataFormat);
        
        // Check if current provider supports the selected data format
        const currentProviderInfo = getProviderInfo(provider);
        const isProviderCompatible = currentProviderInfo.dataFormats.includes(selectedDataFormat);
        
        if (!isProviderCompatible && providers.length > 0) {
            // Select the first available provider for this data format
            setProvider(providers[0].id);
        }
    }, [selectedDataFormat]);

    // When provider changes, initialize with default model for that provider
    useEffect(() => {
        const defaultModel = getDefaultModelForProvider(provider);
        if (defaultModel) {
            if (provider === "openai") {
                setOpenaiConfig(prev => ({ ...prev, model: defaultModel.id }));
            } else if (provider === "ollama") {
                setOllamaConfig(prev => ({ ...prev, modelName: defaultModel.id }));
            } else if (provider === "image") {
                setImageConfig(prev => ({ ...prev, model: defaultModel.id }));
            } else if (provider === "clip") {
                setClipConfig(prev => ({ ...prev, model: defaultModel.id }));
            }
        }
    }, [provider]);

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
            } else if (provider === "image") {
                newConfig.image = {
                    model: imageConfig.model,
                    inputSize: imageConfig.inputSize,
                }
            } else if (provider === "clip") {
                newConfig.clip = {
                    model: clipConfig.model
                }
            }

            onSave(newConfig)
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        }
    }

    if (!isOpen) return null

    // Helper to render provider-specific configuration UI
    const renderProviderConfig = () => {
        switch (provider) {
            case "openai":
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="apiKey">
                                OpenAI API Key {apiKey ? "(Saved)" : "(Not Saved)"}
                            </Label>
                            <Input
                                id="apiKey"
                                type="password"
                                value={tempApiKey}
                                onChange={(e) => setTempApiKey(e.target.value)}
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
                            <Label htmlFor="model" className="font-medium">
                                Choose a Model
                            </Label>
                            <ModelSelector
                                provider="openai"
                                value={openaiConfig.model}
                                onChange={(value) => 
                                    setOpenaiConfig(prev => ({ ...prev, model: value }))
                                }
                            />
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
                                        batchSize: parseInt(e.target.value),
                                    })
                                }
                            />
                        </div>
                    </>
                );
                
            case "ollama":
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="apiUrl" className="font-medium">
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
                                placeholder={`${defaultOllamaUrl()}/api/embeddings`}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="modelName" className="font-medium">
                                Choose a Model
                            </Label>
                            <ModelSelector
                                provider="ollama"
                                value={ollamaConfig.modelName}
                                onChange={(value) =>
                                    setOllamaConfig({
                                        ...ollamaConfig,
                                        modelName: value,
                                    })
                                }
                                allowCustom={true}
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
                );
                
            case "image":
                return (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="model">Image Model</Label>
                            <ModelSelector
                                provider="image"
                                value={imageConfig.model}
                                onChange={(value) =>
                                    setImageConfig({
                                        ...imageConfig,
                                        model: value,
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
                                        inputSize: parseInt(e.target.value),
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
                );
                
            case "clip":
                const clipModel = getModelData({ provider: "clip", clip: { model: clipConfig.model } });
                return (
                    <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
                        <p>
                            {clipModel?.name} will be used for both text and image embeddings.
                            This model creates {clipModel?.dimensions}-dimensional vectors.
                        </p>
                        <p className="mt-2">
                            Multi-modal models can understand both text and images in the same vector space,
                            enabling cross-modal similarity search.
                        </p>
                    </div>
                );
                
            default:
                return (
                    <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
                        No additional configuration needed.
                    </div>
                );
        }
    };

    // Data format selection options
    const dataFormatOptions = [
        {
            id: "text",
            name: "Text",
            description: "Process and embed textual data like sentences, paragraphs, or documents",
            icon: <TextEmbeddingIcon />
        },
        {
            id: "image",
            name: "Image",
            description: "Process and embed images for visual similarity search",
            icon: <ImageEmbeddingIcon />
        },
        {
            id: "text-and-image",
            name: "Multi-modal (Text & Image)",
            description: "Process both text and images in a unified embedding space",
            icon: <MultiModalEmbeddingIcon />
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">
                        Embedding Configuration
                    </DialogTitle>
                    <DialogDescription>
                        The Vector Set Browser will auto-encode new vectors when
                        you add them to a set, and use the encoder to encode
                        search queries.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Data Format Selection */}
                    <div className="space-y-3">
                        <Label className="text-base font-semibold">
                            Step 1: Select your data type
                        </Label>
                        <div className="pt-2">
                            <div className="grid grid-cols-3 gap-3">
                                {dataFormatOptions.map(option => (
                                    <div 
                                        key={option.id}
                                        className={`border rounded-md p-4 cursor-pointer transition-all hover:bg-slate-50 
                                            ${selectedDataFormat === option.id ? 'border-2 border-primary ring-1 ring-primary' : 'border-border'}`}
                                        onClick={() => setSelectedDataFormat(option.id as EmbeddingDataFormat)}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <div>{option.icon}</div>
                                            <span className="font-semibold">{option.name}</span>
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {option.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Provider Selection */}
                    <div className="space-y-3 pt-4">
                        <Label className="text-base font-semibold">
                            Step 2: Select embedding provider
                        </Label>
                        <ProviderSelector 
                            value={provider} 
                            onChange={setProvider} 
                            dataFormat={selectedDataFormat}
                        />
                    </div>

                    {/* Step 3: Provider Specific Configuration */}
                    <div className="space-y-3 pt-4">
                        <Label className="text-base font-semibold">
                            Step 3: Configure provider settings
                        </Label>
                        <div className="space-y-2 p-4 border rounded-md">
                            {renderProviderConfig()}
                        </div>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end space-x-2 pt-2">
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
