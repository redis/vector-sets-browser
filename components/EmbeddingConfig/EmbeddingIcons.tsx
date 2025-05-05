import { Code, ImageIcon, MessageSquareText, Mic } from "lucide-react"
import { FC } from "react"
import { EmbeddingDataFormat } from "@/lib/embeddings/types/embeddingModels"

// Icon components for different embedding types
export const TextEmbeddingIcon: FC = () => <MessageSquareText className="h-5 w-5 text-blue-500" />
export const ImageEmbeddingIcon: FC = () => <ImageIcon className="h-5 w-5 text-amber-500" />
export const MultiModalEmbeddingIcon: FC = () => <Code className="h-5 w-5 text-violet-500" />
export const AudioEmbeddingIcon: FC = () => <Mic className="h-5 w-5 text-green-500" />

// Helper function to get the appropriate icon based on data format
export function getEmbeddingIcon(dataFormat: EmbeddingDataFormat): FC {
  switch (dataFormat) {
    case "text":
      return TextEmbeddingIcon
    case "image":
      return ImageEmbeddingIcon
    case "text-and-image":
      return MultiModalEmbeddingIcon
    default:
      return TextEmbeddingIcon
  }
} 