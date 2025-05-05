import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { ColumnConfig } from "@/app/hooks/useVectorResultsSettings"
import { VectorTuple } from "@/app/redis-server/api"

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
}

export default function CompactResultRow({
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
    onDeleteClick
}: CompactResultRowProps) {
    // Helper to format different attribute value types
    const formatAttributeValue = (value: any): string => {
        if (Array.isArray(value)) return "[...]"
        if (typeof value === "boolean") return value ? "true" : "false"
        if (value === null || value === undefined) return ""
        return String(value)
    }

    return (
        <TableRow
            className={`group ${
                selectedElements.has(row[0])
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
                            checked={selectedElements.has(row[0])}
                            onChange={() => handleSelectToggle(row[0])}
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
                                ? () => handleSelectToggle(row[0])
                                : undefined
                        }
                        className={selectMode ? "cursor-pointer" : ""}
                    >
                        {col.type === "system" ? (
                            col.name === "element" ? (
                                <div className="line-clamp-2 break-words">
                                    {row[0]}
                                </div>
                            ) : typeof row[1] === "number" ? (
                                row[1].toFixed(4)
                            ) : (
                                row[1]
                            )
                        ) : (
                            formatAttributeValue(
                                parsedAttributeCache[row[0]]?.[col.name]
                            )
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
                                onClick={() => handleSearchSimilar(row[0])}
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
                                onClick={(e) => onShowVectorClick(e, row[0])}
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
                                onClick={() => setEditingAttributes(row[0])}
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
                                onClick={(e) => onDeleteClick(e, row[0])}
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
} 