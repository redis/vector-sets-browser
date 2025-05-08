import { Table, TableBody } from "@/components/ui/table"
import { VectorTuple } from "@/lib/redis-server/api"
import { ColumnConfig } from "@/app/vectorset/hooks/useVectorResultsSettings"
import { FilterField, SortColumn, SortDirection } from "../types"
import ResultsTableHeader from "./ResultsTableHeader"
import CompactResultRow from "./CompactResultRow"
import { VectorSetMetadata } from "@/lib/types/vectors"

export interface CompactResultsTableProps {
    filteredAndSortedResults: VectorTuple[]
    availableColumns: ColumnConfig[]
    filterFields: FilterField[]
    parsedAttributeCache: Record<string, Record<string, any>>
    sortColumn: SortColumn
    sortDirection: SortDirection
    handleSort: (column: SortColumn) => void
    selectMode: boolean
    selectedElements: Set<string>
    handleSelectToggle: (element: string) => void
    handleSelectAll: () => void
    handleDeselectAll: () => void
    handleSearchSimilar: (element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    setEditingAttributes: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
    metadata?: VectorSetMetadata | null
}

export default function CompactResultsTable({
    filteredAndSortedResults,
    availableColumns,
    filterFields,
    parsedAttributeCache,
    sortColumn,
    sortDirection,
    handleSort,
    selectMode,
    selectedElements,
    handleSelectToggle,
    handleSelectAll,
    handleDeselectAll,
    handleSearchSimilar,
    onShowVectorClick,
    setEditingAttributes,
    onDeleteClick,
    metadata
}: CompactResultsTableProps) {
    return (
        <Table>
            <ResultsTableHeader 
                availableColumns={availableColumns}
                filterFields={filterFields}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                handleSort={handleSort}
                selectMode={selectMode}
                selectedElements={selectedElements}
                handleSelectAll={handleSelectAll}
                handleDeselectAll={handleDeselectAll}
                filteredAndSortedResults={filteredAndSortedResults}
            />
            <TableBody>
                {filteredAndSortedResults.map((row, index) => (
                    <CompactResultRow 
                        key={index}
                        row={row}
                        index={index}
                        availableColumns={availableColumns}
                        parsedAttributeCache={parsedAttributeCache}
                        selectMode={selectMode}
                        selectedElements={selectedElements}
                        handleSelectToggle={handleSelectToggle}
                        handleSearchSimilar={handleSearchSimilar}
                        onShowVectorClick={onShowVectorClick}
                        setEditingAttributes={setEditingAttributes}
                        onDeleteClick={onDeleteClick}
                        metadata={metadata}
                    />
                ))}
            </TableBody>
        </Table>
    )
} 