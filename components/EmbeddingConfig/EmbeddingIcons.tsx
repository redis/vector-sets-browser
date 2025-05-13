import { EmbeddingDataFormat } from "@/lib/embeddings/types/embeddingModels"
import { Binary, ImageIcon, LetterText, Mic } from "lucide-react"
import { FC } from "react"

// Icon components for different embedding types
export const BinaryEmbeddingIcon: FC = () => (
    <div className="flex items-center gap-0 border border-slate-500 rounded-md p-1">
        <Binary className="h-3 w-3 text-slate-500" />
    </div>
)
export const TextEmbeddingIcon: FC = () => (
    <div className="flex items-center gap-0 border border-slate-500 rounded-md p-1">
        <LetterText className="h-3 w-3 text-slate-500" />
    </div>
)
export const ImageEmbeddingIcon: FC = () => (
    <div className="flex items-center gap-0 border border-slate-500 rounded-md p-1">
        <ImageIcon className="h-3 w-3 text-slate-500" />
    </div>
)
export const MultiModalEmbeddingIcon: FC = () => (
    <div className="flex items-center gap-0 border border-slate-500 rounded-md px-0.5">
        <LetterText className="h-3 w-3 text-slate-500" />
        +
        <ImageIcon className="h-3 w-3 text-slate-500" />
    </div>
)
export const AudioEmbeddingIcon: FC = () => (
    <Mic className="h-5 w-5 text-green-500" />
)

// Helper function to get the appropriate icon based on data format
export function getEmbeddingIcon(dataFormat: EmbeddingDataFormat): FC {
    switch (dataFormat) {
        case "text-and-image":
            return MultiModalEmbeddingIcon
        case "image":
            return ImageEmbeddingIcon
        case "text":
            return TextEmbeddingIcon
        default:
            return BinaryEmbeddingIcon
    }
}
