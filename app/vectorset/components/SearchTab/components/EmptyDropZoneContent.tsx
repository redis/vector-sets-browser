import React from "react";
import { UploadCloud } from "lucide-react";

interface EmptyDropZoneContentProps {
    isDragging: boolean;
}

export function EmptyDropZoneContent({ isDragging }: EmptyDropZoneContentProps) {
    if (isDragging) {
        return (
            <div className="flex flex-col items-center transition-all duration-200">
                <div className="relative flex items-center justify-center mb-4">
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
                    <div className="absolute -right-8">
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
                    <div className="absolute -right-20 bg-blue-100 p-3 rounded-full">
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
                <p className="text-lg font-medium text-blue-700">
                    Drop to create vector
                </p>
                <p className="text-sm text-blue-500 mt-1">
                    Files will be encoded into vectors
                </p>
            </div>
        );
    }

    return (
        <>
            <UploadCloud className="h-16 w-16 mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">
                Drag and drop your data here (text or images)
            </p>
        </>
    );
} 