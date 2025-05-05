import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"

// Define a type for image file info
export interface ImageFileInfo {
    id: string
    fileName: string
    previewUrl: string
    base64Data: string
    embedding?: number[]
}

// Interface for the main ImageUploader component
export interface ImageUploaderProps {
    onImageSelect: (base64Data: string) => void
    onEmbeddingGenerated?: (embedding: number[]) => void
    onFileNameSelect?: (fileName: string) => void
    onImagesChange?: (images: ImageFileInfo[]) => void
    config?: EmbeddingConfig
    className?: string
    allowMultiple?: boolean
} 