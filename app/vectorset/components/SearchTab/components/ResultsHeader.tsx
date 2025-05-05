import SearchTimeIndicator from "@/components/SearchTimeIndicator"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CheckSquare, Settings } from "lucide-react"
import { ColumnConfig } from "@/app/vectorset/hooks/useVectorResultsSettings"

interface ResultsHeaderProps {
    results: any[]
    searchTime?: string
    isSearching?: boolean
    isLoading?: boolean
    searchFilter?: string
    searchQuery?: string
    onClearFilter?: () => void
    onAddVector?: () => void
    searchType?: "Vector" | "Element" | "Image"
    selectMode: boolean
    selectedElements: Set<string>
    isCompact: boolean
    showAttributes: boolean
    showOnlyFilteredAttributes: boolean
    availableColumns: ColumnConfig[]
    setIsCompact: (value: boolean) => void
    setShowAttributes: (value: boolean) => void
    setShowOnlyFilteredAttributes: (value: boolean) => void
    setIsAttributeColumnsDialogOpen: (value: boolean) => void
    setSelectMode: (value: boolean) => void
    handleSelectAll: () => void
    handleDeselectAll: () => void
    handleBulkDelete: () => void
    handleExitSelectMode: () => void
    handleAddVector: () => void
    updateAttributeColumnVisibility: (columnName: string, visible: boolean) => void
}

export default function ResultsHeader({
    results,
    searchTime,
    isSearching,
    isLoading,
    searchFilter,
    searchQuery,
    onClearFilter,
    onAddVector,
    searchType,
    selectMode,
    selectedElements,
    isCompact,
    showAttributes,
    showOnlyFilteredAttributes,
    availableColumns,
    setIsCompact,
    setShowAttributes,
    setShowOnlyFilteredAttributes,
    setIsAttributeColumnsDialogOpen,
    setSelectMode,
    handleSelectAll,
    handleDeselectAll,
    handleBulkDelete,
    handleExitSelectMode,
    handleAddVector,
    updateAttributeColumnVisibility
}: ResultsHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
            <div className="flex items-center gap-2 w-full">
                {results.length > 0 ? (
                    <div className="flex items-center gap-2">
                        <div>
                            {(searchTime || isSearching) && (
                                <SearchTimeIndicator
                                    searchTime={
                                        searchTime
                                            ? parseFloat(searchTime)
                                            : undefined
                                    }
                                    isSearching={isSearching}
                                />
                            )}
                        </div>
                        <div className="grow"></div>
                        <div className="flex text-gray-500 text-sm items-center space-x-2 whitespace-nowrap">
                            {searchQuery ? (
                                <div className="flex items-center space-x-2">
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
                                    <div>Filters:</div>
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                        <span>{searchFilter}</span>
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
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Message for empty search in Element search mode */}
                        {searchType === "Element" &&
                            (searchQuery === undefined ||
                                searchQuery === "") &&
                            !isSearching &&
                            !isLoading && (
                                <div className="ml-2 text-gray-500 text-sm flex items-center">
                                    Enter an element ID to search
                                </div>
                            )}
                    </>
                )}
            </div>
            <div className="flex items-center space-x-2">
                {/* Selection mode controls */}
                {selectMode ? (
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                            {selectedElements.size} selected
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="text-xs"
                        >
                            Select All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAll}
                            className="text-xs"
                            disabled={selectedElements.size === 0}
                        >
                            Deselect All
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDelete}
                            disabled={selectedElements.size === 0}
                            className="text-xs"
                        >
                            Delete Selected
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExitSelectMode}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center space-x-2">
                        {onAddVector && (
                            <Button
                                variant="outline"
                                onClick={handleAddVector}
                            >
                                <div className="flex items-center space-x-2">
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
                                    <div className="text-xs">
                                        Add Vector
                                    </div>
                                </div>
                            </Button>
                        )}
                        {/* Add a "Select" button to enable selection mode */}
                        <Button
                            variant="outline"
                            onClick={() => setSelectMode(true)}
                            disabled={results.length === 0}
                            className="text-xs"
                        >
                            <CheckSquare className="w-5 h-5 mr-1" />
                            Select
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="text-xs"
                                >
                                    <Settings className="h-4 w-4" />
                                    Options
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                className="w-56"
                            >
                                <DropdownMenuCheckboxItem
                                    checked={isCompact}
                                    onCheckedChange={setIsCompact}
                                >
                                    Compact View
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showAttributes}
                                    onCheckedChange={(checked) => {
                                        setShowAttributes(checked)
                                    }}
                                >
                                    Show Attributes
                                </DropdownMenuCheckboxItem>
                                {showAttributes && (
                                    <DropdownMenuCheckboxItem
                                        checked={showOnlyFilteredAttributes}
                                        onCheckedChange={(checked) => {
                                            setShowOnlyFilteredAttributes(
                                                checked
                                            )
                                        }}
                                        disabled={!showAttributes}
                                    >
                                        Show Only Filtered Attributes
                                    </DropdownMenuCheckboxItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>
                                    Columns
                                </DropdownMenuLabel>
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
                                                updateAttributeColumnVisibility(
                                                    col.name,
                                                    checked
                                                )
                                            }}
                                        >
                                            {col.name
                                                .charAt(0)
                                                .toUpperCase() +
                                                col.name.slice(1)}
                                        </DropdownMenuCheckboxItem>
                                    ))}

                                {/* Attribute Columns Menu Item */}
                                {availableColumns.some(
                                    (col) => col.type === "attribute"
                                ) && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={() =>
                                                setIsAttributeColumnsDialogOpen(
                                                    true
                                                )
                                            }
                                            className="cursor-pointer"
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <span>
                                                    Attribute Columns
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {
                                                        availableColumns.filter(
                                                            (col) =>
                                                                col.type ===
                                                                    "attribute" &&
                                                                col.visible
                                                        ).length
                                                    }{" "}
                                                    /{" "}
                                                    {
                                                        availableColumns.filter(
                                                            (col) =>
                                                                col.type ===
                                                                "attribute"
                                                        ).length
                                                    }
                                                </span>
                                            </div>
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>
        </div>
    )
} 