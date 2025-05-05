import SearchTimeIndicator from "@/components/SearchTimeIndicator"

interface NoResultsProps {
    keyName: string
    searchQuery?: string
    searchFilter?: string
    isSearching?: boolean
    isLoading?: boolean
    isLoaded: boolean
    searchType?: "Vector" | "Element" | "Image"
    searchTime?: string
}

export default function NoResults({
    keyName,
    searchQuery,
    searchFilter,
    isSearching,
    isLoading,
    isLoaded,
    searchType,
    searchTime
}: NoResultsProps) {
    if (!isLoaded || isLoading || isSearching) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-gray-500">
                <SearchTimeIndicator
                    isSearching={true}
                    searchTime={searchTime ? parseFloat(searchTime) : undefined}
                />
                <p className="text-sm">
                    {!isLoaded
                        ? "Loading settings..."
                        : isLoading
                        ? "Loading vector set..."
                        : "Searching for vectors..."}
                </p>
            </div>
        )
    }

    // Only show "No results" message if we're not in a loading state
    // and we have a valid vector set name
    if (!keyName) {
        return null // Don't show anything if no vector set is selected
    }
    
    if (searchQuery === "" && !searchFilter) {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-gray-500">
                <p className="">
                    No results to display
                </p>
            </div>
        )
    } else {
        return (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 text-gray-500">
                <p className="">No results to display.</p>
                {searchFilter && (
                    <p className="">
                        Try adjusting your search filter or query.
                    </p>
                )}
            </div>
        )
    }
} 