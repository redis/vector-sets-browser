import {
    createVectorSetMetadata,
    EmbeddingConfig,
    EmbeddingProvider,
    getExpectedDimensions,
    VectorSetMetadata,
} from "@/app/embeddings/types/config"
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { zodResolver } from "@hookform/resolvers/zod"
import {
    ArrowLeft,
    ChevronRight,
    Database,
    BookOpen,
    Film,
    User,
    ChevronLeft,
} from "lucide-react"
import { useState, useEffect } from "react"
import { FormProvider, useForm, UseFormReturn } from "react-hook-form"
import { z } from "zod"
import EditEmbeddingConfigModal from "../components/EmbeddingConfig/EditEmbeddingConfigDialog"
import ImportSampleData from "./ImportTab/ImportSampleData"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import ImportSampleDataDialog from "./ImportTab/ImportSampleDataDialog"
import {
    getDefaultTextEmbeddingConfig,
    getDefaultEmbeddingConfig,
} from "@/app/utils/embeddingUtils"
import {
    SampleDataset,
    sampleDatasets as configuredDatasets,
} from "./ImportTab/SampleDataSelect"
import AdvancedConfigurationPanel, {
    vectorSetSchema,
    FormValues,
} from "./AdvancedConfigurationPanel"
import { vadd } from "@/app/redis-server/api"
import RedisCommandBox from "../components/RedisCommandBox"

