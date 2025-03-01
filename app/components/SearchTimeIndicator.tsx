import React from 'react';

interface SearchTimeIndicatorProps {
    searchTime?: number;
    isSearching?: boolean;
}

/**
 * A component that displays the search time with color coding based on performance:
 * - Green: < 100ms (fast)
 * - Yellow: 100-500ms (moderate)
 * - Red: > 500ms (slow)
 */
const SearchTimeIndicator: React.FC<SearchTimeIndicatorProps> = ({ 
    searchTime, 
    isSearching = false 
}) => {
    if (isSearching) {
        return (
            <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Searching...
            </span>
        );
    }

    if (!searchTime) return null;

    const formattedTime = searchTime < 1 
        ? `${(searchTime * 1000).toFixed(2)} ms` 
        : `${searchTime.toFixed(2)}ms`;

    return <span className="text-sm text-gray-500">{formattedTime}</span>;
};

export default SearchTimeIndicator; 