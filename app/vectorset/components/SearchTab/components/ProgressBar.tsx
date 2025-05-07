import React from "react";

interface ProgressBarProps {
    processedCount: number;
    totalItems: number;
    variant?: "default" | "compact";
}

export function ProgressBar({ 
    processedCount, 
    totalItems, 
    variant = "default" 
}: ProgressBarProps) {
    const percentage = (processedCount / totalItems) * 100;
    
    if (variant === "compact") {
        return (
            <div className="absolute top-0 left-0 right-0 p-2 bg-white bg-opacity-95 z-10 border-b">
                <div className="text-sm text-center mb-1">
                    Processing {processedCount} of {totalItems} items...
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                        className="bg-red-600 h-1.5 rounded-full"
                        style={{ width: `${percentage}%` }}
                    ></div>
                </div>
            </div>
        );
    }
    
    return (
        <div className="mt-4 w-full max-w-md">
            <div className="text-sm text-center mb-2">
                Processing {processedCount} of {totalItems} items...
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                    className="bg-red-600 h-2.5 rounded-full"
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
} 