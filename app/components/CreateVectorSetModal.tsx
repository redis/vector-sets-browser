import { useState } from "react"
import { EmbeddingConfig, VectorSetMetadata, createVectorSetMetadata } from "@/app/types/embedding"
import EmbeddingConfigForm from "./EmbeddingConfigForm"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CreateVectorSetModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (
        name: string,
        dimensions: number,
        metadata: VectorSetMetadata,
        customData?: { elementId: string; vector: number[] }
    ) => Promise<void>
}

export default function CreateVectorSetModal({
    isOpen,
    onClose,
    onCreate,
}: CreateVectorSetModalProps) {
    const [name, setName] = useState("")
    const [dimensions, setDimensions] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [embeddingConfig, setEmbeddingConfig] = useState<EmbeddingConfig>({
        provider: "ollama",
        modelName: "mxbai-embed-large",
        apiUrl: "http://localhost:11434/api/embeddings",
        promptTemplate: "{text}"
    })
    
    const [customElementId, setCustomElementId] = useState("")
    const [customVector, setCustomVector] = useState("")
    const [activeTab, setActiveTab] = useState("automatic")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!name.trim()) {
            setError("Please enter a name for the vector set")
            return
        }

        // Handle dimensions based on the active tab
        if (activeTab === "custom") {
            const dim = parseInt(dimensions, 10)
            if (isNaN(dim) || dim < 2) {
                setError("Please enter a valid dimension (minimum 2)")
                return
            }
            if (!customElementId.trim()) {
                setError("Please enter an element ID")
                return
            }
            if (!customVector.trim()) {
                setError("Please enter a vector")
                return
            }
            // Validate vector dimensions
            const vectorValues = customVector.split(',').map(v => parseFloat(v.trim()))
            if (vectorValues.some(isNaN)) {
                setError("Vector must contain valid numbers")
                return
            }
            if (vectorValues.length !== dim) {
                setError(`Vector must have exactly ${dim} dimensions`)
                return
            }
        } else {
            // Only validate embedding config in automatic mode
            if (embeddingConfig.provider === "openai" && !embeddingConfig.apiKey) {
                setError("Please enter an OpenAI API key")
                return
            }

            if (embeddingConfig.provider === "ollama" && !embeddingConfig.apiUrl) {
                setError("Please enter an Ollama API URL")
                return
            }

            if (!embeddingConfig.modelName) {
                setError("Please select a model")
                return
            }
        }

        try {
            setIsCreating(true)
            const metadata = activeTab === "automatic" ? createVectorSetMetadata(embeddingConfig) : {
                embedding: {
                    provider: "custom" as const,
                    modelName: "custom",
                },
                created: new Date().toISOString()
            }
            // Use manual dimensions in custom mode, 0 for automatic/Ollama mode
            const effectiveDimensions = activeTab === "custom" ? parseInt(dimensions, 10) : 0
            // Pass custom vector data if in custom mode
            const customData = activeTab === "custom" ? {
                elementId: customElementId.trim(),
                vector: customVector.split(',').map(v => parseFloat(v.trim()))
            } : undefined

            console.log("Submitting vector set creation:", {
                name: name.trim(),
                effectiveDimensions,
                metadata,
                customData
            });

            await onCreate(name.trim(), effectiveDimensions, metadata, customData)
            onClose()
        } catch (err) {
            console.error("Error in CreateVectorSetModal handleSubmit:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to create vector set"
            )
        } finally {
            setIsCreating(false)
        }
    }

    const generateRandomVector = () => {
        const dim = parseInt(dimensions, 10)
        if (!isNaN(dim) && dim >= 2) {
            const vector = Array.from({length: dim}, () => Math.random().toFixed(4)).join(", ")
            setCustomVector(vector)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-[600px] max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-semibold mb-4">
                    Create Vector Set
                </h2>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="my_vector_set"
                            />
                        </div>

                        <Tabs defaultValue="automatic" onValueChange={setActiveTab}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="automatic">Automatic</TabsTrigger>
                                <TabsTrigger value="custom">Custom</TabsTrigger>
                            </TabsList>

                            <TabsContent value="automatic">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                                        Embedding Configuration
                                    </h3>
                                    <EmbeddingConfigForm
                                        config={embeddingConfig}
                                        onChange={setEmbeddingConfig}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="custom">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Dimensions
                                        </label>
                                        <input
                                            type="number"
                                            value={dimensions}
                                            onChange={(e) => setDimensions(e.target.value)}
                                            className="w-full p-2 border rounded"
                                            placeholder="1536"
                                            min="2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            First Element ID
                                        </label>
                                        <input
                                            type="text"
                                            value={customElementId}
                                            onChange={(e) => setCustomElementId(e.target.value)}
                                            className="w-full p-2 border rounded"
                                            placeholder="element_1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            First Vector
                                        </label>
                                        <textarea
                                            value={customVector}
                                            onChange={(e) => setCustomVector(e.target.value)}
                                            className="w-full p-2 border rounded"
                                            placeholder="0.1234, 0.5678, ..."
                                            rows={3}
                                        ></textarea>
                                        <button
                                            type="button"
                                            onClick={generateRandomVector}
                                            className="mt-2 text-sm text-blue-500 hover:underline"
                                        >
                                            Randomize Vector
                                        </button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>

                        {error && (
                            <div className="text-red-500 text-sm">{error}</div>
                        )}

                        <div className="flex justify-end gap-2">
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
                                {isCreating ? 'Creating...' : 'Create Vector Set'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
} 