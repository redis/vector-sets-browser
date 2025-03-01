import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useState, useMemo } from "react"
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react"

interface VectorResultsProps {
    results: [string, number, number[]][]
    onRowClick: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    searchTime?: string
}

type SortColumn = "element" | "score" | "none"
type SortDirection = "asc" | "desc"

export default function VectorResults({ 
    results, 
    onRowClick, 
    onDeleteClick, 
    onShowVectorClick, 
}: VectorResultsProps) {
    const [isCompact, setIsCompact] = useState(true)
    const [filterText, setFilterText] = useState("")
    const [sortColumn, setSortColumn] = useState<SortColumn>("none")
    const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
    
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
            processed = results.filter(row => 
                row[0].toLowerCase().includes(lowerFilter)
            )
        }
        
        // Then sort, but only if a sort column is selected
        if (sortColumn === "none") {
            return processed; // Return filtered results without sorting
        }
        
        return [...processed].sort((a, b) => {
            if (sortColumn === "element") {
                const comparison = a[0].localeCompare(b[0])
                return sortDirection === "asc" ? comparison : -comparison
            } else { // score
                const comparison = a[1] - b[1]
                return sortDirection === "asc" ? comparison : -comparison
            }
        })
    }, [results, filterText, sortColumn, sortDirection])

    const handleSearchSimilar = (element: string) => {
        console.log("[VectorResults] handleSearchSimilar", element);
        
        // Use a combined callback that updates both values at once
        // This might help ensure the UI updates properly
        onRowClick(element);
    }

    if (results.length === 0) {
        return <p>No results to display.</p>
    }

    // Sort indicator icons
    const SortIcon = ({ column }: { column: SortColumn }) => {
        // If this column is not the active sort column or sorting is off
        if (sortColumn !== column || sortColumn === "none") {
            return <ArrowDownUp className="w-4 h-4 ml-1 text-gray-500" />
        }
        
        // Active sort column
        if (sortDirection === "asc") {
            return <ArrowUpNarrowWide className="w-4 h-4 ml-1 text-black" strokeWidth={2.5} />
        } else {
            return <ArrowDownWideNarrow className="w-4 h-4 ml-1 text-black" strokeWidth={2.5} />
        }
    }

    return (
        <div className="space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-4">
                <div className="w-full sm:max-w-xs">
                    <Input
                        placeholder="Filter elements..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full"
                    />
                </div>
                <div className="flex items-center space-x-2">
                    <Switch 
                        id="compact-mode" 
                        checked={isCompact} 
                        onCheckedChange={setIsCompact} 
                    />
                    <Label htmlFor="compact-mode">Compact</Label>
                </div>
            </div>

            {isCompact ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead 
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort("element")}
                            >
                                <div className="flex items-center">
                                    Element
                                    <SortIcon column="element" />
                                </div>
                            </TableHead>
                            <TableHead 
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => handleSort("score")}
                            >
                                <div className="flex items-center">
                                    Score
                                    <SortIcon column="score" />
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAndSortedResults.map((row, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium max-w-md">
                                    <div className="line-clamp-2 break-words">
                                        {row[0]}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {typeof row[1] === "number" ? row[1].toFixed(4) : row[1]}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end -space-x-1">
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
                                                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
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
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="space-y-4 mb-8">
                    {filteredAndSortedResults.map((row, index) => (
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
                                        onClick={() => handleSearchSimilar(row[0])}
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
            )}
        </div>
    )
} 