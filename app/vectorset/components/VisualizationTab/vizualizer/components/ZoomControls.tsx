import React from "react"
import { ZoomIn, ZoomOut } from "lucide-react"

interface ZoomControlsProps {
    onZoomIn: () => void
    onZoomOut: () => void
}

export function ZoomControls({ onZoomIn, onZoomOut }: ZoomControlsProps) {
    return (
        <div className="absolute bottom-4 right-4 flex flex-col items-center bg-black/20 backdrop-blur-xs rounded-lg p-2 z-10">
            <button
                onClick={onZoomIn}
                className="p-1 hover:bg-black/30 rounded-md mb-1"
                aria-label="Zoom in"
            >
                <ZoomIn className="w-5 h-5 text-white" />
            </button>
            <button
                onClick={onZoomOut}
                className="p-1 hover:bg-black/30 rounded-md"
                aria-label="Zoom out"
            >
                <ZoomOut className="w-5 h-5 text-white" />
            </button>
        </div>
    )
} 