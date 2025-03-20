import { userSettings } from "@/app/utils/userSettings"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Check, Filter, Settings, Shuffle, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
    getEmbeddingDataFormat,
    VectorSetMetadata,
} from "@/app/embeddings/types/config"
import SmartFilterInput from "./SmartFilterInput"
import { VectorTuple } from "@/app/redis-server/api"
import RedisCommandBox from "./RedisCommandBox"
import ImageUploader from "./ImageUploader"

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
    error?: string | null
    clearError?: () => void
    expansionFactor?: number
    setExpansionFactor?: (value: number | undefined) => void
    lastTextEmbedding?: number[]
    executedCommand?: string
    results?: VectorTuple[]
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
    error,
    clearError,
    expansionFactor,
    setExpansionFactor,
    lastTextEmbedding,
    executedCommand,
    results = [],
}: SearchBoxProps) {
    const [showFilters, setShowFilters] = useState(() => {
        return userSettings.get("showFilters") ?? true
    })
    const [showFilterHelp, setShowFilterHelp] = useState(false)
    const [showSearchOptions, setShowSearchOptions] = useState(false)
    const [showRedisCommand, setShowRedisCommand] = useState(() => {
        return userSettings.get("showRedisCommand") ?? true
    })
    // Add local filter state to debounce filter changes
    const [localFilter, setLocalFilter] = useState(searchFilter)
    const filterTimeoutRef = useRef<NodeJS.Timeout>()

    // State for custom expansion factor
    const [useCustomEF, setUseCustomEF] = useState(() => {
        // Get saved value or default to false
        return userSettings.get("useCustomEF") ?? !!expansionFactor
    })
    const [efValue, setEFValue] = useState(() => {
        // Get saved value or default to expansion factor or 200
        return (
            userSettings.get("efValue")?.toString() ||
            expansionFactor?.toString() ||
            "200"
        )
    })

    // Add state for the last generated image embedding
    const [lastImageEmbedding, setLastImageEmbedding] = useState<number[] | null>(null)

    // Add a ref to track if we've initialized the search type
    const initialSearchTypeSetRef = useRef(false);

    // Update local filter when searchFilter prop changes, but only on initial mount
    // or when the vector set changes, not on every searchFilter change
    useEffect(() => {
        // Update localFilter from prop when vector set changes
        setLocalFilter(searchFilter)
    }, [vectorSetName, searchFilter]) // Depend on both vectorSetName and searchFilter

    // Handle filter changes with debounce
    const handleFilterChange = (value: string) => {
        setLocalFilter(value)

        if (filterTimeoutRef.current) {
            clearTimeout(filterTimeoutRef.current)
        }

        filterTimeoutRef.current = setTimeout(() => {
            setSearchFilter(value)
        }, 500)
    }

    // Handle expansion factor changes
    const handleEFToggle = (checked: boolean) => {
        setUseCustomEF(checked)
        // Save the toggle state
        userSettings.set("useCustomEF", checked)

        if (setExpansionFactor) {
            if (checked) {
                const value = parseInt(efValue)
                const efNumber = isNaN(value) ? 200 : value
                setExpansionFactor(efNumber)
                // Also save the value
                userSettings.set("efValue", efNumber)
            } else {
                setExpansionFactor(undefined)
            }
        }
    }

    const handleEFValueChange = (value: string) => {
        setEFValue(value)
        if (setExpansionFactor && useCustomEF) {
            const numValue = parseInt(value)
            const efNumber = isNaN(numValue) ? 200 : numValue
            setExpansionFactor(efNumber)
            // Save the value when it changes
            userSettings.set("efValue", efNumber)
        }
    }

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (filterTimeoutRef.current) {
                clearTimeout(filterTimeoutRef.current)
            }
        }
    }, [])

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
                    ? "Enter search text or vector data (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, isTextEmbedding])

    // set default searchType only when metadata changes
    useEffect(() => {
        if (!metadata) return // Don't set defaults if no metadata
        
        // Only set default on first metadata load
        if (supportsEmbeddings && !initialSearchTypeSetRef.current) {
            // Choose appropriate default search type based on embedding format
            let newSearchType: "Vector" | "Element" | "Image";
            
            if (isImageEmbedding) {
                newSearchType = "Image";
            } else if (isTextEmbedding) {
                newSearchType = "Vector";
            } else {
                newSearchType = "Element";
            }

            setSearchType(newSearchType);
            initialSearchTypeSetRef.current = true;
        }
    }, [metadata, isImageEmbedding, isTextEmbedding, setSearchType, supportsEmbeddings])

    // Debug logging for results
    useEffect(() => {
        if (results && results.length > 0) {
            console.log(`SearchBox received ${results.length} results`)
            console.log("First result sample:", results[0])
        }
    }, [results])

    // Save settings when they change
    useEffect(() => {
        userSettings.set("showFilters", showFilters)
    }, [showFilters])

    useEffect(() => {
        userSettings.set("showRedisCommand", showRedisCommand)
    }, [showRedisCommand])

    // Add a useEffect to log when the executedCommand changes
    useEffect(() => {
        //console.log("Executed command updated:", executedCommand);
    }, [executedCommand])

    // Handle image embedding generation
    const handleImageSelect = (base64Data: string) => {
        setSearchQuery(base64Data)
    }

    const handleImageEmbeddingGenerated = (embedding: number[]) => {
        // Store the embedding
        setLastImageEmbedding(embedding)
        
        // Set search query to a vector representation (needed for the search)
        setSearchQuery(embedding.join(", "))
    }

    return (
        <section className="mb-2">
            <div className="bg-white p-4 rounded shadow-md flex flex-col gap-2 items-start">
                <div className="flex gap-2 items-center w-full justify-between">
                    <div className="flex gap-2 items-center w-full">
                        <label className="text-sm font-medium text-gray-700">
                            Search by
                        </label>
                        <Select
                            defaultValue={searchType}
                            value={searchType}
                            onValueChange={(value) => {
                                // Clear search query when switching between search types
                                if (value !== searchType) {
                                    setSearchQuery('');
                                }
                                setSearchType(value as "Vector" | "Element" | "Image");
                            }}
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
                                    onChange={(e) =>
                                        setSearchCount(e.target.value)
                                    }
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
                                    Show Attribute Filters
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
                            <DropdownMenuItem
                                onClick={() => setShowSearchOptions(true)}
                            >
                                <div className="flex items-center justify-between w-full">
                                    Search Options
                                </div>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-col gap-2 grow w-full">
                    {searchType === "Image" ? (
                        // Show ImageUploader for Image search type
                        <ImageUploader 
                            onImageSelect={handleImageSelect}
                            onEmbeddingGenerated={handleImageEmbeddingGenerated}
                            config={metadata?.embedding?.image || { model: "mobilenet" }}
                            className="w-full"
                            allowMultiple={false}
                        />
                    ) : (
                        // Show regular search input for other types
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
                                className={`h-9 ${
                                    showFilters
                                        ? "bg-gray-500 hover:bg-gray-600 text-white"
                                        : "bg-white hover:bg-gray-100"
                                }`}
                                onClick={() => setShowFilters(!showFilters)}
                            >
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    {showFilters && (
                        <div className="flex gap-2 items-center w-full mt-2">
                            <div className="grow relative">
                                <SmartFilterInput
                                    value={localFilter}
                                    onChange={handleFilterChange}
                                    results={results}
                                    placeholder="Enter filter (e.g. .year < 1982)."
                                    error={
                                        error
                                            ? error.includes(
                                                  "syntax error in FILTER"
                                              )
                                            : false
                                    }
                                    onHelp={() => setShowFilterHelp(true)}
                                    vectorSetName={vectorSetName}
                                />
                            </div>
                        </div>
                    )}

                    {/* Display search error */}
                    {error && error.includes("syntax error in FILTER") && (
                        <div className="text-red-500 text-sm mt-2 w-full">
                            {error}
                        </div>
                    )}
                </div>
            {/* Use the new RedisCommandBox component */}
                {showRedisCommand && (
            <div className="bg-white w-full px-2 py-2 rounded border-t border-gray-200 flex flex-col gap-2 items-start mt-2">
                <div className="flex items-center w-full">
                    <label className="text-sm font-medium text-gray-700">
                        Redis Command
                    </label>
                    <div className="grow"></div>
                    <Button variant="ghost" size="icon" onClick={() => setShowRedisCommand(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <RedisCommandBox
                    vectorSetName={vectorSetName}
                    dim={dim}
                    executedCommand={executedCommand}
                    searchQuery={searchQuery}
                    searchFilter={localFilter}
                    showRedisCommand={showRedisCommand}
                    setShowRedisCommand={setShowRedisCommand}
                    />
                </div>
            )}
            </div>

            {/* Filter Help Dialog */}
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

            {/* Search Options Dialog */}
            <Dialog
                open={showSearchOptions}
                onOpenChange={setShowSearchOptions}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold">
                            Search Options
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label htmlFor="custom-ef">
                                        Custom Build Exploration Factor (EF)
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Enable to set a custom HNSW expansion
                                        factor
                                    </p>
                                </div>
                                <Switch
                                    id="custom-ef"
                                    checked={useCustomEF}
                                    onCheckedChange={handleEFToggle}
                                />
                            </div>

                            {useCustomEF && (
                                <div className="space-y-2">
                                    <Label htmlFor="ef-value">EF Value</Label>
                                    <Input
                                        id="ef-value"
                                        type="number"
                                        value={efValue}
                                        onChange={(e) =>
                                            handleEFValueChange(e.target.value)
                                        }
                                        min="1"
                                        className="w-full"
                                    />
                                    <p className="text-sm text-gray-500">
                                        The Expansion Factor (EF) controls the
                                        search quality in HNSW graphs. Higher
                                        values (100-500) improve search quality
                                        at the cost of performance. Lower values
                                        (10-50) prioritize speed over accuracy.
                                        The default value of 200 provides a good
                                        balance.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    )
}
