import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImagePreviewProps {
    src: string
    alt?: string
    onRemove: () => void
    context?: 'default' | 'embedded'
}

export default function ImagePreview({
    src,
    alt = "Image preview",
    onRemove,
    context = 'default'
}: ImagePreviewProps) {
    // Render a more compact preview for the embedded context
    if (context === 'embedded') {
        return (
            <div className="relative w-full h-full flex justify-center items-center">
                <div className="relative w-full h-full">
                    <img
                        src={src}
                        alt={alt}
                        className="h-full w-full object-contain"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-0 right-0 p-1 rounded-full bg-white/80 h-6 w-6"
                        onClick={onRemove}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        )
    }

    // Default preview
    return (
        <div className="relative w-full h-full flex justify-center items-center">
            <div className="relative max-w-full max-h-64">
                <img
                    src={src}
                    alt={alt}
                    className="max-h-64 object-contain rounded shadow"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 p-1 rounded-full bg-white/80 h-8 w-8"
                    onClick={onRemove}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
} 