import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useState, useMemo, useEffect } from "react"
import {
    ArrowDownUp,
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    Settings,
    X,
} from "lucide-react"
import EditAttributesDialog from "./EditAttributesDialog"
import { VectorTuple } from "../api/types"
import { redisCommands } from "@/app/api/redis-commands"
import SearchTimeIndicator from "./SearchTimeIndicator"
import { useVectorResultsSettings } from "@/app/hooks/useVectorResultsSettings"
import { parseFieldFilters } from "@/app/utils/filterParser"

interface VectorResultsProps {
    results: VectorTuple[]
    onRowClick: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    searchTime?: string
    keyName: string
    searchFilter?: string
    searchQuery?: string
    onClearFilter?: () => void
    onAddVector?: () => void
    isSearching?: boolean
}

type SortColumn = "element" | "score" | "none"
type SortDirection = "asc" | "desc"

type AttributeCache = {
    [key: string]: string | null
}

type AttributeValue = string | number | boolean | any[]
type ParsedAttributes = Record<string, AttributeValue>

interface ColumnConfig {
    name: string
    visible: boolean
    type: "system" | "attribute" // system columns are Element and Score
}

// Add this new type and function after the existing type definitions
type FieldFilter = {
    field: string
    expression: string
}

export default function VectorResults({
    results,
    onRowClick,
    onDeleteClick,
    onShowVectorClick,
    keyName,
    searchFilter,
    searchQuery,
    onClearFilter,
    onAddVector,
    isSearching,
    searchTime,
}: VectorResultsProps) {
    const [isCompact, setIsCompact] = useState(true)
    const {
        showAttributes,
        setShowAttributes,
        showOnlyFilteredAttributes,
        setShowOnlyFilteredAttributes,
    } = useVectorResultsSettings()
    const [filterText, setFilterText] = useState("")
    const [sortColumn, setSortColumn] = useState<SortColumn>("none")
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
    const [editingAttributes, setEditingAttributes] = useState<string | null>(
        null
    )
    const [attributeCache, setAttributeCache] = useState<AttributeCache>({})
    const [isLoadingAttributes, setIsLoadingAttributes] = useState(false)
    const [filteredFieldValues, setFilteredFieldValues] = useState<
        Record<string, Record<string, string>>
    >({})
    const [parsedAttributeCache, setParsedAttributeCache] = useState<
        Record<string, ParsedAttributes>
    >({})
    const [availableColumns, setAvailableColumns] = useState<ColumnConfig[]>([
        { name: "element", visible: true, type: "system" },
        { name: "score", visible: true, type: "system" },
    ])

    // Fetch attributes when showAttributes is enabled
    useEffect(() => {
        if (!showAttributes) {
            return
        }

        const fetchAttributes = async () => {
            setIsLoadingAttributes(true)
            const newCache: AttributeCache = { ...attributeCache }
            let hasChanges = false

            for (const row of results) {
                const element = row[0]
                if (attributeCache[element] === undefined) {
                    try {
                        const attributes = await redisCommands.vgetattr(
                            keyName,
                            element
                        )
                        newCache[element] = attributes
                        hasChanges = true
                    } catch (error) {
                        console.error(
                            `Error fetching attributes for ${element}:`,
                            error
                        )
                        newCache[element] = null
                        hasChanges = true
                    }
                }
            }

            if (hasChanges) {
                setAttributeCache(newCache)
            }
            setIsLoadingAttributes(false)
        }

        fetchAttributes()
    }, [showAttributes, results, keyName])

    // Extract field names from searchFilter
    const filteredFields = useMemo(() => {
        if (!searchFilter) return []

        // Match all field names in the filter expression
        // Looking for patterns like .fieldname in the filter
        const fieldMatches =
            searchFilter.match(/\.[a-zA-Z_][a-zA-Z0-9_]*/g) || []

        // Remove the dot and deduplicate
        return Array.from(
            new Set(fieldMatches.map((field) => field.substring(1)))
        )
    }, [searchFilter])

    // Unified effect to handle attribute parsing and column management
    useEffect(() => {
        if (!showAttributes) {
            // Remove all attribute columns when showAttributes is off
            setAvailableColumns((prev) =>
                prev.filter((col) => col.type === "system")
            )
            return
        }

        // First parse all attributes
        const newParsedCache: Record<string, ParsedAttributes> = {}
        const allAttributeColumns = new Set<string>()

        // Collect all attribute names and parse values
        Object.entries(attributeCache).forEach(([element, attrStr]) => {
            if (!attrStr) return

            try {
                const parsed = JSON.parse(attrStr)
                newParsedCache[element] = parsed
                Object.keys(parsed).forEach((key) =>
                    allAttributeColumns.add(key)
                )
            } catch (error) {
                console.error(`Error parsing attributes for ${element}:`, error)
            }
        })

        setParsedAttributeCache(newParsedCache)

        // Then determine which columns should be visible
        const systemColumns = [
            { name: "element", visible: true, type: "system" as const },
            { name: "score", visible: true, type: "system" as const },
        ]

        let attributeColumns: ColumnConfig[] = []

        if (showOnlyFilteredAttributes && searchFilter) {
            // Only include columns that are referenced in the search filter
            attributeColumns = Array.from(allAttributeColumns)
                .filter((name) => filteredFields.includes(name))
                .map((name) => ({
                    name,
                    visible: true,
                    type: "attribute" as const,
                }))
        } else {
            // Include all attribute columns
            attributeColumns = Array.from(allAttributeColumns).map((name) => ({
                name,
                visible: true,
                type: "attribute" as const,
            }))
        }

        setAvailableColumns([...systemColumns, ...attributeColumns])
    }, [
        showAttributes,
        attributeCache,
        showOnlyFilteredAttributes,
        searchFilter,
        filteredFields,
    ])

    // Fetch field values when filtered fields change
    useEffect(() => {
        if (
            !showAttributes ||
            !showOnlyFilteredAttributes ||
            filteredFields.length === 0
        ) {
            return
        }

        const fetchFieldValues = async () => {
            const newValues: Record<string, Record<string, string>> = {}

            for (const row of results) {
                const element = row[0]
                if (!newValues[element]) {
                    try {
                        const attributes = await redisCommands.vgetattr(
                            keyName,
                            element
                        )
                        if (attributes) {
                            try {
                                const parsed = JSON.parse(attributes)
                                newValues[element] = {}
                                for (const field of filteredFields) {
                                    newValues[element][field] =
                                        parsed[field]?.toString() || ""
                                }
                            } catch (e) {
                                console.error(
                                    `Error parsing attributes for ${element}:`,
                                    e
                                )
                            }
                        }
                    } catch (error) {
                        console.error(
                            `Error fetching attributes for ${element}:`,
                            error
                        )
                    }
                }
            }

            setFilteredFieldValues(newValues)
        }

        fetchFieldValues()
    }, [
        showAttributes,
        showOnlyFilteredAttributes,
        filteredFields,
        results,
        keyName,
    ])

    // Update the effect that handles attribute editing
    useEffect(() => {
        if (!editingAttributes || !showAttributes) {
            return
        }

        // When dialog closes, refresh the attributes for the edited element
        const fetchUpdatedAttribute = async () => {
            try {
                const attributes = await redisCommands.vgetattr(
                    keyName,
                    editingAttributes
                )

                // Update the attribute cache
                setAttributeCache((prev) => ({
                    ...prev,
                    [editingAttributes]: attributes,
                }))

                // Parse the new attributes to update parsed cache and columns
                if (attributes) {
                    try {
                        const parsed = JSON.parse(attributes)

                        // Update parsed cache
                        setParsedAttributeCache((prev) => ({
                            ...prev,
                            [editingAttributes]: parsed,
                        }))

                        // Update available columns with any new attributes
                        const newColumns = new Set(Object.keys(parsed))
                        setAvailableColumns((prev) => {
                            const existingColumns = new Set(
                                prev.map((c) => c.name)
                            )
                            const updatedColumns = [...prev]

                            newColumns.forEach((colName) => {
                                if (!existingColumns.has(colName)) {
                                    updatedColumns.push({
                                        name: colName,
                                        visible: true,
                                        type: "attribute",
                                    })
                                }
                            })

                            return updatedColumns
                        })
                    } catch (e) {
                        console.error(
                            `Error parsing updated attributes for ${editingAttributes}:`,
                            e
                        )
                    }
                }
            } catch (error) {
                console.error(
                    `Error fetching updated attributes for ${editingAttributes}:`,
                    error
                )
            }
        }

        if (editingAttributes in attributeCache) {
            fetchUpdatedAttribute()
        }
    }, [editingAttributes, keyName, showAttributes, attributeCache])

    // Add this helper function
    const formatAttributeValue = (value: AttributeValue): string => {
        if (Array.isArray(value)) return "[...]"
        if (typeof value === "boolean") return value ? "true" : "false"
        if (value === null || value === undefined) return ""
        return String(value)
    }

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            // Cycle through: asc -> desc -> none
            if (sortDirection === "asc") {
                setSortDirection("desc")
            } else if (sortDirection === "desc") {
                // Reset to no sorting
                setSortColumn("none")
            }
        } else {
            // Set new column and default to ascending
            setSortColumn(column)
            setSortDirection("asc")
        }
    }

    const filteredAndSortedResults = useMemo(() => {
        // First filter
        let processed = results
        if (filterText.trim()) {
            const lowerFilter = filterText.toLowerCase()
            processed = results.filter((row) =>
                row[0].toLowerCase().includes(lowerFilter)
            )
        }

        // Then sort, but only if a sort column is selected
        if (sortColumn === "none") {
            return processed // Return filtered results without sorting
        }

        return [...processed].sort((a, b) => {
            if (sortColumn === "element") {
                const comparison = a[0].localeCompare(b[0])
                return sortDirection === "asc" ? comparison : -comparison
            } else {
                // score
                const comparison = a[1] - b[1]
                return sortDirection === "asc" ? comparison : -comparison
            }
        })
    }, [results, filterText, sortColumn, sortDirection])

    const handleSearchSimilar = (element: string) => {
        console.log("[VectorResults] handleSearchSimilar", element)

        // Use a combined callback that updates both values at once
        // This might help ensure the UI updates properly
        onRowClick(element)
    }

    if (results.length === 0) {
        return <p>No results to display.</p>
    }

    // Sort indicator icons
    const SortIcon = ({ column }: { column: SortColumn }) => {
        // If this column is not the active sort column or sorting is off
        if (sortColumn !== column || sortColumn === "none") {
            return <ArrowDownUp className="w-4 h-4 ml-1 text-gray-500" />
        }

        // Active sort column
        if (sortDirection === "asc") {
            return (
                <ArrowUpNarrowWide
                    className="w-4 h-4 ml-1 text-black"
                    strokeWidth={2.5}
                />
            )
        } else {
            return (
                <ArrowDownWideNarrow
                    className="w-4 h-4 ml-1 text-black"
                    strokeWidth={2.5}
                />
            )
        }
    }

    return (
        <div className="space-y-4 mb-8">
            <EditAttributesDialog
                isOpen={!!editingAttributes}
                onClose={() => setEditingAttributes(null)}
                keyName={keyName}
                element={editingAttributes || ""}
            />

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {results.length > 0 && (
                        <>
                            <span className="flex text-gray-500 text-sm items-center space-x-2 whitespace-nowrap">
                                {searchQuery ? (
                                    <div className="flex items-center space-x-2">
                                        <span>Results for "{searchQuery}"</span>
                                        {searchFilter && onClearFilter && (
                                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                                <span>Filtered results</span>
                                                <button
                                                    onClick={onClearFilter}
                                                    className="hover:bg-red-200 rounded-full p-0.5 ml-1"
                                                    aria-label="Clear filter"
                                                >
                                                    <svg
                                                        className="w-3 h-3"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M6 18L18 6M6 6l12 12"
                                                        />
                                                    </svg>
                                                </button>
                                            </span>
                                        )}
                                    </div>
                                ) : searchFilter && onClearFilter ? (
                                    <div className="flex items-center space-x-2">
                                        <span>Results</span>
                                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                            <span>Filtered results</span>
                                            <button
                                                onClick={onClearFilter}
                                                className="hover:bg-red-200 rounded-full p-0.5 ml-1"
                                                aria-label="Clear filter"
                                            >
                                                <svg
                                                    className="w-3 h-3"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M6 18L18 6M6 6l12 12"
                                                    />
                                                </svg>
                                            </button>
                                        </span>
                                    </div>
                                ) : null}
                                <div>
                                    {(searchTime || isSearching) && (
                                        <SearchTimeIndicator
                                            searchTime={
                                                searchTime
                                                    ? Number(searchTime)
                                                    : undefined
                                            }
                                            isSearching={isSearching}
                                        />
                                    )}
                                </div>
                            </span>
                        </>
                    )}
                </div>
                <div className="flex items-center space-x-2">
                    {onAddVector && (
                        <Button variant="default" onClick={onAddVector}>
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                />
                            </svg>
                            Add Vector
                        </Button>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem
                                checked={isCompact}
                                onCheckedChange={setIsCompact}
                            >
                                Compact View
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={showAttributes}
                                onCheckedChange={setShowAttributes}
                            >
                                Show Attributes
                            </DropdownMenuCheckboxItem>
                            {showAttributes && (
                                <DropdownMenuCheckboxItem
                                    checked={showOnlyFilteredAttributes}
                                    onCheckedChange={
                                        setShowOnlyFilteredAttributes
                                    }
                                    disabled={!showAttributes}
                                >
                                    Show Only Filtered Attributes
                                </DropdownMenuCheckboxItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Columns</DropdownMenuLabel>
                            {/* System Columns */}
                            <DropdownMenuLabel className="text-xs text-gray-500 pl-2">
                                System
                            </DropdownMenuLabel>
                            {availableColumns
                                .filter((col) => col.type === "system")
                                .map((col) => (
                                    <DropdownMenuCheckboxItem
                                        key={col.name}
                                        checked={col.visible}
                                        onCheckedChange={(checked) => {
                                            setAvailableColumns((prev) =>
                                                prev.map((c) =>
                                                    c.name === col.name
                                                        ? {
                                                              ...c,
                                                              visible: checked,
                                                          }
                                                        : c
                                                )
                                            )
                                        }}
                                    >
                                        {col.name.charAt(0).toUpperCase() +
                                            col.name.slice(1)}
                                    </DropdownMenuCheckboxItem>
                                ))}

                            {/* Attribute Columns */}
                            {availableColumns.some(
                                (col) => col.type === "attribute"
                            ) && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs text-gray-500 pl-2">
                                        Attributes
                                    </DropdownMenuLabel>
                                    {availableColumns
                                        .filter(
                                            (col) => col.type === "attribute"
                                        )
                                        .map((col) => (
                                            <DropdownMenuCheckboxItem
                                                key={col.name}
                                                checked={col.visible}
                                                onCheckedChange={(checked) => {
                                                    setAvailableColumns(
                                                        (prev) =>
                                                            prev.map((c) =>
                                                                c.name ===
                                                                col.name
                                                                    ? {
                                                                          ...c,
                                                                          visible:
                                                                              checked,
                                                                      }
                                                                    : c
                                                            )
                                                    )
                                                }}
                                            >
                                                {col.name
                                                    .charAt(0)
                                                    .toUpperCase() +
                                                    col.name.slice(1)}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {isCompact ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            {availableColumns
                                .filter((col) => col.visible)
                                .map((col) => {
                                    const filter = parseFieldFilters(
                                        searchFilter
                                    ).find((f) => f.field === col.name)

                                    return (
                                        <TableHead
                                            key={col.name}
                                            className={`relative ${
                                                col.type === "system"
                                                    ? "cursor-pointer hover:bg-gray-50"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                col.type === "system"
                                                    ? handleSort(
                                                          col.name as SortColumn
                                                      )
                                                    : undefined
                                            }
                                        >
                                            {filter && (
                                                <div className="absolute -top-px left-0 right-0 h-0.5 bg-red-500" />
                                            )}
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    {filter && (
                                                        <div className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                                                    )}
                                                    <span className="font-medium">
                                                        {col.name
                                                            .charAt(0)
                                                            .toUpperCase() +
                                                            col.name.slice(1)}
                                                    </span>
                                                    {col.type === "system" && (
                                                        <SortIcon
                                                            column={
                                                                col.name as SortColumn
                                                            }
                                                        />
                                                    )}
                                                </div>
                                                {filter && (
                                                    <div
                                                        className="text-xs text-red-600 font-normal truncate"
                                                        title={
                                                            filter.expression
                                                        }
                                                    >
                                                        {filter.expression}
                                                    </div>
                                                )}
                                            </div>
                                        </TableHead>
                                    )
                                })}
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedResults.map((row, index) => (
                            <TableRow key={index}>
                                {availableColumns
                                    .filter((col) => col.visible)
                                    .map((col) => (
                                        <TableCell key={col.name}>
                                            {col.type === "system" ? (
                                                col.name === "element" ? (
                                                    <div className="line-clamp-2 break-words">
                                                        {row[0]}
                                                    </div>
                                                ) : typeof row[1] ===
                                                  "number" ? (
                                                    row[1].toFixed(4)
                                                ) : (
                                                    row[1]
                                                )
                                            ) : (
                                                formatAttributeValue(
                                                    parsedAttributeCache[
                                                        row[0]
                                                    ]?.[col.name]
                                                )
                                            )}
                                        </TableCell>
                                    ))}
                                <TableCell className="text-right">
                                    <div className="flex justify-end -space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                handleSearchSimilar(row[0])
                                            }
                                            className="h-8 w-8"
                                            title="Search similar vectors"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                                />
                                            </svg>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) =>
                                                onShowVectorClick(e, row[0])
                                            }
                                            className="h-8 w-8"
                                            title="Copy vector"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                                                />
                                            </svg>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() =>
                                                setEditingAttributes(row[0])
                                            }
                                            className="h-8 w-8"
                                            title="Edit attributes"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                            </svg>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) =>
                                                onDeleteClick(e, row[0])
                                            }
                                            className="h-8 w-8 text-red-600"
                                            title="Delete vector"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                />
                                            </svg>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="space-y-4 mb-8">
                    {filteredAndSortedResults.map((row, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-lg border p-4 hover:shadow-md group"
                        >
                            <div className="flex items-start justify-between w-full">
                                <div className="flex items-start space-x-4 w-full">
                                    <div className="bg-gray-100 rounded-lg p-2 text-gray-600">
                                        {index + 1}
                                    </div>
                                    <div className="flex flex-col gap-2 w-full">
                                        <div className="grow">
                                            <div className="text-sm text-gray-500 uppercase">
                                                Element
                                            </div>
                                            <div className="font-medium">
                                                {row[0]}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-500">
                                                SCORE
                                            </div>
                                            <div className="font-medium">
                                                {typeof row[1] === "number"
                                                    ? row[1].toFixed(4)
                                                    : row[1]}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end space-y--1 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        onClick={() =>
                                            handleSearchSimilar(row[0])
                                        }
                                        className="p-2 hover:bg-gray-100 rounded-full flex items-center gap-2 text-gray-500"
                                        title="Search similar vectors"
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                            />
                                        </svg>
                                        Find Similar
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        onClick={(e) =>
                                            onShowVectorClick(e, row[0])
                                        }
                                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 flex items-center gap-2"
                                        title="Copy vector"
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                                            />
                                        </svg>
                                        Copy Vector
                                    </Button>
                                    {!showAttributes && (
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                setEditingAttributes(row[0])
                                            }
                                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 flex items-center gap-2"
                                            title="Edit attributes"
                                        >
                                            <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                />
                                            </svg>
                                            Edit Attributes
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        onClick={(e) =>
                                            onDeleteClick(e, row[0])
                                        }
                                        className="p-2 hover:bg-gray-100 rounded-full text-red-600 flex items-center gap-2"
                                        title="Delete vector"
                                    >
                                        <svg
                                            className="w-5 h-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                        Delete
                                    </Button>
                                </div>
                            </div>
                            {showOnlyFilteredAttributes &&
                                filteredFields.map((field) => (
                                    <div key={field}>
                                        <div className="text-sm text-gray-500 uppercase">
                                            {field}
                                        </div>
                                        <div className="font-medium">
                                            {filteredFieldValues[row[0]]?.[
                                                field
                                            ] || ""}
                                        </div>
                                    </div>
                                ))}
                            {showAttributes && !showOnlyFilteredAttributes && (
                                <div className="w-full pl-10">
                                    <div className="text-sm text-gray-500">
                                        ATTRIBUTES
                                    </div>
                                    {isLoadingAttributes &&
                                    attributeCache[row[0]] === undefined ? (
                                        <div className="text-sm text-gray-500">
                                            Loading...
                                        </div>
                                    ) : attributeCache[row[0]] ? (
                                        <div className="flex gap-4 flex-wrap bg-gray-50 rounded-md p-2 w-full items-center">
                                            {Object.entries(
                                                parsedAttributeCache[row[0]] ||
                                                    {}
                                            ).map(([key, value]) => (
                                                <div
                                                    key={key}
                                                    className="flex flex-col"
                                                >
                                                    <div className="text-xs text-gray-500 uppercase">
                                                        {key}
                                                    </div>
                                                    <div className="">
                                                        {formatAttributeValue(
                                                            value
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="grow"></div>
                                            <Button
                                                variant="ghost"
                                                onClick={() =>
                                                    setEditingAttributes(row[0])
                                                }
                                                className="h-8 w-8 text-gray-500 mr-2"
                                                title="Edit attributes"
                                            >
                                                <svg
                                                    className="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                    />
                                                </svg>
                                                Edit
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setEditingAttributes(row[0])
                                            }
                                        >
                                            Add Attributes
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
