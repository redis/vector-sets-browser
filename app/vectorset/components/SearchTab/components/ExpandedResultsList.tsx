import { VectorTuple } from "@/app/redis-server/api"
import ExpandedResultRow from "./ExpandedResultRow"

interface ExpandedResultsListProps {
    filteredAndSortedResults: VectorTuple[]
    selectMode: boolean
    selectedElements: Set<string>
    showAttributes: boolean
    showOnlyFilteredAttributes: boolean
    isLoadingAttributes: boolean
    attributeCache: Record<string, string | null>
    parsedAttributeCache: Record<string, Record<string, any>>
    filteredFields: string[]
    filteredFieldValues: Record<string, Record<string, string>>
    handleSelectToggle: (element: string) => void
    handleSearchSimilar: (element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    setEditingAttributes: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
}

export default function ExpandedResultsList({
    filteredAndSortedResults,
    selectMode,
    selectedElements,
    showAttributes,
    showOnlyFilteredAttributes,
    isLoadingAttributes,
    attributeCache,
    parsedAttributeCache,
    filteredFields,
    filteredFieldValues,
    handleSelectToggle,
    handleSearchSimilar,
    onShowVectorClick,
    setEditingAttributes,
    onDeleteClick
}: ExpandedResultsListProps) {
    return (
        <div className="space-y-4 mb-8">
            {filteredAndSortedResults.map((row, index) => (
                <ExpandedResultRow 
                    key={index}
                    row={row}
                    index={index}
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
            ))}
        </div>
    )
} 