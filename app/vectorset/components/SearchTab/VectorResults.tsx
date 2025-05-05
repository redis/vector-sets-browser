import SearchTimeIndicator from "@/components/SearchTimeIndicator"
import {
    ColumnConfig,
    useVectorResultsSettings,
} from "@/app/vectorset/hooks/useVectorResultsSettings"
import { VectorTuple, vgetattr_multi } from "@/lib/redis-server/api"
import { parseFieldFilters } from "@/lib/data/filter"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    ArrowDownUp,
    ArrowDownWideNarrow,
    ArrowUpNarrowWide,
    CheckSquare,
    Settings,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import EditAttributesDialog from "./EditAttributesDialog"
import EmptyVectorSet from "./EmptyVectorSet"
import { VectorResultsProps, AttributeCache, ParsedAttributes, SortColumn, SortDirection, FilterField } from "./types"
import { extractFilterFields, isEmptyVectorSet, sortResults } from "./utils"
import NoResults from "./components/NoResults"
import ResultsHeader from "./components/ResultsHeader"
import AttributeColumnsDialog from "./components/AttributeColumnsDialog"
import CompactResultsTable from "./components/CompactResultsTable"
import ExpandedResultsList from "./components/ExpandedResultsList"

export default function VectorResults({
    results,
    onRowClick,
    onDeleteClick,
    onShowVectorClick,
    onBulkDeleteClick,
    keyName,
    searchFilter,
    searchQuery,
    onClearFilter,
    onAddVector,
    isSearching,
    searchTime,
    isLoading,
    searchType,
    changeTab,
}: VectorResultsProps) {
    const [isCompact, setIsCompact] = useState(true)
    const {
        showAttributes,
        setShowAttributes,
        showOnlyFilteredAttributes,
        setShowOnlyFilteredAttributes,
        updateAttributeColumnVisibility,
        getColumnVisibility,
        isLoaded,
    } = useVectorResultsSettings()

    // Store the getColumnVisibility function in a ref to avoid dependency issues
    const getColumnVisibilityRef = useRef(getColumnVisibility)

    // Update the ref when getColumnVisibility changes
    useEffect(() => {
        getColumnVisibilityRef.current = getColumnVisibility
    }, [getColumnVisibility])

    const [filterText, setFilterText] = useState("")
    const [sortColumn, setSortColumn] = useState<SortColumn>("none")
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
    const [editingAttributes, setEditingAttributes] = useState<string | null>(null)
    const [attributeCache, setAttributeCache] = useState<AttributeCache>({})
    const [isLoadingAttributes, setIsLoadingAttributes] = useState(false)
    const [filteredFieldValues, setFilteredFieldValues] = useState<Record<string, Record<string, string>>>({})
    const [parsedAttributeCache, setParsedAttributeCache] = useState<Record<string, ParsedAttributes>>({})
    const [availableColumns, setAvailableColumns] = useState<ColumnConfig[]>([
        { name: "element", visible: true, type: "system" },
        { name: "score", visible: true, type: "system" },
    ])
    const [isAttributeColumnsDialogOpen, setIsAttributeColumnsDialogOpen] = useState(false)

    // Add state variables for selection mode
    const [selectMode, setSelectMode] = useState(false)
    const [selectedElements, setSelectedElements] = useState<Set<string>>(new Set())

    // Filter fields state
    const filterFields = useMemo(() => 
        extractFilterFields(searchFilter), [searchFilter]
    )

    // Clear selections when the keyName (vector set) changes
    useEffect(() => {
        setSelectMode(false)
        setSelectedElements(new Set())
    }, [keyName])

    // Handle individual selection toggle
    const handleSelectToggle = (element: string) => {
        setSelectedElements((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(element)) {
                newSet.delete(element)
            } else {
                newSet.add(element)
            }
            return newSet
        })
    }

    // Handle "Select All" action
    const handleSelectAll = () => {
        const allElements = filteredAndSortedResults.map((row) => row[0])
        setSelectedElements(new Set(allElements))
    }

    // Handle "Deselect All" action
    const handleDeselectAll = () => {
        setSelectedElements(new Set())
    }

    // Handle exiting select mode
    const handleExitSelectMode = () => {
        setSelectMode(false)
        setSelectedElements(new Set())
    }

    // Handle bulk delete action
    const handleBulkDelete = () => {
        if (onBulkDeleteClick && selectedElements.size > 0) {
            onBulkDeleteClick(Array.from(selectedElements))
            setSelectedElements(new Set())
        }
    }

    // Reset states when vectorSet changes
    useEffect(() => {
        // Reset to default columns
        setAvailableColumns([
            {
                name: "element",
                visible: getColumnVisibilityRef.current("element", true),
                type: "system",
            },
            {
                name: "score",
                visible: getColumnVisibilityRef.current("score", true),
                type: "system",
            },
        ])

        // Reset other related states
        setAttributeCache({})
        setParsedAttributeCache({})
        setFilteredFieldValues({})
        setEditingAttributes(null)
        setSortColumn("none")
        setSortDirection("asc")
        setFilterText("")
        setIsLoadingAttributes(false)
    }, [keyName])

    // Single source of truth for attribute fetching
    const fetchAttributes = async (elements: string[]) => {
        try {
            const response = await vgetattr_multi({
                keyName,
                elements,
                returnCommandOnly: false,
            })

            if (!response?.success || !response?.result) {
                console.error(`Error fetching attributes`, response?.error)
                return null
            }
            return response.result
        } catch (error) {
            console.error(`Error fetching attributes`, error)
            return null
        }
    }

    // Fetch attributes for visible results
    useEffect(() => {
        if (!showAttributes || results.length === 0) return

        let isCancelled = false
        const elements = results.map((row) => row[0])

        const fetchAndProcessAttributes = async () => {
            setIsLoadingAttributes(true)
            try {
                const attributes = await fetchAttributes(elements)

                if (isCancelled || !attributes) return

                const newCache = { ...attributeCache }
                const newParsedCache: Record<string, ParsedAttributes> = {}
                const allAttributeColumns = new Set<string>()

                elements.forEach((element, i) => {
                    newCache[element] = attributes[i]
                    if (attributes[i]) {
                        try {
                            const parsed = JSON.parse(attributes[i])
                            newParsedCache[element] = parsed
                            Object.keys(parsed).forEach((key) =>
                                allAttributeColumns.add(key)
                            )
                        } catch (error) {
                            console.error(
                                `Error parsing attributes for ${element}:`,
                                error
                            )
                        }
                    }
                })

                if (!isCancelled) {
                    setAttributeCache(newCache)
                    setParsedAttributeCache(newParsedCache)

                    // Update columns in a single operation
                    setAvailableColumns((prev) => {
                        const systemColumns = prev.filter(
                            (col) => col.type === "system"
                        )
                        const attributeColumns = Array.from(
                            allAttributeColumns
                        ).map((name) => ({
                            name,
                            visible: getColumnVisibilityRef.current(name, true),
                            type: "attribute" as const,
                        }))
                        return [...systemColumns, ...attributeColumns]
                    })
                }
            } catch (error) {
                console.error("Error fetching attributes:", error)
            } finally {
                if (!isCancelled) {
                    setIsLoadingAttributes(false)
                }
            }
        }

        fetchAndProcessAttributes()

        return () => {
            isCancelled = true
        }
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

    // Modify the column management effect to be simpler
    useEffect(() => {
        if (!showAttributes || (showOnlyFilteredAttributes && !searchFilter)) {
            // Only hide attribute columns, don't remove them
            setAvailableColumns((prev) =>
                prev.map((col) => ({
                    ...col,
                    visible: col.type === "system" ? col.visible : false,
                }))
            )
            return
        }

        // Show/hide appropriate columns based on filter
        setAvailableColumns((prev) => {
            return prev.map((col) => {
                if (col.type === "system") return col

                const shouldBeVisible =
                    !showOnlyFilteredAttributes ||
                    (showOnlyFilteredAttributes &&
                        filteredFields.includes(col.name))

                return {
                    ...col,
                    visible: shouldBeVisible,
                }
            })
        })
    }, [
        showAttributes,
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
        )
            return

        const newValues: Record<string, Record<string, string>> = {}

        for (const row of results) {
            const element = row[0]
            const parsedAttributes = parsedAttributeCache[element]

            if (parsedAttributes) {
                newValues[element] = {}
                for (const field of filteredFields) {
                    newValues[element][field] =
                        parsedAttributes[field]?.toString() || ""
                }
            }
        }

        setFilteredFieldValues(newValues)
    }, [
        showAttributes,
        showOnlyFilteredAttributes,
        filteredFields,
        results,
        parsedAttributeCache,
    ])

    // Handle dialog close with updated attributes
    const handleAttributesDialogClose = (updatedAttributes?: string) => {
        if (updatedAttributes && editingAttributes) {
            // If attributes were saved, update our cache directly
            setAttributeCache((prev) => ({
                ...prev,
                [editingAttributes]: updatedAttributes,
            }))

            try {
                // Also update the parsed cache
                const parsed = JSON.parse(updatedAttributes)
                setParsedAttributeCache((prev) => ({
                    ...prev,
                    [editingAttributes]: parsed,
                }))

                // Update available columns with any new attributes
                const newColumns = new Set(Object.keys(parsed))
                setAvailableColumns((prev) => {
                    const existingColumns = new Set(prev.map((c) => c.name))
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
                console.error(`Error parsing updated attributes:`, e)
            }
        }

        // Clear the editing state
        setEditingAttributes(null)
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

        // Then sort
        return sortResults(processed, sortColumn, sortDirection)
    }, [results, filterText, sortColumn, sortDirection])

    const handleSearchSimilar = (element: string) => {
        // Use a combined callback that updates both values at once
        onRowClick(element)
    }

    // Modify the Add Vector button click handler
    const handleAddVector = async () => {
        if (onAddVector) {
            await onAddVector()
            // The parent component should handle refreshing the results
        }
    }

    // Update the handler for toggling column visibility
    const handleToggleColumn = (columnName: string, visible: boolean) => {
        // Update the local state
        setAvailableColumns((prev) =>
            prev.map((c) => (c.name === columnName ? { ...c, visible } : c))
        )

        // Persist the change to user settings
        updateAttributeColumnVisibility(columnName, visible)
    }

    // Check if the vectorset is empty (only has placeholder)
    const vectorSetIsEmpty = useMemo(() => 
        isEmptyVectorSet(results), [results]
    )

    // Early returns for different states
    if (!isLoaded || isLoading || isSearching) {
        return (
            <NoResults 
                keyName={keyName}
                isLoaded={isLoaded}
                isLoading={isLoading}
                isSearching={isSearching}
                searchTime={searchTime}
                searchQuery={searchQuery}
                searchFilter={searchFilter}
                searchType={searchType}
            />
        )
    }

    // Check for empty vector set (only has default vector)
    if (vectorSetIsEmpty) {
        return (
            <EmptyVectorSet
                onAddVector={onAddVector || (() => {})}
                onChangeTab={changeTab || (() => {})}
            />
        )
    }

    if (results.length === 0) {
        return (
            <NoResults 
                keyName={keyName}
                isLoaded={isLoaded}
                isLoading={isLoading}
                isSearching={isSearching}
                searchTime={searchTime}
                searchQuery={searchQuery}
                searchFilter={searchFilter}
                searchType={searchType}
            />
        )
    }

    return (
        <div className="space-y-4 mb-8">
            <EditAttributesDialog
                isOpen={!!editingAttributes}
                onClose={handleAttributesDialogClose}
                keyName={keyName}
                element={editingAttributes || ""}
            />

            <AttributeColumnsDialog
                isOpen={isAttributeColumnsDialogOpen}
                onClose={() => setIsAttributeColumnsDialogOpen(false)}
                columns={availableColumns}
                onToggleColumn={handleToggleColumn}
            />

            <ResultsHeader 
                results={results}
                searchTime={searchTime}
                isSearching={isSearching}
                isLoading={isLoading}
                searchFilter={searchFilter}
                searchQuery={searchQuery}
                onClearFilter={onClearFilter}
                onAddVector={onAddVector}
                searchType={searchType}
                selectMode={selectMode}
                selectedElements={selectedElements}
                isCompact={isCompact}
                showAttributes={showAttributes}
                showOnlyFilteredAttributes={showOnlyFilteredAttributes}
                availableColumns={availableColumns}
                setIsCompact={setIsCompact}
                setShowAttributes={setShowAttributes}
                setShowOnlyFilteredAttributes={setShowOnlyFilteredAttributes}
                setIsAttributeColumnsDialogOpen={setIsAttributeColumnsDialogOpen}
                setSelectMode={setSelectMode}
                handleSelectAll={handleSelectAll}
                handleDeselectAll={handleDeselectAll}
                handleBulkDelete={handleBulkDelete}
                handleExitSelectMode={handleExitSelectMode}
                handleAddVector={handleAddVector}
                updateAttributeColumnVisibility={updateAttributeColumnVisibility}
            />

            {isCompact ? (
                <CompactResultsTable 
                    filteredAndSortedResults={filteredAndSortedResults}
                    availableColumns={availableColumns}
                    filterFields={filterFields}
                    parsedAttributeCache={parsedAttributeCache}
                    sortColumn={sortColumn}
                    sortDirection={sortDirection}
                    handleSort={handleSort}
                    selectMode={selectMode}
                    selectedElements={selectedElements}
                    handleSelectToggle={handleSelectToggle}
                    handleSelectAll={handleSelectAll}
                    handleDeselectAll={handleDeselectAll}
                    handleSearchSimilar={handleSearchSimilar}
                    onShowVectorClick={onShowVectorClick}
                    setEditingAttributes={setEditingAttributes}
                    onDeleteClick={onDeleteClick}
                />
            ) : (
                <ExpandedResultsList 
                    filteredAndSortedResults={filteredAndSortedResults}
                    selectMode={selectMode}
                    selectedElements={selectedElements}
                    showAttributes={showAttributes}
                    showOnlyFilteredAttributes={showOnlyFilteredAttributes}
                    isLoadingAttributes={isLoadingAttributes}
                    attributeCache={attributeCache}
                    parsedAttributeCache={parsedAttributeCache}
                    filteredFields={filteredFields}
                    filteredFieldValues={filteredFieldValues}
                    handleSelectToggle={handleSelectToggle}
                    handleSearchSimilar={handleSearchSimilar}
                    onShowVectorClick={onShowVectorClick}
                    setEditingAttributes={setEditingAttributes}
                    onDeleteClick={onDeleteClick}
                />
            )}
        </div>
    )
}
