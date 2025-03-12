import { useMemo, useEffect, useState } from "react"
import { getEmbeddingDataFormat, VectorSetMetadata } from "../types/embedding"
import * as React from "react"
import { Input } from "@/components/ui/input"
import {
    ChevronDown,
    Shuffle,
    HelpCircle,
    Settings,
    X,
    Check,
    Copy,
    Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const searchTypes = [
    {
        value: "Vector",
        label: "Vector",
    },
    {
        value: "Element",
        label: "Element",
    },
    {
        value: "Image",
        label: "Image",
    },
] as const

interface SearchBoxProps {
    vectorSetName: string
    searchType: "Vector" | "Element" | "Image"
    setSearchType: (type: "Vector" | "Element" | "Image") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    searchFilter: string
    setSearchFilter: (filter: string) => void
    dim: number | null
    metadata: VectorSetMetadata | null
    searchCount?: string
    setSearchCount?: (value: string) => void
}

export default function SearchBox({
    vectorSetName,
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    searchFilter,
    setSearchFilter,
    dim,
    metadata,
    searchCount,
    setSearchCount,
}: SearchBoxProps) {
    const [showFilters, setShowFilters] = useState(() => {
        // Initialize from localStorage, default to true if not set
        const stored = localStorage.getItem("showFilters")
        return stored ? JSON.parse(stored) : true
    })
    const [showFilterHelp, setShowFilterHelp] = useState(false)
    const isImageEmbedding =
        metadata && getEmbeddingDataFormat(metadata?.embedding) === "image"
    const isTextEmbedding =
        metadata && getEmbeddingDataFormat(metadata?.embedding) === "text"
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    const filteredSearchTypes = searchTypes.filter((type) => {
        if (type.value === "Image" && !isImageEmbedding) {
            return false
        }
        return true
    })

    // Compute the placeholder text based on current searchType
    const searchBoxPlaceholder = useMemo(() => {
        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Image":
                return "Enter image data"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding
                    ? "Enter search text OR Enter raw vector data (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, isTextEmbedding])

    // set default searchType only when metadata changes
    useEffect(() => {
        if (!metadata) return // Don't set defaults if no metadata

        if (supportsEmbeddings) {
            const newSearchType = isTextEmbedding ? "Vector" : "Element"

            // Only update if the current searchType doesn't match what it should be
            if (searchType !== newSearchType) {
                setSearchType(newSearchType)
            }
        }
    }, [metadata]) // Only run when metadata changes

    // Save showFilters state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem("showFilters", JSON.stringify(showFilters))
    }, [showFilters])

    const [showRedisCommand, setShowRedisCommand] = useState(() => {
        // Initialize from localStorage, default to true if not set
        const stored = localStorage.getItem("showRedisCommand")
        return stored ? JSON.parse(stored) : true
    })

    // Save showRedisCommand state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem(
            "showRedisCommand",
            JSON.stringify(showRedisCommand)
        )
    }, [showRedisCommand])

    // Add this new function to generate the Redis command
    const getRedisCommand = () => {
        if (!searchQuery && !searchFilter)
            return `VSIM ${vectorSetName} VALUES [0.0000, 0.0000, ...] WITHSCORES COUNT 10`

        const type = searchType === "Element" ? "ELE" : "VALUES"
        const count = "10" // Using default count of 10
        const filterExpr = searchFilter ? `"${searchFilter}"` : ""

        let command = `VSIM ${vectorSetName} ${type} `

        // Add search query
        if (type === "ELE") {
            command += `"${searchQuery}"`
        } else {
            // For vector search, try to format the numbers nicely
            let vectorStr = searchQuery
                .split(",")
                .map((v) => parseFloat(v.trim()))
                .filter((v) => !isNaN(v))
                .join(" ")
            if (vectorStr.length === 0) {
                if (searchQuery.length > 0) {
                    vectorStr = "N.NNN, N.NNN, ..."
                } else {
                    vectorStr = "0.00, 0.00, ..."
                }
            }
            command += `[${vectorStr}]`
        }

        command += ` WITHSCORES COUNT ${count}`

        if (filterExpr) {
            command += ` FILTER ${filterExpr}`
        }

        return command
    }

    return (
        <section className="mb-6">
            <div className="bg-white p-4 rounded shadow-md flex flex-col gap-2 items-start">
                <div className="flex gap-2 items-center w-full justify-between">
                    <div className="flex gap-2 items-center w-full">
                        <label className="text-sm font-medium text-gray-700">
                            Search by
                        </label>
                        <Select
                            defaultValue={searchType}
                            value={searchType}
                            onValueChange={setSearchType}
                        >
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Select type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredSearchTypes.map((type) => (
                                    <SelectItem
                                        key={type.value}
                                        value={type.value}
                                        className="flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {type.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="grow"></div>
                        {setSearchCount && (
                            <div className="flex items-center gap-1 pr-10">
                                <label className="text-xs font-medium text-gray-500">
                                    Show
                                </label>
                                <Input
                                    type="number"
                                    value={searchCount}
                                    onChange={(e) => setSearchCount(e.target.value)}
                                    className="w-16 h-8 text-center"
                                    min="1"
                                />
                                <label className="text-xs font-medium text-gray-500">
                                    Results
                                </label>
                            </div>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                                <Settings className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <div className="flex items-center justify-between w-full">
                                    Show Filters
                                    {showFilters && (
                                        <Check className="h-4 w-4 ml-2" />
                                    )}
                                </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    setShowRedisCommand(!showRedisCommand)
                                }
                            >
                                <div className="flex items-center justify-between w-full">
                                    Show Redis Command
                                    {showRedisCommand && (
                                        <Check className="h-4 w-4 ml-2" />
                                    )}
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-col gap-2 grow w-full">
                    <div className="relative flex gap-2">
                        <div className="flex-1 relative">
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchBoxPlaceholder}
                                className="border rounded p-3 w-full pr-12"
                            />
                            {searchType === "Vector" && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full"
                                    onClick={() => {
                                        if (dim) {
                                            const randomVector = Array.from(
                                                { length: dim },
                                                () => Math.random()
                                            ).map((n) => n.toFixed(4))
                                            setSearchQuery(
                                                randomVector.join(", ")
                                            )
                                        }
                                    }}
                                >
                                    <Shuffle className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`h-9 ${showFilters ? 'bg-gray-500 hover:bg-gray-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>

                    {showFilters && (
                        <div className="flex gap-2 items-center w-full">
                            <div className="grow relative">
                                <Input
                                    type="text"
                                    value={searchFilter}
                                    onChange={(e) =>
                                        setSearchFilter(e.target.value)
                                    }
                                    placeholder="Enter a search filter (e.g. .year < 1982)"
                                    className=""
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-1/2 -translate-y-1/2"
                                    onClick={() => setShowFilterHelp(true)}
                                >
                                    <HelpCircle className="h-8 w-8" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                {showRedisCommand && (
                    <div className="flex gap-2 items-center w-full bg-gray-100 rounded-md">
                        <div className="text-grey-400 p-2 font-mono overflow-x-scroll text-sm grow">
                            {getRedisCommand() ||
                                "Enter search parameters to see the Redis command"}
                        </div>
                        <div className="grow"></div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-500"
                            onClick={() => {
                                const command = getRedisCommand();
                                navigator.clipboard.writeText(command);
                            }}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-500"
                            onClick={() => setShowRedisCommand(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            <Dialog open={showFilterHelp} onOpenChange={setShowFilterHelp}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            Filter Expression Help
                        </DialogTitle>
                    </DialogHeader>
                    <div className="prose prose-sm">
                        <p className="mb-4">
                            Redis vector sets supports a simple but powerful
                            filtering syntax. The filter is applied to the
                            attributes of the vectors in the set.
                        </p>
                        <ul className="mb-4">
                            <li>
                                <strong>Arithmetic:</strong> +, -, *, /, %
                                (modulo), ** (exponentiation)
                            </li>
                            <li>
                                <strong>Comparison:</strong> &gt;, &gt;=, &lt;,
                                &lt;=, ==, !=
                            </li>
                            <li>
                                <strong>Logical:</strong> and/&&, or/||, !/not
                            </li>
                            <li>
                                <strong>Containment:</strong> in
                            </li>
                            <li>
                                <strong>Grouping:</strong> (...)
                            </li>
                        </ul>

                        <h3 className="text-lg font-bold">
                            Accessing Attributes
                        </h3>
                        <p className="mb-4">
                            Use dot notation to access attributes:{" "}
                            <code>.attributeName</code>
                        </p>
                        <p className="mb-4">
                            Only top-level attributes are accessible (nested
                            objects are not supported).
                        </p>

                        <h3 className="text-lg font-bold">Examples</h3>
                        <pre className="bg-gray-100 p-2 rounded">
                            <code>{`.year >= 1980 and .year < 1990
.genre == "action" and .rating > 8.0
.director in ["Spielberg", "Nolan"]
(.year - 2000) ** 2 < 100 and .rating / 2 > 4`}</code>
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}
