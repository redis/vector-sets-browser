import React from "react";

interface DragOverlayProps {
    isDragging: boolean;
    renderCustomOverlay?: (isDragging: boolean) => React.ReactNode;
}

export function DragOverlay({ isDragging, renderCustomOverlay }: DragOverlayProps) {
    if (!isDragging) return null;

    if (renderCustomOverlay) {
        return <>{renderCustomOverlay(isDragging)}</>;
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50 bg-opacity-90 z-10 transition-all duration-200">
            <div className="flex items-center justify-center w-full h-full p-4">
                <div className="relative flex flex-col items-center">
                    <div className="flex items-center justify-center mb-6">
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                            </svg>
                        </div>
                        <div className="mx-4">
                            <svg
                                className="h-6 w-6 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                                />
                            </svg>
                        </div>
                        <div className="bg-blue-100 p-3 rounded-full">
                            <svg
                                className="h-10 w-10 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                                />
                            </svg>
                        </div>
                    </div>
                    <div className="text-xl font-semibold text-blue-700 mb-2">
                        Drop files to create vectors
                    </div>
                    <div className="text-sm text-blue-500">
                        Files will be automatically encoded into vector embeddings
                    </div>
                </div>
            </div>
        </div>
    );
} 