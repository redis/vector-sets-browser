import { VectorTuple } from "@/app/redis-server/api"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import SmartFilterInput from "../SmartFilterInput"

interface FilterSectionProps {
    showFilters: boolean
    setShowFilters: (show: boolean) => void
    localFilter: string
    handleFilterChange: (value: string) => void
    results: VectorTuple[]
    error: string | null
    clearError?: () => void
    vectorSetName: string
}

export default function FilterSection({
    showFilters,
    setShowFilters,
    localFilter,
    handleFilterChange,
    results,
    error,
    clearError,
    vectorSetName,
}: FilterSectionProps) {
    return (
        <div className="flex gap-2 items-start w-full">
            <div className="grow">
                <SmartFilterInput
                    value={localFilter}
                    onChange={handleFilterChange}
                    results={results}
                    placeholder="Enter filter (e.g. .year < 1982)."
                    error={error ? error.includes("syntax error in FILTER") : false}
                    vectorSetName={vectorSetName}
                    clearError={clearError}
                />
            </div>
            
            {/* Display search error */}
            {error && error.includes("syntax error in FILTER") && (
                <div className="text-red-500 text-sm mt-2 w-full">
                    {error}
                </div>
            )}
        </div>
    )
} 