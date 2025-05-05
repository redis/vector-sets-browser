import { ImageFileInfo } from "./types"
import ImagePreview from "./ImagePreview"

interface MultipleImagesGridProps {
    images: ImageFileInfo[]
    onRemoveImage: (id: string) => void
    className?: string
}

export default function MultipleImagesGrid({
    images,
    onRemoveImage,
    className = ""
}: MultipleImagesGridProps) {
    if (images.length === 0) {
        return null
    }

    return (
        <div className={`grid grid-cols-3 gap-2 p-2 w-full h-full overflow-y-auto ${className}`}>
            {images.map((img) => (
                <ImagePreview
                    key={img.id}
                    src={img.previewUrl}
                    alt={img.fileName}
                    fileName={img.fileName}
                    onRemove={() => onRemoveImage(img.id)}
                />
            ))}
        </div>
    )
} 