import {
    createVectorSetMetadata,
    EmbeddingConfig,
    EmbeddingProvider,
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
import { ArrowLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { FormProvider, useForm } from "react-hook-form"
import { z } from "zod"
import EditEmbeddingConfigModal from "../components/EmbeddingConfig/EditEmbeddingConfigDialog"

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

const vectorSetSchema = z.object({
    name: z
        .string()
        .min(1, "Please enter a name for the vector set")
        .refine(
            (name) => !/\s/.test(name),
            "Vector name cannot contain spaces"
        ),
    dimensions: z.coerce.number(),
    customElement: z.string().optional(),
    customVector: z.string().optional(),
    quantization: z.enum(["Q8", "BIN", "NOQUANT"]).optional(),
    reduceDimensions: z.string().optional(),
    defaultCAS: z.boolean().optional(),
    buildExplorationFactor: z.string().optional(),
})

type FormValues = z.infer<typeof vectorSetSchema>

export default function CreateVectorSetModal({
    isOpen,
    onClose,
    onCreate,
}: CreateVectorSetModalProps) {
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
        provider: "ollama",
        ollama: {
            apiUrl: "http://localhost:11434/api/embeddings",
            modelName: "mxbai-embed-large",
            promptTemplate: "{text}",
        },
    })

    const [activeTab, setActiveTab] = useState("automatic")
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)

    // Add state for sliding panels
    const [activePanel, setActivePanel] = useState<string | null>(null)

    const form = useForm<FormValues>({
        resolver: zodResolver(vectorSetSchema),
        defaultValues: {
            name: "",
            dimensions: 256,
            customElement: "",
            customVector: "",
            quantization: undefined,
            reduceDimensions: undefined,
            defaultCAS: undefined,
            buildExplorationFactor: undefined,
        },
    })

    const generateRandomVector = () => {
        const dimensions = form.getValues("dimensions")
        if (!isNaN(dimensions) && dimensions >= 2) {
            const vector = Array.from({ length: dimensions }, () =>
                Math.random().toFixed(4)
            ).join(", ")
            form.setValue("customVector", vector)
        }
    }

    const handleEditConfig = (config: EmbeddingConfig) => {
        setEmbeddingConfig(config)
    }

    const onSubmit = async (values: FormValues) => {
        try {
            setError(null)
            setIsCreating(true)

            // Additional validation specific to tab
            if (activeTab === "manual") {
                const dim = values.dimensions
                if (!values.customElement?.trim()) {
                    setError("Please enter an element ID")
                    setIsCreating(false)
                    return
                }

                if (!values.customVector?.trim()) {
                    setError("Please enter a vector")
                    setIsCreating(false)
                    return
                }

                // Validate vector dimensions
                const vectorValues = values.customVector
                    .split(",")
                    .map((v) => parseFloat(v.trim()))

                if (vectorValues.some(isNaN)) {
                    setError("Vector must contain valid numbers")
                    setIsCreating(false)
                    return
                }

                if (vectorValues.length !== dim) {
                    setError(`Vector must have exactly ${dim} dimensions`)
                    setIsCreating(false)
                    return
                }

                // validate the vector dimensions matches the vector values
                if (vectorValues.length !== dim) {
                    setError(`Vector must have exactly ${dim} dimensions`)
                    setIsCreating(false)
                    return
                }
            } else {
                // Only validate embedding config in automatic mode
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
            }

            // Build redisConfig object only with defined values
            const redisConfig: Record<string, string | number | boolean> = {}

            // Only add properties that are explicitly set
            if (values.quantization) {
                redisConfig.quantization = values.quantization
            }

            if (values.reduceDimensions) {
                redisConfig.reduceDimensions = parseInt(
                    values.reduceDimensions,
                    10
                )
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

            const metadata =
                activeTab === "automatic"
                    ? {
                          ...createVectorSetMetadata(embeddingConfig),
                          redisConfig:
                              Object.keys(redisConfig).length > 0
                                  ? redisConfig
                                  : undefined,
                      }
                    : {
                          embedding: {
                              provider: "none" as EmbeddingProvider,
                          },
                          created: new Date().toISOString(),
                          redisConfig:
                              Object.keys(redisConfig).length > 0
                                  ? redisConfig
                                  : undefined,
                      }

            // Use manual dimensions in custom mode, or get dimensions from metadata for automatic mode
            const effectiveDimensions =
                activeTab === "manual"
                    ? values.dimensions
                    : metadata.dimensions || 3

            // Pass custom vector data if in custom mode
            const customData =
                activeTab === "manual" &&
                values.customElement &&
                values.customVector
                    ? {
                          element: values.customElement.trim(),
                          vector: values.customVector
                              .split(",")
                              .map((v) => parseFloat(v.trim())),
                      }
                    : undefined

            await onCreate(
                values.name.trim(),
                effectiveDimensions,
                metadata,
                customData
            )
            onClose()
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
            <div className="bg-white rounded-lg p-6 w-[800px] max-h-[90vh] overflow-hidden relative">
                <FormProvider {...form}>
                    {/* Main Form Content */}
                    <div
                        className={`transition-transform duration-300 ${
                            activePanel ? "transform -translate-x-full" : ""
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
                            <form onSubmit={form.handleSubmit(onSubmit)}>
                                <div className="form-body">
                                    <div className="form-section">
                                        <FormField
                                            control={form.control}
                                            name="name"
                                            render={({ field }) => (
                                                <FormItem className="form-item border-none">
                                                    <FormLabel className="form-label text-lg">
                                                        <div>
                                                            Vector Set Name
                                                        </div>
                                                        <FormMessage />
                                                    </FormLabel>
                                                    <FormControl className="form-control">
                                                        <Input
                                                            className="text-right border-none"
                                                            placeholder="my_vector_set"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="form-section">
                                        {/* Vector Embeddings Button */}
                                        <div
                                            className="w-full cursor-pointer"
                                            onClick={() =>
                                                setActivePanel(
                                                    "vectorEmbeddings"
                                                )
                                            }
                                        >
                                            <div className="flex w-full space-x-2 items-center">
                                                <div className="text-lg font-medium">
                                                    Vector Embeddings
                                                </div>
                                                <div className="grow"></div>
                                                <div className="text-right text-gray-500 flex flex-col">
                                                    <div className="font-bold">
                                                        {activeTab ==
                                                        "automatic"
                                                            ? "Automatic"
                                                            : "Manual"}
                                                    </div>
                                                    {activeTab ===
                                                        "automatic" && (
                                                        <div>
                                                            Using{" "}
                                                            {
                                                                embeddingConfig.provider
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
                                            <div className="text-lg font-medium">
                                                Advanced Configuration
                                            </div>
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
                                </div>
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

                    {/* Vector Embeddings Panel */}
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-white p-6 transition-transform duration-300 transform ${
                            activePanel === "vectorEmbeddings"
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
                                Vector Embeddings
                            </h2>
                        </div>

                        <div className="">
                            <Tabs
                                defaultValue="automatic"
                                onValueChange={setActiveTab}
                                value={activeTab}
                            >
                                <TabsList className="grid w-full grid-cols-2 p-1">
                                    <TabsTrigger value="automatic">
                                        Automatic
                                    </TabsTrigger>
                                    <TabsTrigger value="manual">
                                        Manual
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="automatic">
                                    <div>
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                                            Choose your embedding provider, text
                                            and images are supported
                                        </h3>
                                        <div className="border rounded p-4 mb-4">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="font-medium">
                                                        Provider:{" "}
                                                        {
                                                            embeddingConfig.provider
                                                        }
                                                    </p>
                                                    {embeddingConfig.provider ===
                                                        "openai" &&
                                                        embeddingConfig.openai && (
                                                            <p className="text-sm text-gray-600">
                                                                Model:{" "}
                                                                {
                                                                    embeddingConfig
                                                                        .openai
                                                                        .model
                                                                }
                                                            </p>
                                                        )}
                                                    {embeddingConfig.provider ===
                                                        "ollama" &&
                                                        embeddingConfig.ollama && (
                                                            <p className="text-sm text-gray-600">
                                                                Model:{" "}
                                                                {
                                                                    embeddingConfig
                                                                        .ollama
                                                                        .modelName
                                                                }
                                                            </p>
                                                        )}
                                                    {embeddingConfig.provider ===
                                                        "tensorflow" &&
                                                        embeddingConfig.tensorflow && (
                                                            <p className="text-sm text-gray-600">
                                                                Model:{" "}
                                                                {
                                                                    embeddingConfig
                                                                        .tensorflow
                                                                        .model
                                                                }
                                                            </p>
                                                        )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() =>
                                                        setIsEditConfigModalOpen(
                                                            true
                                                        )
                                                    }
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="manual">
                                    <div className="space-y-4 form-body">
                                        <div className="form-section">
                                            <FormField
                                                control={form.control}
                                                name="dimensions"
                                                render={({ field }) => (
                                                    <FormItem className="form-item border-none">
                                                        <div className="form-label">
                                                            <FormLabel className="form-label">
                                                                Dimensions
                                                            </FormLabel>
                                                            <FormMessage />
                                                        </div>
                                                        <FormControl className="form-control">
                                                            <Input
                                                                type="number"
                                                                className="text-right border-none"
                                                                placeholder="1536"
                                                                min="2"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="customElement"
                                                render={({ field }) => (
                                                    <FormItem className="form-item">
                                                        <FormLabel>
                                                            First Element ID
                                                        </FormLabel>
                                                        <FormControl className="form-control">
                                                            <Input
                                                                className="text-right border-none"
                                                                placeholder="element_1"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="customVector"
                                                render={({ field }) => (
                                                    <div>
                                                        <FormItem className="form-item border-none">
                                                            <FormLabel>
                                                                First Vector
                                                            </FormLabel>
                                                            <FormControl className="form-control">
                                                                <Textarea
                                                                    className="text-right border-none"
                                                                    placeholder="0.1234, 0.5678, ..."
                                                                    rows={3}
                                                                    {...field}
                                                                />
                                                            </FormControl>

                                                            <FormMessage />
                                                        </FormItem>
                                                        <div className="flex justify-end">
                                                            <Button
                                                                type="button"
                                                                onClick={
                                                                    generateRandomVector
                                                                }
                                                                variant="link"
                                                                className="flex justify-end h-auto p-0 text-sm text-blue-500 hover:underline"
                                                            >
                                                                Create Random
                                                                Vector
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>

                    {/* Advanced Configuration Panel */}
                    <div
                        className={`absolute top-0 left-0 w-full h-full bg-white p-6 transition-transform duration-300 transform ${
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
                                Advanced Configuration
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="quantization"
                                render={({ field }) => (
                                    <FormItem className="form-item">
                                        <div className="form-label">
                                            <FormLabel>
                                                Vector Quantization
                                            </FormLabel>
                                            <FormDescription>
                                                Controls how vectors are stored
                                                in memory. Cannot be changed
                                                after creation.
                                            </FormDescription>
                                        </div>
                                        <FormControl className="form-control">
                                            <select
                                                className="w-full p-2 "
                                                {...field}
                                            >
                                                <option value="Q8">
                                                    Q8 - Signed 8-bit
                                                    quantization (default,
                                                    smaller vectors)
                                                </option>
                                                <option value="BIN">
                                                    BIN - Binary quantization
                                                </option>
                                                <option value="NOQUANT">
                                                    NOQUANT - No quantization
                                                    (larger vectors)
                                                </option>
                                            </select>
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="reduceDimensions"
                                render={({ field }) => (
                                    <FormItem className="form-item">
                                        <div className="form-label">
                                            <FormLabel>
                                                Dimension Reduction
                                            </FormLabel>
                                            <FormDescription>
                                                Optionally reduce vector
                                                dimensions using random
                                                projection. Cannot be changed
                                                after creation.
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                className="text-right border-none"
                                                placeholder="Leave empty for no reduction"
                                                min="2"
                                                {...field}
                                            />
                                        </FormControl>

                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="defaultCAS"
                                render={({ field }) => (
                                    <FormItem className="form-item">
                                        <div className="form-label grow">
                                            <FormLabel className="">
                                                Multi-threading
                                            </FormLabel>
                                            <FormDescription>
                                                Improves performance with CAS
                                                option (Check and Set)
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    </div>
                </FormProvider>

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
