import { Input } from "@/components/ui/input"
import { ChangeEvent, useRef } from "react"

interface ImageDropZoneProps {
    onFileSelect: (files: File[]) => void
    isLoading: boolean
    isProcessingEmbedding: boolean
    previewUrl: string | null
    allowMultiple: boolean
    isCompact?: boolean
    children: React.ReactNode
    context?: 'search' | 'add' | 'default' | 'embedded'
}

export default function ImageDropZone({
    onFileSelect,
    isLoading,
    isProcessingEmbedding,
    previewUrl,
    allowMultiple,
    isCompact = false,
    children,
    context = 'default'
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

    // Get dynamic styling based on context
    const getDropzoneClasses = () => {
        const baseClasses = "relative flex flex-col items-center justify-center cursor-pointer transition-all"
        
        if (context === 'embedded') {
            return `${baseClasses} h-full w-full p-1 rounded hover:bg-gray-100`
        }
        
        return `${baseClasses} min-h-[200px] rounded p-6 border-2 border-dashed ${
            isCompact ? 'border-gray-200' : 'border-gray-300 hover:bg-gray-50'
        }`
    }

    // Loading or processing state
    if (isLoading || isProcessingEmbedding) {
        return (
            <div className={getDropzoneClasses()}>
                <div className="flex items-center justify-center">
                    <div className="h-5 w-5 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                    <span className="ml-2 text-sm text-gray-500">
                        {isProcessingEmbedding
                            ? "Processing image..."
                            : "Loading..."}
                    </span>
                </div>
            </div>
        )
    }

    return (
        <div
            className={getDropzoneClasses()}
            onClick={handleButtonClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {children}
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