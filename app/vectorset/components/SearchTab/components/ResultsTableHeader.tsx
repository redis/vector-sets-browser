import React from "react"
import { TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react"
import { ColumnConfig } from "@/app/vectorset/hooks/useVectorResultsSettings"
import { FilterField, SortColumn, SortDirection } from "../types"
import { VectorTuple } from "@/lib/redis-server/api"

interface SortIconProps {
    column: SortColumn
    sortColumn: SortColumn
    sortDirection: SortDirection
}

const SortIcon = ({ column, sortColumn, sortDirection }: SortIconProps) => {
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

interface ResultsTableHeaderProps {
    availableColumns: ColumnConfig[]
    filterFields: FilterField[]
    sortColumn: SortColumn
    sortDirection: SortDirection
    handleSort: (column: SortColumn) => void
    selectMode: boolean
    selectedElements: Set<string>
    handleSelectAll: () => void
    handleDeselectAll: () => void
    filteredAndSortedResults: VectorTuple[]
}

const ResultsTableHeader = React.memo(function ResultsTableHeader({
    availableColumns,
    filterFields,
    sortColumn,
    sortDirection,
    handleSort,
    selectMode,
    selectedElements,
    handleSelectAll,
    handleDeselectAll,
    filteredAndSortedResults
}: ResultsTableHeaderProps) {
    const isAllSelected = selectedElements.size === filteredAndSortedResults.length &&
        filteredAndSortedResults.length > 0

    return (
        <TableHeader>
            <TableRow>
                {/* Add a checkbox column when in select mode */}
                {selectMode && (
                    <TableHead className="w-12">
                        <div className="flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={(e) =>
                                    e.target.checked
                                        ? handleSelectAll()
                                        : handleDeselectAll()
                                }
                                className="h-4 w-4 rounded border-gray-300"
                            />
                        </div>
                    </TableHead>
                )}

                {availableColumns
                    .filter((col) => col.visible)
                    .map((col) => {
                        const filter = filterFields.find((f) => f.field === col.name)

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
                                            <div className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
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
                                                sortColumn={sortColumn}
                                                sortDirection={sortDirection}
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
    )
})

export default ResultsTableHeader 