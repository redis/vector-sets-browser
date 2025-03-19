"use client"

import {
    VectorSetMetadata,
    isImageEmbedding,
    isTextEmbedding,
} from "@/app/embeddings/types/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Copy } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import ImageUploader from "../components/ImageUploader"

interface AddVectorModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (
        element: string,
        elementData: string | number[],
        useCAS?: boolean
    ) => Promise<void>
    metadata: VectorSetMetadata | null
    dim: number | null
    vectorSetName?: string | null
}

export default function AddVectorModal({
    isOpen,
    onClose,
    onAdd,
    metadata,
    vectorSetName = null,
}: AddVectorModalProps) {
    const [element, setElement] = useState("")
    const [elementData, setElementData] = useState("")
    const [imageData, setImageData] = useState("")
    const [imageEmbedding, setImageEmbedding] = useState<number[] | null>(null)
    const [activeTab, setActiveTab] = useState<string>("text")
    const [error, setError] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [status, setStatus] = useState("")
    const [useCAS, setUseCAS] = useState(false)

    // Determine if we're using an image embedding model using the helper function
    const useImageEmbedding = metadata?.embedding
        ? isImageEmbedding(metadata.embedding)
        : false
    const useTextEmbedding = metadata?.embedding
        ? isTextEmbedding(metadata.embedding)
        : true
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    const reduceDimensions = metadata?.redisConfig?.reduceDimensions
        ? metadata?.redisConfig?.reduceDimensions
        : undefined

    // Set the default active tab based on the embedding data format
    useEffect(() => {
        if (useImageEmbedding) {
            setActiveTab("image")
        } else if (useTextEmbedding) {
            setActiveTab("text")
        }
    }, [useImageEmbedding, useTextEmbedding])

    // Compute the placeholder text based on current searchType
    const embeddingPlaceholder = useMemo(() => {
        if (!supportsEmbeddings) {
            return "Enter vector data (0.1, 0.2, ...)"
        } else {
            return "Enter Text to embed or Enter vector data (0.1, 0.2, ...)"
        }
    }, [supportsEmbeddings])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!element.trim()) {
            setError("Please enter an element ID")
            return
        }

        if (activeTab === "text" && !elementData.trim()) {
            setError("Please enter element data")
            return
        }

        if (activeTab === "image" && !imageData) {
            setError("Please upload an image")
            return
        }

        try {
            setIsAdding(true)
            setStatus("Adding vector...")
            setError(null)

            // Use the pre-generated embedding if available for images
            if (activeTab === "image" && imageEmbedding) {
                await onAdd(element, imageEmbedding, useCAS)
                setStatus("Vector added successfully!")
            } else if (activeTab === "image") {
                await onAdd(element, imageData, useCAS)
                setStatus("Vector added successfully!")
            } else {
                await onAdd(element, elementData, useCAS)
                setStatus("Vector added successfully!")
            }

            // Reset form
            setElement("")
            setElementData("")
            setImageData("")
            setImageEmbedding(null)

            // Close modal
            onClose()
        } catch (err) {
            console.error("Error adding vector:", err)

            // Extract the most informative error message
            let errorMessage = "Failed to add vector"
            if (err instanceof Error) {
                errorMessage = err.message
            } else if (typeof err === "object" && err !== null) {
                // Try to extract error message from various possible formats
                if ("message" in err && typeof err.message === "string") {
                    errorMessage = err.message
                } else if ("error" in err && typeof err.error === "string") {
                    errorMessage = err.error
                } else if (
                    "data" in err &&
                    typeof err.data === "object" &&
                    err.data &&
                    "error" in err.data &&
                    typeof err.data.error === "string"
                ) {
                    errorMessage = err.data.error
                }
            }

            setError(errorMessage)
            setStatus("Error adding vector")
            // Keep the modal open so the user can see the error
        } finally {
            setIsAdding(false)
        }
    }

    const handleImageSelect = (base64Data: string) => {
        setImageData(base64Data)
        // Reset embedding when a new image is selected
        setImageEmbedding(null)
    }

    const handleEmbeddingGenerated = (embedding: number[]) => {
        setImageEmbedding(embedding)
        setStatus(`Embedding generated: ${embedding.length} dimensions`)
    }

    // Function to generate the VADD command preview
    const getVaddCommand = () => {
        if (
            !element ||
            (!elementData && activeTab === "text") ||
            (!imageData && activeTab === "image")
        ) {
            return `VADD ${vectorSetName || "vector-set"} ${
                reduceDimensions ? `REDUCE ${reduceDimensions}` : ""
            } VALUES [vector values...] ${element || "element_id"} ${
                useCAS ? "CAS" : ""
            }`
        }

        let command = `VADD ${vectorSetName || "vector-set"} ${
            reduceDimensions ? `REDUCE ${reduceDimensions}` : ""
        }`

        // Add VALUES part
        if (activeTab === "text") {
            // For text, try to determine if it's raw vector data or text to embed
            const isRawVector =
                elementData.includes(",") &&
                elementData
                    .split(",")
                    .every((v) => !isNaN(parseFloat(v.trim())))

            if (isRawVector) {
                // Format as vector values
                const vectorValues = elementData
                    .split(",")
                    .map((v) => parseFloat(v.trim()))
                    .filter((v) => !isNaN(v))

                // Only include dimensions if we have them
                if (vectorValues.length > 0) {
                    command += ` VALUES ${
                        vectorValues.length
                    } ${vectorValues.join(" ")}`
                } else {
                    command += ` VALUES [vector values...]`
                }
            } else {
                // It's text to be embedded
                command += ` VALUES [text to be embedded: "${elementData.substring(
                    0,
                    30
                )}${elementData.length > 30 ? "..." : ""}"]`
            }
        } else if (activeTab === "image") {
            if (imageEmbedding) {
                // Show with actual embedding dimensions
                command += ` VALUES ${imageEmbedding.length} [image embedding values...]`
            } else {
                // Show placeholder for image data without dimensions
                command += ` VALUES [image data will be embedded]`
            }
        }

        // Add element ID
        command += ` "${element}"`

        // Add CAS flag if enabled
        if (useCAS) {
            command += " CAS"
        }

        return command
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-4">
                        Add Vector to {vectorSetName || "Vector Set"}
                    </h2>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label
                                htmlFor="element"
                                className="block text-sm font-medium mb-1"
                            >
                                Element ID
                            </label>
                            <Input
                                id="element"
                                value={element}
                                onChange={(e) => setElement(e.target.value)}
                                placeholder="Enter a unique identifier for this vector"
                            />
                        </div>

                        <Tabs
                            value={activeTab}
                            onValueChange={setActiveTab}
                            className="mb-4"
                        >
                            <TabsList className="mb-2 w-full">
                                <TabsTrigger
                                    value="text"
                                    disabled={!useTextEmbedding}
                                    className="w-full"
                                >
                                    Text
                                </TabsTrigger>
                                <TabsTrigger
                                    value="image"
                                    disabled={
                                        !useImageEmbedding && useTextEmbedding
                                    }
                                    className="w-full"
                                >
                                    Image
                                </TabsTrigger>
                                <TabsTrigger
                                    value="image"
                                    disabled={
                                        !useImageEmbedding && useTextEmbedding
                                    }
                                    className="w-full"
                                >
                                    Audio
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="text">
                                <div>
                                    <label
                                        htmlFor="elementData"
                                        className="block text-sm font-medium mb-1"
                                    >
                                        Data
                                    </label>
                                    <Textarea
                                        id="elementData"
                                        value={elementData}
                                        onChange={(e) =>
                                            setElementData(e.target.value)
                                        }
                                        placeholder={embeddingPlaceholder}
                                        rows={5}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="image">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Image Upload
                                    </label>
                                    <ImageUploader
                                        onImageSelect={handleImageSelect}
                                        onEmbeddingGenerated={
                                            handleEmbeddingGenerated
                                        }
                                        config={
                                            metadata?.embedding?.image || {
                                                model: "mobilenet",
                                            }
                                        }
                                    />
                                    {imageEmbedding && (
                                        <div className="mt-2 text-sm text-green-600">
                                            ✓ Embedding generated (
                                            {imageEmbedding.length} dimensions)
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>
                        <div className="mb-4 flex items-center space-x-2">
                            <Label
                                htmlFor="cas-toggle"
                                className="cursor-pointer flex flex-col gap-1"
                            >
                                <div>Use Multi-threaded insert</div>
                                <div className="text-xs text-gray-500">
                                    Sets the CAS flag (Check and Set) which uses
                                    multi-threading when adding to the
                                    vectorset, improving performance.
                                </div>
                            </Label>
                            <Switch
                                id="cas-toggle"
                                checked={useCAS}
                                onCheckedChange={setUseCAS}
                            />
                        </div>

                        {error && (
                            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                                {error}
                            </div>
                        )}

                        {status && !error && (
                            <div className="mb-4 p-2 bg-blue-100 border border-blue-400 text-blue-700 rounded">
                                {status}
                            </div>
                        )}

                        {/* Command Preview Box */}
                        <div className="flex gap-2 items-center w-full bg-gray-100 rounded-md mb-4">
                            <div className="text-grey-400 p-2 font-mono overflow-x-scroll text-sm grow">
                                {getVaddCommand()}
                            </div>
                            <div className="grow"></div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-gray-500"
                                onClick={() => {
                                    const command = getVaddCommand()
                                    navigator.clipboard.writeText(command)
                                }}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isAdding}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isAdding}>
                                {isAdding ? "Adding..." : "Add Vector"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
