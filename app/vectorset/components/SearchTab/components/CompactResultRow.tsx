import React from "react"
import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { ColumnConfig } from "@/app/vectorset/hooks/useVectorResultsSettings"
import { VectorTuple } from "@/lib/redis-server/api"
import { 
    getEmbeddingIcon
} from "@/components/EmbeddingConfig/EmbeddingIcons"
import { EmbeddingDataFormat, getEmbeddingDataFormat } from "@/lib/embeddings/types/embeddingModels"
import { VectorSetMetadata } from "@/lib/types/vectors"

interface CompactResultRowProps {
    row: VectorTuple
    index: number
    availableColumns: ColumnConfig[]
    parsedAttributeCache: Record<string, Record<string, any>>
    selectMode: boolean
    selectedElements: Set<string>
    handleSelectToggle: (element: string) => void
    handleSearchSimilar: (element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    setEditingAttributes: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
    metadata?: VectorSetMetadata | null
}

const CompactResultRow = React.memo(function CompactResultRow({
    row,
    index,
    availableColumns,
    parsedAttributeCache,
    selectMode,
    selectedElements,
    handleSelectToggle,
    handleSearchSimilar,
    onShowVectorClick,
    setEditingAttributes,
    onDeleteClick,
    metadata
}: CompactResultRowProps) {
    // Helper to format different attribute value types
    const formatAttributeValue = (value: any): string => {
        if (Array.isArray(value)) return "[...]"
        if (typeof value === "boolean") return value ? "true" : "false"
        if (value === null || value === undefined) return ""
        return String(value)
    }

    const element = row[0]
    const isSelected = selectedElements.has(element)

    return (
        <TableRow
            className={`group ${
                isSelected
                    ? "bg-blue-50"
                    : ""
            }`}
        >
            {/* Add a checkbox cell when in select mode */}
            {selectMode && (
                <TableCell className="w-12">
                    <div className="flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectToggle(element)}
                            className="h-4 w-4 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
                        />
                    </div>
                </TableCell>
            )}

            {availableColumns
                .filter((col) => col.visible)
                .map((col) => (
                    <TableCell
                        key={col.name}
                        onClick={
                            selectMode
                                ? () => handleSelectToggle(element)
                                : undefined
                        }
                        className={selectMode ? "cursor-pointer" : ""}
                    >
                        {col.type === "system" ? (
                            col.name === "element" ? (
                                <div className="line-clamp-2 break-words flex items-center gap-2">
                                    <span className="flex-shrink-0">
                                        {React.createElement(getEmbeddingIcon(getEmbeddingDataFormat(
                                                            metadata?.embedding
                                                        )))}
                                    </span>
                                    <span className="font-medium">{element}</span>
                                </div>
                            ) : typeof row[1] === "number" ? (
                                <span className="text-muted-foreground border border-gray-200 rounded-full p-1 text-xs">{row[1].toFixed(4)}</span>
                            ) : (
                                row[1]
                            )
                        ) : (
                            <span className="text-xs">
                                {formatAttributeValue(
                                    parsedAttributeCache[element]?.[col.name]
                                )}
                            </span>
                        )}
                    </TableCell>
                ))}
            <TableCell className="text-right">
                <div className="flex justify-end -space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!selectMode && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSearchSimilar(element)}
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
                                onClick={(e) => onShowVectorClick(e, element)}
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
                                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    />
                                </svg>
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingAttributes(element)}
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
                                onClick={(e) => onDeleteClick(e, element)}
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
                        </>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
})

export default CompactResultRow 