// Define sample datasets for use in the component
const sampleDatasets = configuredDatasets

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
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
        provider: "tensorflow",
        tensorflow: {
            model: "universal-sentence-encoder",
        },
    })
    const [isOllamaAvailable, setIsOllamaAvailable] = useState(false)
    const [embeddingConfigs, setEmbeddingConfigs] = useState<
        Record<string, EmbeddingConfig>
    >({})
    const [previewCommand, setPreviewCommand] = useState<string | null>(null)
    const [isConfigInitialized, setIsConfigInitialized] = useState(false)

    // Form setup
    const form = useForm<FormValues>({
        resolver: zodResolver(vectorSetSchema),
        defaultValues: {
            name: "",
            dimensions: 256,
            customElement: "",
            customVector: "",
            quantization: undefined,
            reduceDimensions: "",
            defaultCAS: undefined,
            buildExplorationFactor: undefined,
            loadSampleData: false,
            selectedDataset: undefined,
        },
    })

    const [activeTab, setActiveTab] = useState("automatic")
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [vectorDataChoice, setVectorDataChoice] = useState<
        "manual" | "embedding" | "sample"
    >("embedding")
    const [selectedSampleDataset, setSelectedSampleDataset] = useState<
        string | null
    >(null)
    const [activePanel, setActivePanel] = useState<string | null>(null)
    const [isSampleDataImportStarted, setIsSampleDataImportStarted] =
        useState(false)
    const [currentMetadata, setCurrentMetadata] =
        useState<VectorSetMetadata | null>(null)
    const [isSampleDataDialogOpen, setIsSampleDataDialogOpen] = useState(false)

    // Initialize embedding configurations only once
    useEffect(() => {
        async function initEmbeddingConfig() {
            try {
                console.log(
                    "[CreateVectorSetDialog] Initializing embedding config..."
                )
                const defaultConfig = await getDefaultTextEmbeddingConfig()
                console.log(
                    `[CreateVectorSetDialog] Default config loaded: ${JSON.stringify(defaultConfig)}`
                )

                setEmbeddingConfig(defaultConfig)
                setIsOllamaAvailable(defaultConfig.provider === "ollama")

                // Also load embedding configs for all sample datasets
                const configs: Record<string, EmbeddingConfig> = {}
                for (const dataset of sampleDatasets) {
                    const config = await getDefaultEmbeddingConfig(
                        dataset.embeddingType
                    )
                    configs[dataset.name] = config
                }
                setEmbeddingConfigs(configs)
                setIsConfigInitialized(true)

                console.log(
                    "[CreateVectorSetDialog] Config initialization complete"
                )
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
                    dimensions: form.getValues("dimensions"),
                },
            }
        } else if (vectorDataChoice === "sample" && selectedSampleDataset) {
            const selectedDataset = sampleDatasets.find(
                (ds) => ds.name === selectedSampleDataset
            )
            if (selectedDataset && embeddingConfigs[selectedDataset.name]) {
                return embeddingConfigs[selectedDataset.name]
            }
        }
        // Default to the current embedding config (for "embedding" choice or fallback)
        return embeddingConfig
    }

    // Function to get the expected dimensions for the current configuration
    const getEffectiveDimensions = (): number => {
        const config = getCurrentEmbeddingConfig()
        if (vectorDataChoice === "manual") {
            return form.getValues("dimensions")
        }
        return getExpectedDimensions(config)
    }

    // Simplified function to update the preview command
    const updatePreviewCommand = async (manualUpdate = false) => {
        const values = form.getValues()
        if (!values.name) return

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
                keyName: values.name.trim(),
                element: `initial_vector`,
                vector: sampleVector,
                attributes: JSON.stringify({ preview: true }),
                useCAS: values.defaultCAS,
                reduceDimensions: values.reduceDimensions
                    ? parseInt(values.reduceDimensions, 10)
                    : undefined,
                returnCommandOnly: true,
            }

            // Only make the API call if this was manually triggered or name is valid
            if (manualUpdate || values.name.length > 2) {
                const result = await vadd(request)
                if (result.executedCommand) {
                    setPreviewCommand(result.executedCommand)
                }
            }
        } catch (error) {
            console.error("Error generating preview command:", error)
        }
    }

    // Watch form value changes to update preview
    useEffect(() => {
        const subscription = form.watch((value, { name, type }) => {
            if (
                name === "name" ||
                name === "dimensions" ||
                name === "defaultCAS" ||
                name === "reduceDimensions"
            ) {
                // If config is initialized and a name is entered, update preview
                if (isConfigInitialized && value.name) {
                    updatePreviewCommand(true)
                }
            }
        })

        return () => subscription.unsubscribe()
    }, [form, isConfigInitialized, vectorDataChoice])

    // Update preview when embedding config changes
    useEffect(() => {
        if (isConfigInitialized && form.getValues("name")) {
            console.log(
                "[CreateVectorSetDialog] Embedding config changed, updating preview"
            )
            updatePreviewCommand(true)
        }
    }, [embeddingConfig, isConfigInitialized])

    // Update preview when vector data choice changes
    useEffect(() => {
        if (isConfigInitialized && form.getValues("name")) {
            console.log(
                "[CreateVectorSetDialog] Vector data choice changed, updating preview"
            )
            updatePreviewCommand(true)
        }
    }, [vectorDataChoice, isConfigInitialized])

    // Update preview when sample dataset selection changes
    useEffect(() => {
        if (
            isConfigInitialized &&
            vectorDataChoice === "sample" &&
            selectedSampleDataset &&
            form.getValues("name")
        ) {
            console.log(
                "[CreateVectorSetDialog] Sample dataset changed, updating preview"
            )
            updatePreviewCommand(true)
        }
    }, [selectedSampleDataset, isConfigInitialized])

    // Handle edit config changes
    const handleEditConfig = (config: EmbeddingConfig) => {
        console.log(
            `[CreateVectorSetDialog] Updating embedding config: ${JSON.stringify(config)}`
        )
        setEmbeddingConfig(config)
    }

    // Building metadata based on vector data choice for form submission
    const getMetadataForSubmit = async (): Promise<VectorSetMetadata> => {
        const values = form.getValues()
        // Build redisConfig object only with defined values
        const redisConfig: Record<string, string | number | boolean> = {}

        // Only add properties that are explicitly set
        if (values.quantization) {
            redisConfig.quantization = values.quantization
        }

        if (values.reduceDimensions) {
            redisConfig.reduceDimensions = parseInt(values.reduceDimensions, 10)
        }

        if (values.defaultCAS !== undefined) {
            redisConfig.defaultCAS = values.defaultCAS
        }

        if (values.buildExplorationFactor) {
            redisConfig.buildExplorationFactor = parseInt(
                values.buildExplorationFactor,
                10
            )
        }

        // Get the current embedding config
        const config = getCurrentEmbeddingConfig()

        return {
            ...createVectorSetMetadata(config),
            redisConfig:
                Object.keys(redisConfig).length > 0 ? redisConfig : undefined,
        }
    }

    const generateRandomVector = () => {
        const dimensions = form.getValues("dimensions")
        if (!isNaN(dimensions) && dimensions >= 2) {
            const vector = Array.from({ length: dimensions }, () =>
                Math.random().toFixed(4)
            ).join(", ")
            form.setValue("customVector", vector)
        }
    }

    const onSubmit = async (values: FormValues) => {
        try {
            setError(null)
            setIsCreating(true)

            // Additional validation based on vector data choice
            if (vectorDataChoice === "manual") {
                const dim = values.dimensions
                if (!dim || dim < 2) {
                    setError("Please enter valid dimensions (minimum 2)")
                    setIsCreating(false)
                    return
                }
            } else if (vectorDataChoice === "embedding") {
                // Validate embedding config
                if (
                    embeddingConfig.provider === "openai" &&
                    (!embeddingConfig.openai || !embeddingConfig.openai.apiKey)
                ) {
                    setError("Please configure OpenAI embedding settings")
                    setIsCreating(false)
                    return
                }

                if (
                    embeddingConfig.provider === "ollama" &&
                    (!embeddingConfig.ollama || !embeddingConfig.ollama.apiUrl)
                ) {
                    setError("Please configure Ollama embedding settings")
                    setIsCreating(false)
                    return
                }
            } else if (vectorDataChoice === "sample") {
                if (!selectedSampleDataset) {
                    setError("Please select a sample dataset")
                    setIsCreating(false)
                    return
                }
            }

            // Get metadata based on selection
            const metadata = await getMetadataForSubmit()

            // Update currentMetadata with the final metadata
            setCurrentMetadata(metadata)

            // Get effective dimensions
            const effectiveDimensions = getEffectiveDimensions()

            // For manual mode, create a zero vector of correct dimensions
            let customData = undefined
            if (vectorDataChoice === "manual") {
                customData = {
                    element: `initial_vector_${Date.now()}`,
                    vector: Array(effectiveDimensions).fill(0),
                }
            }

            const result = await onCreate(
                values.name.trim(),
                effectiveDimensions,
                metadata,
                customData
            )

            // Don't close dialog if sample data import is selected
            if (vectorDataChoice === "sample") {
                console.log(
                    `[CreateVectorSetDialog] Setting up sample data import for: ${selectedSampleDataset}`
                )
                // Set state to show the import panel
                setIsSampleDataImportStarted(true)
            } else {
                onClose()
            }
        } catch (err) {
            console.error("Error in CreateVectorSetModal handleSubmit:", err)
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create vector set"
            )
        } finally {
            setIsCreating(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[white] rounded-lg p-6 w-[900px] min-h-[600px] max-h-[90vh] overflow-hidden relative">
                <FormProvider {...form}>
                    {/* Main Form Content */}
                    <div
                        className={`transition-transform duration-300 ${
                            activePanel || isSampleDataImportStarted
                                ? "transform -translate-x-full"
                                : ""
                        } w-full`}
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

                        <Form {...form}>
                            <p className="text-gray-600 mb-4 text-lg">
                                We&apos;ve chosen the defaults for you, all you
                                have to do is provide the name of your vector
                                set, but you can customize the settings below.
                            </p>
                            <form
                                onSubmit={form.handleSubmit(onSubmit)}
                                className="flex flex-col gap-2 h-full"
                            >
                                <div className="form-body">
                                    <div className="form-section">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem className="form-item border-none">
                                                    <FormLabel className="form-label">
                                                        Vector Set Name
                                                        <FormMessage />
                                                    </FormLabel>
                                                    <FormControl className="form-control">
                                                        <Input
                                                            className="text-right border-none"
                                                            placeholder="Enter a name for your vector set"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="form-section">
                                        {/* Vector Data Button */}
                                        <div
                                            className="w-full cursor-pointer"
                                            onClick={() =>
                                                setActivePanel("vectorData")
                                            }
                                        >
                                            <div className="flex w-full space-x-2 items-center">
                                                <FormLabel className="form-label">
                                                    Vector Data
                                                </FormLabel>
                                                <div className="grow"></div>
                                                <div className="text-right text-gray-500 flex flex-col">
                                                    <div className="font-bold">
                                                        {vectorDataChoice ===
                                                            "manual" &&
                                                            "Manual"}
                                                        {vectorDataChoice ===
                                                            "embedding" &&
                                                            "Automatic"}
                                                        {vectorDataChoice ===
                                                            "sample" &&
                                                            "Sample Data"}
                                                    </div>
                                                    {vectorDataChoice ===
                                                        "embedding" && (
                                                        <div>
                                                            Using{" "}
                                                            {
                                                                embeddingConfig.provider
                                                            }
                                                        </div>
                                                    )}
                                                    {vectorDataChoice ===
                                                        "sample" &&
                                                        selectedSampleDataset && (
                                                            <div>
                                                                {
                                                                    selectedSampleDataset
                                                                }
                                                            </div>
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
                                        <div
                                            className="w-full cursor-pointer flex items-center"
                                            onClick={() =>
                                                setActivePanel(
                                                    "advancedConfiguration"
                                                )
                                            }
                                        >
                                            <FormLabel className="form-label">
                                                Advanced Configuration
                                            </FormLabel>
                                            <div className="grow"></div>
                                            <div>
                                                <ChevronRight className="h-5 w-5" />
                                            </div>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="text-red-500 text-sm">
                                            {error}
                                        </div>
                                    )}
                                    {/* Command Preview */}
                                    {form.getValues("name") && (
                                        <div className="p-2">
                                            <FormLabel className="form-label">
                                                Redis Command:
                                            </FormLabel>
                                            <RedisCommandBox
                                                vectorSetName={form
                                                    .getValues("name")
                                                    .trim()}
                                                dim={form.getValues(
                                                    "dimensions"
                                                )}
                                                executedCommand={
                                                    previewCommand || ""
                                                }
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
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={onClose}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        variant="default"
                                        disabled={isCreating}
                                    >
                                        {isCreating
                                            ? "Creating..."
                                            : "Create Vector Set"}
                                    </Button>
                                </div>
                            </form>
                        </Form>
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
                            <h2 className="text-xl font-semibold">
                                Vector Data
                            </h2>
                        </div>

                        <div className="mb-6">
                            <h3 className="text-lg mb-2">
                                Tell us about the vectors you'll store here
                            </h3>
                            <p className="text-gray-600 text-sm mb-4">
                                Choose how you want to create and manage your
                                vector data
                            </p>
                        </div>

                        <div className="flex space-x-4 w-full min-h-[350px]">
                            {/* Manual Option Panel */}
                            <div
                                className={`border w-full rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                    vectorDataChoice === "manual"
                                        ? "border-primary ring-2 ring-primary/20 shadow-md"
                                        : "hover:border-gray-400"
                                }`}
                                onClick={() => {
                                    setVectorDataChoice("manual")
                                    updatePreviewCommand(true)
                                }}
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
                                                I'll add my own vectors directly
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {vectorDataChoice === "manual" && (
                                    <div className="mt-6 border-t pt-4">
                                        <FormField
                                            control={form.control}
                                            name="dimensions"
                                            render={({ field }) => (
                                                <FormItem className="flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <FormLabel className="form-label">
                                                            Vector Dimensions
                                                        </FormLabel>

                                                        <FormControl className="form-control">
                                                            <Input
                                                                type="number"
                                                                className="border-gray-300"
                                                                placeholder="1536"
                                                                min="2"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </div>

                                                    <FormMessage />
                                                    <FormDescription>
                                                        Number of dimensions for
                                                        each vector
                                                    </FormDescription>
                                                </FormItem>
                                            )}
                                        />
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
                                onClick={() => {
                                    setVectorDataChoice("embedding")
                                    updatePreviewCommand(true)
                                }}
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
                                            {vectorDataChoice ===
                                                "embedding" && (
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
                                                Click to change
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {vectorDataChoice === "embedding" && (
                                    <div className="mt-6 border-t pt-4">
                                        <div className="bg-gray-50 rounded p-4 flex flex-col gap-2">
                                            <div className="text-sm text-black font-bold">
                                                Text Embeddings (default)
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                {isOllamaAvailable && (
                                                    <div className="text-xs text-green-600 font-medium mb-2">
                                                        ✓ Using locally
                                                        installed Ollama
                                                    </div>
                                                )}
                                                {embeddingConfig.provider ===
                                                    "openai" &&
                                                    embeddingConfig.openai && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 rounded bg-green-100 text-green-800 text-xs font-medium">
                                                                OpenAI
                                                            </span>
                                                            <p className="text-sm text-gray-600">
                                                                {
                                                                    embeddingConfig
                                                                        .openai
                                                                        .model
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                {embeddingConfig.provider ===
                                                    "ollama" &&
                                                    embeddingConfig.ollama && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                                                                Ollama
                                                            </span>
                                                            <p className="text-sm text-gray-600">
                                                                {
                                                                    embeddingConfig
                                                                        .ollama
                                                                        .modelName
                                                                }
                                                            </p>
                                                        </div>
                                                    )}
                                                {embeddingConfig.provider ===
                                                    "tensorflow" &&
                                                    embeddingConfig.tensorflow && (
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                                                                TensorFlow
                                                            </span>
                                                            <p className="text-sm text-gray-600">
                                                                {
                                                                    embeddingConfig
                                                                        .tensorflow
                                                                        .model
                                                                }{" "}
                                                                (built-in)
                                                            </p>
                                                        </div>
                                                    )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setIsEditConfigModalOpen(
                                                        true
                                                    )
                                                }}
                                            >
                                                Change
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sample Data Option Panel */}
                            <div
                                className={`w-full border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                                    vectorDataChoice === "sample"
                                        ? "border-primary ring-2 ring-primary/20 shadow-md"
                                        : "hover:border-gray-400"
                                }`}
                                onClick={() => {
                                    setVectorDataChoice("sample")
                                    setIsSampleDataDialogOpen(true)
                                    updatePreviewCommand(true)
                                }}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-2 items-start">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-5 h-5 shrink-0 rounded-full border flex items-center justify-center ${
                                                    vectorDataChoice ===
                                                    "sample"
                                                        ? "border-primary"
                                                        : "border-gray-300"
                                                }`}
                                            >
                                                {vectorDataChoice ===
                                                    "sample" && (
                                                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                                )}
                                            </div>
                                            <h4 className="text-lg font-medium">
                                                Sample Data
                                            </h4>
                                        </div>
                                        <p className="text-sm text-gray-600 mt-2">
                                            Choose from one of 3 pre-built
                                            datasets, including text and images.
                                            Movies, Books, Faces, etc.
                                        </p>
                                        {selectedSampleDataset && (
                                            <p className="text-sm text-primary-600 mt-2">
                                                Selected:{" "}
                                                {selectedSampleDataset}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end mt-6">
                            <Button
                                variant="default"
                                onClick={() => setActivePanel(null)}
                            >
                                Done
                            </Button>
                        </div>
                    </div>

                    {/* Advanced Configuration Panel */}
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-[white] p-6 transition-transform duration-300 transform ${
                            activePanel === "advancedConfiguration"
                                ? "translate-x-0"
                                : "translate-x-full"
                        } overflow-y-auto`}
                    >
                        <AdvancedConfigurationPanel
                            form={form}
                            onBack={() => setActivePanel(null)}
                        />
                    </div>

                    {/* Sample Data Import Panel - This is shown after vector set is created */}
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-[white] p-6 transition-transform duration-300 transform ${
                            isSampleDataImportStarted
                                ? "translate-x-0"
                                : "translate-x-full"
                        } overflow-y-auto`}
                    >
                        <div className="flex items-center mb-4 border-b pb-4">
                            <h2 className="text-xl font-semibold">
                                Import Sample Data
                            </h2>
                        </div>

                        <div className="bg-green-50 border border-green-100 rounded-md p-3 mb-4">
                            <p className="text-green-700 text-sm">
                                <span className="font-semibold">
                                    Vector set "{form.getValues("name").trim()}"
                                    created successfully!
                                </span>{" "}
                                Now you can import the sample data.
                            </p>
                        </div>

                        {isSampleDataImportStarted && (
                            <ImportSampleData
                                onClose={onClose}
                                metadata={
                                    vectorDataChoice === "embedding"
                                        ? {
                                              ...createVectorSetMetadata(
                                                  embeddingConfig
                                              ),
                                              redisConfig: form.getValues(
                                                  "quantization"
                                              )
                                                  ? {
                                                        quantization:
                                                            form.getValues(
                                                                "quantization"
                                                            ),
                                                    }
                                                  : undefined,
                                          }
                                        : vectorDataChoice === "sample" &&
                                            selectedSampleDataset
                                          ? (() => {
                                                const selectedDataset =
                                                    sampleDatasets.find(
                                                        (ds) =>
                                                            ds.name ===
                                                            selectedSampleDataset
                                                    )
                                                return selectedDataset
                                                    ? {
                                                          ...createVectorSetMetadata(
                                                              embeddingConfigs[
                                                                  selectedDataset
                                                                      .name
                                                              ] || {
                                                                  provider:
                                                                      "tensorflow",
                                                                  tensorflow: {
                                                                      model: "universal-sentence-encoder",
                                                                  },
                                                              }
                                                          ),
                                                          redisConfig:
                                                              form.getValues(
                                                                  "quantization"
                                                              )
                                                                  ? {
                                                                        quantization:
                                                                            form.getValues(
                                                                                "quantization"
                                                                            ),
                                                                    }
                                                                  : undefined,
                                                      }
                                                    : {
                                                          embedding: {
                                                              provider:
                                                                  "none" as EmbeddingProvider,
                                                          },
                                                          created:
                                                              new Date().toISOString(),
                                                          redisConfig:
                                                              form.getValues(
                                                                  "quantization"
                                                              )
                                                                  ? {
                                                                        quantization:
                                                                            form.getValues(
                                                                                "quantization"
                                                                            ),
                                                                    }
                                                                  : undefined,
                                                      }
                                            })()
                                          : {
                                                embedding: {
                                                    provider:
                                                        "none" as EmbeddingProvider,
                                                },
                                                created:
                                                    new Date().toISOString(),
                                                redisConfig: form.getValues(
                                                    "quantization"
                                                )
                                                    ? {
                                                          quantization:
                                                              form.getValues(
                                                                  "quantization"
                                                              ),
                                                      }
                                                    : undefined,
                                            }
                                }
                                vectorSetName={form.getValues("name").trim()}
                                onUpdateMetadata={(newMetadata) => {
                                    // Update embedding config based on the new metadata
                                    setEmbeddingConfig(newMetadata.embedding)
                                }}
                                selectedDataset={selectedSampleDataset}
                                // The user will control when to start the import, not automatically
                                importMode={false}
                            />
                        )}
                    </div>
                </FormProvider>

                {/* Replace the inline dialog with the new component */}
                <ImportSampleDataDialog
                    isOpen={isSampleDataDialogOpen}
                    onClose={() => setIsSampleDataDialogOpen(false)}
                    metadata={currentMetadata}
                    vectorSetName={form.getValues("name").trim()}
                    onUpdateMetadata={(newMetadata) => {
                        // Update embedding config based on the new metadata
                        setEmbeddingConfig(newMetadata.embedding)
                        setCurrentMetadata(newMetadata)
                    }}
                    onSelectDataset={(datasetName) => {
                        setSelectedSampleDataset(datasetName)
                        setIsSampleDataDialogOpen(false)
                    }}
                />

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
