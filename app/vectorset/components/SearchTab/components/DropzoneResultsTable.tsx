import React from "react"
import { CompactResultsTableProps } from "./CompactResultsTable"
import CompactResultsTable from "./CompactResultsTable"
import DropZone from "./DropZone"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { UploadCloud } from "lucide-react"
import DropzoneFooter from "./DropzoneFooter"
import { useState } from "react"
import {
    isTextEmbedding,
    isImageEmbedding,
    isMultiModalEmbedding,
} from "@/lib/embeddings/types/embeddingModels"
import { toast } from "sonner"

interface DropzoneResultsTableProps extends CompactResultsTableProps {
    handleAddVector: (element: string, embedding: number[]) => Promise<void>
    vectorSetName: string
    metadata?: VectorSetMetadata | null
}

const DropzoneResultsTable = React.memo(function DropzoneResultsTable({
    handleAddVector,
    vectorSetName,
    metadata,
    ...compactResultsTableProps
}: DropzoneResultsTableProps) {
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    // Get the appropriate drop message based on embedding type
    const getDropMessage = () => {
        if (!metadata?.embedding) {
            return "Files will be encoded into vectors"
        }

        if (isMultiModalEmbedding(metadata.embedding)) {
            return "Images and text files will be encoded into vectors"
        } else if (isImageEmbedding(metadata.embedding)) {
            return "Images will be encoded into vectors"
        } else if (isTextEmbedding(metadata.embedding)) {
            return "Text files will be encoded into vectors"
        }

        return "Files will be encoded into vectors"
    }

    // Create a custom overlay that fits within the table container
    const customDropOverlay = () => (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-90 z-10 transition-all duration-200 flex items-center justify-center border-2 border-dashed border-blue-500 rounded-lg">
            <div className="flex flex-col items-center px-4 py-6 text-center">
                <UploadCloud className="h-16 w-16 mb-4 text-blue-500" />
                <div className="text-lg font-semibold text-blue-700 mb-1">
                    Drop files to add vectors
                </div>
                <div className="text-sm text-blue-500">{getDropMessage()}</div>
            </div>
        </div>
    )

    // Custom wrapper for the onAddVector callback that also resets the isDragging state
    const handleAddVectorWrapper = async (
        element: string,
        embedding: number[]
    ) => {
        try {
            setIsProcessing(true)
            await handleAddVector(element, embedding)
        } catch (error) {
            console.error("Error adding vector:", error)
            toast.error(
                error instanceof Error ? error.message : "An unknown error occurred"
            )
        } finally {
            // Make sure isDragging is reset regardless of success or failure
            setIsDragging(false)
            setIsProcessing(false)
        }
    }

    return (
        <DropZone
            onAddVector={handleAddVectorWrapper}
            metadata={metadata}
            className="w-full"
            renderDropOverlay={customDropOverlay}
            onDragStateChange={setIsDragging}
            data-dropzone-id="results-table-dropzone"
        >
            <div className="flex flex-col">
                <CompactResultsTable {...compactResultsTableProps} metadata={metadata} />
                <DropzoneFooter 
                    isDragging={isDragging} 
                    isProcessing={isProcessing} 
                    metadata={metadata} 
                />
            </div>
        </DropZone>
    )
})

export default DropzoneResultsTable
