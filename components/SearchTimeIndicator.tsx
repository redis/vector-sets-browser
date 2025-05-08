import React from "react"

interface SearchTimeIndicatorProps {
    searchTime?: number
    isSearching?: boolean
}

/**
 * A component that displays the search time with color coding based on performance:
 * - Green: < 100ms (fast)
 * - Yellow: 100-500ms (moderate)
 * - Red: > 500ms (slow)
 */
const SearchTimeIndicator: React.FC<SearchTimeIndicatorProps> = ({
    searchTime,
    isSearching = false,
}) => {
    if (isSearching) {
        return (
            <span className="flex items-center">
                <svg
                    className="animate-spin mr-2 h-4 w-4 text-customRed-500"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    ></circle>
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                Searching...
            </span>
        )
    }

    if (!searchTime && searchTime !== 0) return null

    // Determine if the time is in milliseconds or seconds
    const isMilliseconds = searchTime < 1

    // Format the time appropriately
    const timeValue = isMilliseconds
        ? (searchTime * 1000).toFixed(1)
        : searchTime.toFixed(2)
    
    const timeUnit = isMilliseconds ? "ms" : "s"

    // Determine color based on performance
    let colorClass = "text-black bg-green-100" // Fast
    if (isMilliseconds) {
        if (searchTime * 1000 > 1000) {
            colorClass = "text-red-500" // Slow
        } else if (searchTime * 1000 > 500) {
            colorClass = "text-yellow-500" // Moderate
        }
    } else {
        if (searchTime > 1) {
            colorClass = "text-red-500" // Slow
        } else if (searchTime > 0.5) {
            colorClass = "text-yellow-500" // Moderate
        }
    }

    let borderColor = "border-green-300"
    if (isMilliseconds) {
        if (searchTime * 1000 > 1000) {
            borderColor = "border-red-500" // Slow
        } else if (searchTime * 1000 > 500) {
            borderColor = "border-yellow-500" // Moderate
        }
    } else {
        if (searchTime > 1) {
            borderColor = "border-red-500" // Slow
        } else if (searchTime > 0.5) {
            borderColor = "border-yellow-500" // Moderate
        }
    }
    return (
        <div
            className={`-ml-1 pr-1 flex space-x-1 items-center rounded-lg text-xs border ${borderColor}`}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-500 ${colorClass} rounded-full`}
            >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
                VSIM Latency: {timeValue} <span className="text-muted-foreground">{timeUnit}</span>
            </div>
        </div>
    )
}

export default SearchTimeIndicator
