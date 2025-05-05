import Image from "next/image"
import { Trash } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ImagePreviewProps {
    src: string
    alt: string
    fileName?: string
    onRemove?: () => void
    className?: string
}

export default function ImagePreview({
    src,
    alt,
    fileName,
    onRemove,
    className = ""
}: ImagePreviewProps) {
    return (
        <div className={`relative h-full w-full overflow-hidden group ${className}`}>
            <Image
                src={src}
                alt={alt}
                fill
                style={{ objectFit: "contain" }}
                className="rounded"
            />
            
            <Button
                className="absolute top-1 right-1"
                variant="ghost"
                size="icon"
                onClick={(e) => {
                    e.stopPropagation()
                    if (onRemove) onRemove()
                }}
                title="Clear image"
            >
                <Trash className="h-3 w-3 text-red-500" />
            </Button>
            
            {fileName && (
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                    {fileName}
                </div>
            )}
        </div>
    )
} 