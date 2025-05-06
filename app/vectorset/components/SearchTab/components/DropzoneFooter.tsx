import { UploadCloud } from "lucide-react"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { isTextEmbedding, isImageEmbedding, isMultiModalEmbedding } from "@/lib/embeddings/types/embeddingModels"

interface DropzoneFooterProps {
  isDragging?: boolean
  metadata?: VectorSetMetadata | null
}

export default function DropzoneFooter({ isDragging = false, metadata }: DropzoneFooterProps) {
  // Determine the placeholder text based on embedding type
  const getDropzoneText = () => {
    if (!metadata?.embedding) {
      return "Drag and Drop files here"
    }

    if (isMultiModalEmbedding(metadata.embedding)) {
      return isDragging ? "Drop to add vectors" : "Add Vectors: Drag and Drop images or text files here"
    } else if (isImageEmbedding(metadata.embedding)) {
      return isDragging ? "Drop to add vectors" : "Add Vectors: Drag and Drop images here"
    } else if (isTextEmbedding(metadata.embedding)) {
      return isDragging ? "Drop to add vectors" : "Add Vectors: Drag and Drop text files here"
    }

    return "Drag and Drop files here"
  }

  return (
    <div 
      className={`mt-4 border-1 border-dashed rounded w-full py-2 px-6 my-2 flex items-center justify-center transition-colors duration-200 ${
        isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center space-x-3 text-sm">
        <UploadCloud className={`h-6 w-6 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
        <span className={`${isDragging ? "text-blue-700" : "text-gray-400"}`}>
          {getDropzoneText()}
        </span>
      </div>
    </div>
  )
} 