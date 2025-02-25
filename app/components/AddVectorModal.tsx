"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { VectorSetMetadata } from "../types/embedding"

interface AddVectorModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (elementId: string, elementData: string | number[]) => Promise<void>
    metadata: VectorSetMetadata | null
    dim: number | null
    vectorSetName?: string | null
}

export default function AddVectorModal({
    isOpen,
    onClose,
    onAdd,
    metadata,
    dim,
    vectorSetName = null,
}: AddVectorModalProps) {
    const [elementId, setElementId] = useState("")
    const [elementData, setElementData] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!elementId.trim()) {
            setError("Please enter an element ID")
            return
        }

        if (!elementData.trim()) {
            setError("Please enter element data")
            return
        }

        try {
            setIsAdding(true)
            // Try to parse as raw vector first
            const vectorData = elementData
                .split(",")
                .map((n) => parseFloat(n.trim()))
            if (!vectorData.some(isNaN)) {
                // Valid vector data
                if (dim && vectorData.length !== dim) {
                    setError(`Vector must have ${dim} dimensions`)
                    return
                }
                await onAdd(elementId.trim(), vectorData)
            } else if (metadata?.embedding) {
                // Not a valid vector, but we have an embedding engine - use text data
                await onAdd(elementId.trim(), elementData)
            } else {
                setError(
                    "Please enter valid vector data (comma-separated numbers) or configure an embedding engine"
                )
                return
            }

            setElementId("")
            setElementData("")
            onClose()
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to add vector"
            )
        } finally {
            setIsAdding(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-3xl">
                <h2 className="text-xl font-semibold mb-4">Add Vector</h2>
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 h-full">
                    <div>
                        <div className="text-lg">Element ID</div>
                        <Input
                            id="element-id"
                            value={elementId}
                            onChange={(e) => setElementId(e.target.value)}
                            className="w-full"
                            placeholder="Enter a unique element ID - e.g. 'user_123'"
                        />
                    </div>

                    <div className="flex-1">
                        <div className="text-lg">Data</div>
                        <div className="relative flex-1">
                            <Textarea
                                id="element-data"
                                value={elementData}
                                onChange={(e) => setElementData(e.target.value)}
                                placeholder={
                                    metadata?.embedding
                                        ? "Enter text data or raw vector data (0.1, 0.2, ...)"
                                        : "Enter vector data (0.1, 0.2, ...)"
                                }
                                className="pr-24 min-h-[200px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="absolute right-1 top-2"
                                onClick={() => {
                                    if (dim) {
                                        const randomVector = Array.from(
                                            { length: dim },
                                            () => Math.random()
                                        ).map((n) => n.toFixed(4))
                                        setElementData(randomVector.join(", "))
                                    }
                                }}
                            >
                                Random
                            </Button>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                            {metadata?.embedding
                                ? "Enter text data to be encoded using the embedding engine, or raw vector data as comma-separated numbers"
                                : "Enter vector data as comma-separated numbers"}
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm">
                            {error}
                        </div>
                    )}

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
                            disabled={isAdding}
                        >
                            {isAdding ? "Adding..." : "Add Vector"}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
