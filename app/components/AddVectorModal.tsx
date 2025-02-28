"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VectorSetMetadata, isImageEmbedding, isTextEmbedding } from "../types/embedding"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ImageUploader from "./ImageUploader"

interface AddVectorModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (element: string, elementData: string | number[]) => Promise<void>
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

    // Determine if we're using an image embedding model using the helper function
    const useImageEmbedding = metadata?.embedding ? isImageEmbedding(metadata.embedding) : false;
    const useTextEmbedding = metadata?.embedding ? isTextEmbedding(metadata.embedding) : true;

    // Set the default active tab based on the embedding data format
    useEffect(() => {
        if (useImageEmbedding) {
            setActiveTab("image");
        } else if (useTextEmbedding) {
            setActiveTab("text");
        }
    }, [useImageEmbedding, useTextEmbedding]);

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
            
            // Use the pre-generated embedding if available for images
            if (activeTab === "image" && imageEmbedding) {
                await onAdd(element, imageEmbedding)
                setStatus("Vector added successfully!")
            } else if (activeTab === "image") {
                await onAdd(element, imageData)
                setStatus("Vector added successfully!")
            } else {
                await onAdd(element, elementData)
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
            setError(err instanceof Error ? err.message : "Failed to add vector")
            setStatus("Error adding vector")
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
                            <label htmlFor="element" className="block text-sm font-medium mb-1">
                                Element ID
                            </label>
                            <Input
                                id="element"
                                value={element}
                                onChange={(e) => setElement(e.target.value)}
                                placeholder="Enter a unique identifier for this vector"
                            />
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                            <TabsList className="mb-2">
                                <TabsTrigger value="text" disabled={!useTextEmbedding}>Text</TabsTrigger>
                                <TabsTrigger value="image" disabled={!useImageEmbedding && useTextEmbedding}>Image</TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="text">
                                <div>
                                    <label htmlFor="elementData" className="block text-sm font-medium mb-1">
                                        Text Content
                                    </label>
                                    <Textarea
                                        id="elementData"
                                        value={elementData}
                                        onChange={(e) => setElementData(e.target.value)}
                                        placeholder="Enter the text to embed"
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
                                        onEmbeddingGenerated={handleEmbeddingGenerated}
                                        config={metadata?.embedding?.image || { model: 'mobilenet' }}
                                    />
                                    {imageEmbedding && (
                                        <div className="mt-2 text-sm text-green-600">
                                            ✓ Embedding generated ({imageEmbedding.length} dimensions)
                                        </div>
                                    )}
                                </div>
                            </TabsContent>
                        </Tabs>

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
