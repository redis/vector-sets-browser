import { parseFieldFilters } from "@/app/utils/filterParser"
import { FilterField, ParsedAttributes, SortColumn, SortDirection } from "./types"
import { VectorTuple } from "@/app/redis-server/api"

/**
 * Helper function to format attribute values for display
 */
export const formatAttributeValue = (value: any): string => {
    if (Array.isArray(value)) return "[...]"
    if (typeof value === "boolean") return value ? "true" : "false"
    if (value === null || value === undefined) return ""
    return String(value)
}

/**
 * Extract field names and expressions from a filter string
 */
export const extractFilterFields = (filterString?: string): FilterField[] => {
    if (!filterString) return []

    const parsedFilters = parseFieldFilters(filterString)
    
    return parsedFilters.map(filter => ({
        field: filter.field,
        expression: filter.expression
    }))
}

/**
 * Sort vector results based on column and direction
 */
export const sortResults = (
    results: VectorTuple[],
    sortColumn: SortColumn,
    sortDirection: SortDirection
): VectorTuple[] => {
    if (sortColumn === "none") {
        return results
    }

    return [...results].sort((a, b) => {
        if (sortColumn === "element") {
            const comparison = a[0].localeCompare(b[0])
            return sortDirection === "asc" ? comparison : -comparison
        } else {
            // score
            const comparison = a[1] - b[1]
            return sortDirection === "asc" ? comparison : -comparison
        }
    })
}

/**
 * Check if a vectorset is empty (only has default vector)
 */
export const isEmptyVectorSet = (results: VectorTuple[]): boolean => {
    return results.length === 1 && results[0][0] === "Placeholder (Vector)"
} 