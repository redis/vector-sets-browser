import { Button } from "@/components/ui/button"
import { VectorTuple } from "@/lib/redis-server/api"

interface ExpandedResultRowProps {
    row: VectorTuple
    index: number
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

export default function ExpandedResultRow({
    row,
    index,
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
}: ExpandedResultRowProps) {
    // Helper to format different attribute value types
    const formatAttributeValue = (value: any): string => {
        if (Array.isArray(value)) return "[...]"
        if (typeof value === "boolean") return value ? "true" : "false"
        if (value === null || value === undefined) return ""
        return String(value)
    }

    return (
        <div
            className={`bg-[white] rounded-lg border p-4 hover:shadow-md group ${
                selectedElements.has(row[0])
                    ? "border-blue-400 bg-blue-50"
                    : ""
            }`}
            onClick={
                selectMode
                    ? () => handleSelectToggle(row[0])
                    : undefined
            }
        >
            <div className="flex items-start justify-between w-full">
                {/* Add checkbox in non-compact view */}
                {selectMode && (
                    <div className="mr-2 mt-1">
                        <input
                            type="checkbox"
                            checked={selectedElements.has(
                                row[0]
                            )}
                            onChange={() =>
                                handleSelectToggle(row[0])
                            }
                            className="h-4 w-4 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
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
                {!selectMode && (
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
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
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
                )}
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
    )
} 