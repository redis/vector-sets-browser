import { Input } from "@/components/ui/input"
import { ChangeEvent, useRef } from "react"
import { X } from "lucide-react"

interface ImageDropZoneProps {
    onFileSelect: (files: File[]) => void
    isLoading: boolean
    isProcessingEmbedding: boolean
    previewUrl: string | null
    allowMultiple: boolean
    isCompact?: boolean
    className?: string
    children?: React.ReactNode
}

export default function ImageDropZone({
    onFileSelect,
    isLoading,
    isProcessingEmbedding,
    previewUrl,
    allowMultiple,
    isCompact = false,
    className = "",
    children
}: ImageDropZoneProps) {
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        
        onFileSelect(Array.from(files))
    }

    const handleButtonClick = () => {
        fileInputRef.current?.click()
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(Array.from(e.dataTransfer.files))
        }
    }

    return (
        <div
            className={`w-full grow border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all duration-300 relative overflow-hidden ${isCompact ? 'h-16 py-1 px-2' : 'h-28 p-2'} ${className}`}
            onClick={handleButtonClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {children}

            {/* Show loading overlay if needed */}
            {(isLoading || isProcessingEmbedding) && (
                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <div className="bg-[white] px-4 py-2 rounded-lg">
                        {isProcessingEmbedding
                            ? "Processing embedding..."
                            : "Processing image..."}
                    </div>
                </div>
            )}
            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={allowMultiple}
                onChange={handleFileChange}
                className="hidden"
            />
        </div>
    )
} 