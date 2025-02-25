import { Button } from "@/components/ui/button"

interface VectorResultsProps {
    results: [string, number, number[]][]
    onRowClick: (elementId: string) => void
    onDeleteClick: (e: React.MouseEvent, elementId: string) => void
    onShowVectorClick: (e: React.MouseEvent, elementId: string) => void
    searchTime?: string
}

export default function VectorResults({ results, onRowClick, onDeleteClick, onShowVectorClick, searchTime }: VectorResultsProps) {
    if (results.length === 0) {
        return <p>No results to display.</p>
    }

    return (
        <div className="space-y-4 mb-8">
            {results.map((row, index) => (
                <div
                    key={index}
                    className="bg-white rounded-lg border p-4 hover:shadow-md group"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                            <div className="bg-gray-100 rounded-lg p-2 text-gray-600">
                                {index + 1}
                            </div>
                            <div className="flex flex-col gap-2">
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
                            <div className="grow"></div>
                        </div>
                        <div className="flex flex-col items-end space-y--1 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                variant="ghost"
                                onClick={() => onRowClick(row[0])}
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
                                onClick={(e) => onShowVectorClick(e, row[0])}
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
                            <Button
                                variant="ghost"
                                onClick={(e) => onDeleteClick(e, row[0])}
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
                </div>
            ))}
        </div>
    )
} 