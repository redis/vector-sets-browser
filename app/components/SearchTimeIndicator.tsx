import React from 'react';

interface SearchTimeIndicatorProps {
    searchTime: number | undefined;
}

/**
 * A component that displays the search time with color coding based on performance:
 * - Green: < 100ms (fast)
 * - Yellow: 100-500ms (moderate)
 * - Red: > 500ms (slow)
 */
export default function SearchTimeIndicator({ searchTime }: SearchTimeIndicatorProps) {
    if (!searchTime && searchTime !== 0) {
        return null;
    }

    // Determine the background color based on the search time
    const getColorClass = () => {
        if (searchTime < 200) {
            return "text-green-600 bg-transparent";
        } else if (searchTime < 500) {
            return "bg-yellow-500 text-black";
        } else {
            return "bg-red-200 text-black";
        }
    };

    return (
        <span className={`text-sm rounded-lg p-1 ${getColorClass()}`}>
            ⚡ {searchTime}ms
        </span>
    );
} 