import {
    ColumnConfig,
    useVectorResultsSettings,
} from "@/app/vectorset/hooks/useVectorResultsSettings"
import { vgetattr_multi } from "@/lib/redis-server/api"
import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import AttributeColumnsDialog from "./components/AttributeColumnsDialog"
import DropzoneResultsTable from "./components/DropzoneResultsTable"
import ExpandedResultsList from "./components/ExpandedResultsList"
import NoResults from "./components/NoResults"
import ResultsHeader from "./components/ResultsHeader"
import EditAttributesDialog from "./EditAttributesDialog"
import EmptyVectorSet from "./EmptyVectorSet"
import {
    AttributeCache,
    ParsedAttributes,
    SortColumn,
    SortDirection,
    VectorResultsProps,
} from "./types"
import { extractFilterFields, isEmptyVectorSet, sortResults } from "./utils"
import { getProviderInfo, getProvidersByDataFormat } from "@/lib/embeddings/types/embeddingModels"

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
    handleAddVectorWithImage,
    metadata,
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
    const [isAttributeColumnsDialogOpen, setIsAttributeColumnsDialogOpen] =
        useState(false)

    // Add state variables for selection mode
    const [selectMode, setSelectMode] = useState(false)
    const [selectedElements, setSelectedElements] = useState<Set<string>>(
        new Set()
    )

    // Add ref to track the last results for comparison
    const lastResultsRef = useRef<typeof results>([])
    const lastKeyNameRef = useRef<string>("")
    
    // Debouncing ref for attribute fetching
    const attributeFetchTimeoutRef = useRef<NodeJS.Timeout>()

    // Filter fields state - memoized to prevent recalculation
    const filterFields = useMemo(
        () => extractFilterFields(searchFilter),
        [searchFilter]
    )

    // Memoized filtered and sorted results - moved up before callbacks that use it
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

    // Clear selections when the keyName (vector set) changes
    useEffect(() => {
        setSelectMode(false)
        setSelectedElements(new Set())
    }, [keyName])

    // Memoized callback functions to prevent child re-renders
    const handleSelectToggle = useCallback((element: string) => {
        setSelectedElements((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(element)) {
                newSet.delete(element)
            } else {
                newSet.add(element)
            }
            return newSet
        })
    }, [])

    // Handle "Select All" action
    const handleSelectAll = useCallback(() => {
        setSelectedElements(prev => {
            const allElements = filteredAndSortedResults.map((row) => row[0])
            return new Set(allElements)
        })
    }, [filteredAndSortedResults])

    // Handle "Deselect All" action
    const handleDeselectAll = useCallback(() => {
        setSelectedElements(new Set())
    }, [])

    // Handle exiting select mode
    const handleExitSelectMode = useCallback(() => {
        setSelectMode(false)
        setSelectedElements(new Set())
    }, [])

    // Handle bulk delete action
    const handleBulkDelete = useCallback(() => {
        if (onBulkDeleteClick && selectedElements.size > 0) {
            onBulkDeleteClick(Array.from(selectedElements))
            setSelectedElements(new Set())
            setSelectMode(false)
        }
    }, [onBulkDeleteClick, selectedElements])

    // Optimized state reset - batch all updates when vectorSet changes
    useEffect(() => {
        if (keyName !== lastKeyNameRef.current) {
            lastKeyNameRef.current = keyName
            
            // Batch all state updates together
            const defaultColumns: ColumnConfig[] = [
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
            ]

            // Clear attribute fetch timeout
            if (attributeFetchTimeoutRef.current) {
                clearTimeout(attributeFetchTimeoutRef.current)
            }

            // Batch all state updates
            setAvailableColumns(defaultColumns)
            setAttributeCache({})
            setParsedAttributeCache({})
            setFilteredFieldValues({})
            setEditingAttributes(null)
            setSortColumn("none")
            setSortDirection("asc")
            setFilterText("")
            setIsLoadingAttributes(false)
            
            // Reset results reference
            lastResultsRef.current = []
        }
    }, [keyName])

    // Single source of truth for attribute fetching - memoized
    const fetchAttributes = useCallback(async (elements: string[]) => {
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
    }, [keyName])

    // Optimized attribute fetching with debouncing and comparison
    useEffect(() => {
        if (!showAttributes || results.length === 0) {
            if (attributeFetchTimeoutRef.current) {
                clearTimeout(attributeFetchTimeoutRef.current)
            }
            return
        }

        // Check if results actually changed (avoid refetching for same data)
        const currentElements = results.map(row => row[0]).sort()
        const lastElements = lastResultsRef.current.map(row => row[0]).sort()
        
        const elementsChanged = currentElements.length !== lastElements.length || 
            currentElements.some((element, index) => element !== lastElements[index])

        if (!elementsChanged) {
            return // No need to refetch if elements haven't changed
        }

        lastResultsRef.current = results

        // Clear any pending attribute fetch
        if (attributeFetchTimeoutRef.current) {
            clearTimeout(attributeFetchTimeoutRef.current)
        }

        // Debounce attribute fetching to avoid rapid API calls during search
        attributeFetchTimeoutRef.current = setTimeout(async () => {
            let isCancelled = false
            const elements = results.map((row) => row[0])

            setIsLoadingAttributes(true)
            try {
                const attributes = await fetchAttributes(elements)

                if (isCancelled || !attributes) return

                // Batch all state updates together
                const updates = {
                    newCache: { ...attributeCache },
                    newParsedCache: {} as Record<string, ParsedAttributes>,
                    allAttributeColumns: new Set<string>()
                }

                elements.forEach((element, i) => {
                    updates.newCache[element] = attributes[i]
                    if (attributes[i]) {
                        try {
                            const parsed = JSON.parse(attributes[i])
                            updates.newParsedCache[element] = parsed
                            Object.keys(parsed).forEach((key) =>
                                updates.allAttributeColumns.add(key)
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
                    // Batch state updates
                    setAttributeCache(updates.newCache)
                    setParsedAttributeCache(updates.newParsedCache)

                    // Only update columns if they actually changed
                    setAvailableColumns((prev) => {
                        const systemColumns = prev.filter(
                            (col) => col.type === "system"
                        )
                        const existingAttributeColumns = new Set(
                            prev.filter(col => col.type === "attribute").map(col => col.name)
                        )
                        
                        // Only add new columns, don't recreate existing ones
                        const newAttributeColumns = Array.from(
                            updates.allAttributeColumns
                        )
                        .filter(name => !existingAttributeColumns.has(name))
                        .map((name) => ({
                            name,
                            visible: getColumnVisibilityRef.current(name, true),
                            type: "attribute" as const,
                        }))

                        if (newAttributeColumns.length === 0 && 
                            prev.filter(col => col.type === "attribute").length === updates.allAttributeColumns.size) {
                            return prev // No changes needed
                        }

                        const existingAttributeColumnsArray = prev.filter(col => 
                            col.type === "attribute" && updates.allAttributeColumns.has(col.name)
                        )

                        return [...systemColumns, ...existingAttributeColumnsArray, ...newAttributeColumns]
                    })
                }
            } catch (error) {
                console.error("Error fetching attributes:", error)
            } finally {
                if (!isCancelled) {
                    setIsLoadingAttributes(false)
                }
            }

            // Cleanup function
            return () => {
                isCancelled = true
            }
        }, 150) // 150ms debounce

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (attributeFetchTimeoutRef.current) {
                clearTimeout(attributeFetchTimeoutRef.current)
            }
        }
    }, [showAttributes, results, keyName, fetchAttributes])

    // Extract field names from searchFilter - memoized
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

    // Optimized column management with fewer updates
    useEffect(() => {
        if (!showAttributes || (showOnlyFilteredAttributes && !searchFilter)) {
            // Only update if visibility actually changes
            setAvailableColumns((prev) => {
                const hasVisibleAttributes = prev.some(col => 
                    col.type === "attribute" && col.visible
                )
                
                if (!hasVisibleAttributes) return prev // No changes needed
                
                return prev.map((col) => ({
                    ...col,
                    visible: col.type === "system" ? col.visible : false,
                }))
            })
            return
        }

        // Show/hide appropriate columns based on filter
        setAvailableColumns((prev) => {
            let hasChanges = false
            const newColumns = prev.map((col) => {
                if (col.type === "system") return col

                const shouldBeVisible =
                    !showOnlyFilteredAttributes ||
                    (showOnlyFilteredAttributes &&
                        filteredFields.includes(col.name))

                if (col.visible !== shouldBeVisible) {
                    hasChanges = true
                }

                return {
                    ...col,
                    visible: shouldBeVisible,
                }
            })
            
            return hasChanges ? newColumns : prev
        })
    }, [
        showAttributes,
        showOnlyFilteredAttributes,
        searchFilter,
        filteredFields,
    ])

    // Fetch field values when filtered fields change - optimized
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
    const handleAttributesDialogClose = useCallback((updatedAttributes?: string) => {
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
    }, [editingAttributes])

    const handleSort = useCallback((column: SortColumn) => {
        setSortColumn(prevColumn => {
            if (prevColumn === column) {
                // Cycle through: asc -> desc -> none
                setSortDirection(prevDirection => {
                    if (prevDirection === "asc") {
                        return "desc"
                    } else if (prevDirection === "desc") {
                        // Reset to no sorting
                        setSortColumn("none")
                        return "asc"
                    }
                    return "asc"
                })
                return prevColumn
            } else {
                // Set new column and default to ascending
                setSortDirection("asc")
                return column
            }
        })
    }, [])

    const handleSearchSimilar = useCallback((element: string) => {
        // Use a combined callback that updates both values at once
        onRowClick(element)
    }, [onRowClick])

    // Modify the Add Vector button click handler
    const handleAddVector = useCallback(async () => {
        if (onAddVector) {
            onAddVector()
            // The parent component should handle refreshing the results
        }
    }, [onAddVector])

    // Update the handler for toggling column visibility
    const handleToggleColumn = useCallback((columnName: string, visible: boolean) => {
        // Update the local state
        setAvailableColumns((prev) =>
            prev.map((c) => (c.name === columnName ? { ...c, visible } : c))
        )

        // Persist the change to user settings
        updateAttributeColumnVisibility(columnName, visible)
    }, [updateAttributeColumnVisibility])

    // Check if the vectorset is empty (only has placeholder) - memoized
    const vectorSetIsEmpty = useMemo(() => isEmptyVectorSet(results), [results])

    // Create a stable search state that only changes when results actually change
    const hasResults = results.length > 0
    const isEmptyResults = results.length === 0 && !isLoading

    // Early returns for different states - but avoid complete component replacement during search
    if (!isLoaded) {
        return (
            <NoResults
                keyName={keyName}
                isLoaded={isLoaded}
                isLoading={false}
                isSearching={false}
                searchTime={searchTime}
                searchQuery={searchQuery}
                searchFilter={searchFilter}
                searchType={searchType}
            />
        )
    }

    // Check for empty vector set (only has default vector) - but not during search
    if (vectorSetIsEmpty) {
        return (
            <EmptyVectorSet
                onAddVector={onAddVector || (() => {})}
                onChangeTab={changeTab || (() => {})}
                handleAddVector={handleAddVectorWithImage || (async () => {})}
                vectorSetName={keyName}
                metadata={metadata}
            />
        )
    }

    // Show no results only when actually no results
    if (isEmptyResults) {
        return (
            <NoResults
                keyName={keyName}
                isLoaded={isLoaded}
                isLoading={false}
                isSearching={false}
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
                setIsAttributeColumnsDialogOpen={
                    setIsAttributeColumnsDialogOpen
                }
                setSelectMode={setSelectMode}
                handleSelectAll={handleSelectAll}
                handleDeselectAll={handleDeselectAll}
                handleBulkDelete={handleBulkDelete}
                handleExitSelectMode={handleExitSelectMode}
                handleAddVector={handleAddVector}
                updateAttributeColumnVisibility={
                    updateAttributeColumnVisibility
                }
            />

            {/* Remove all loading overlays and conditional rendering based on search state */}
            {isCompact ? (
                <DropzoneResultsTable
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
                    vectorSetName={keyName}
                    handleAddVector={
                        handleAddVectorWithImage || (async () => {})
                    }
                    metadata={metadata}
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
