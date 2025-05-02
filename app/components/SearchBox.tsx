import { isImageEmbedding, isMultiModalEmbedding, isTextEmbedding } from "@/app/embeddings/types/embeddingModels"
import { type VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { userSettings } from "@/app/utils/userSettings"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
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
import { useEffect, useMemo, useRef, useState, useCallback } from "react"

import { VectorTuple } from "@/app/redis-server/api"
import ImageUploader from "./ImageUploader"
import RedisCommandBox from "./RedisCommandBox"
import SmartFilterInput from "./SmartFilterInput"

const searchTypes = [
    {
        value: "Vector",
        label: "Text or Vector",
    },
    {
        value: "Image",
        label: "Image",
    },
    {
        value: "Element",
        label: "Element",
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
    searchExplorationFactor?: number
    setSearchExplorationFactor?: (value: number | undefined) => void
    filterExplorationFactor?: number
    setFilterExplorationFactor?: (value: number | undefined) => void
    forceLinearScan: boolean
    setForceLinearScan: (value: boolean) => void
    noThread: boolean
    setNoThread: (value: boolean) => void
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
    searchExplorationFactor,
    setSearchExplorationFactor,
    filterExplorationFactor,
    setFilterExplorationFactor,
    forceLinearScan,
    setForceLinearScan,
    noThread,
    setNoThread,
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
    const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const [localForceLinearScan, setLocalForceLinearScan] = useState(forceLinearScan) 
    const [localNoThread, setLocalNoThread] = useState(noThread)
    // State for custom exploration factor
    const [useCustomEF, setUseCustomEF] = useState(() => {
        // Initialize from userSettings instead of props
        return userSettings.get("useCustomEF") ?? false
    })
    const [efValue, setEFValue] = useState(() => {
        // Initialize from userSettings instead of props
        return userSettings.get("efValue") ?? "200"
    })

    // Add a ref to track if we've initialized the search type
    const initialSearchTypeSetRef = useRef(false)

    // State for custom filter exploration factor
    const [useCustomFilterEF, setUseCustomFilterEF] = useState(() => {
        // Initialize from userSettings instead of props
        return userSettings.get("useCustomFilterEF") ?? false
    })
    const [filterEFValue, setFilterEFValue] = useState(() => {
        // Initialize from userSettings instead of props
        return userSettings.get("filterEFValue") ?? "100"
    })

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

    // Create a single function to handle search option changes and trigger search
    const triggerSearchAfterOptionChange = useCallback(() => {
        
        // To ensure we force a search update, we'll add a small character to the end of the query
        // and then immediately restore it.
        const triggerChar = searchQuery.endsWith(" ") ? "x" : " ";
        const originalQuery = searchQuery;
        
        // Modify the query to force update
        setSearchQuery(originalQuery + triggerChar);
        
        // Restore the original query after a small delay
        setTimeout(() => {
            setSearchQuery(originalQuery);
        }, 500);
    }, [searchQuery, setSearchQuery]);

    // Handle exploration factor changes - modified to always trigger a search
    const handleEFToggle = (checked: boolean) => {
        console.log("EF toggle changed:", checked);
        
        setUseCustomEF(checked);
        
        if (setSearchExplorationFactor) {
            if (checked) {
                const value = parseInt(efValue);
                const efNumber = isNaN(value) ? 200 : value;
                setSearchExplorationFactor(efNumber);
            } else {
                setSearchExplorationFactor(undefined);
            }
            // Always trigger the search when toggling, regardless of direction
            triggerSearchAfterOptionChange();
        }
    }
    
    const handleEFValueChange = (value: string) => {
        if (value === efValue) return; // Skip if no change
        
        setEFValue(value);
        if (setSearchExplorationFactor && useCustomEF) {
            const numValue = parseInt(value);
            const efNumber = isNaN(numValue) ? 200 : numValue;
            setSearchExplorationFactor(efNumber);
            triggerSearchAfterOptionChange();
        }
    }

    // Handle filter exploration factor changes - modified to always trigger a search
    const handleFilterEFToggle = (checked: boolean) => {
        console.log("Filter EF toggle changed:", checked);
        
        setUseCustomFilterEF(checked);
        
        if (setFilterExplorationFactor) {
            if (checked) {
                const value = parseInt(filterEFValue);
                const efNumber = isNaN(value) ? 100 : value;
                setFilterExplorationFactor(efNumber);
            } else {
                setFilterExplorationFactor(undefined);
            }
            // Always trigger the search when toggling, regardless of direction
            triggerSearchAfterOptionChange();
        }
    }

    const handleFilterEFValueChange = (value: string) => {
        if (value === filterEFValue) return; // Skip if no change
        
        setFilterEFValue(value);
        if (setFilterExplorationFactor && useCustomFilterEF) {
            const numValue = parseInt(value);
            const efNumber = isNaN(numValue) ? 100 : numValue;
            setFilterExplorationFactor(efNumber);
            triggerSearchAfterOptionChange();
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

    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    const filteredSearchTypes = searchTypes.filter((type) => {
        if (isMultiModalEmbedding(metadata?.embedding)) {
            return true
        }
        if (type.value === "Image" && !isImageEmbedding(metadata?.embedding)) {
            return false
        }
        return true
    })

    // Compute the placeholder text based on current searchType and metadata
    const searchBoxPlaceholder = useMemo(() => {
        if (!metadata?.embedding) return ""

        switch (searchType) {
            case "Element":
                return "Enter Element"
            case "Image":
                return "Enter image data"
            case "Vector":
                return supportsEmbeddings && isTextEmbedding(metadata.embedding)
                    ? "Enter search text or vector data (0.1, 0.2, ...)"
                    : "Enter vector data (0.1, 0.2, ...)"
            default:
                return ""
        }
    }, [searchType, supportsEmbeddings, metadata?.embedding])

    // set default searchType only when metadata changes
    useEffect(() => {
        if (!metadata) return // Don't set defaults if no metadata

        // Only set default on first metadata load
        if (supportsEmbeddings && !initialSearchTypeSetRef.current) {
            // Choose appropriate default search type based on embedding format
            let newSearchType: "Vector" | "Element" | "Image"

            if (isImageEmbedding(metadata.embedding)) {
                newSearchType = "Image"
            } else if (isTextEmbedding(metadata.embedding)) {
                newSearchType = "Vector"
            } else if (isMultiModalEmbedding(metadata.embedding)) {
                newSearchType = "Vector"
            } else {
                newSearchType = "Element"
            }

            setSearchType(newSearchType)
            initialSearchTypeSetRef.current = true
        }
    }, [metadata, setSearchType, supportsEmbeddings])

    // Save settings to localStorage when they change
    useEffect(() => {
        userSettings.set("showFilters", showFilters)
    }, [showFilters])

    useEffect(() => {
        userSettings.set("showRedisCommand", showRedisCommand)
    }, [showRedisCommand])

    // Save search settings to localStorage
    useEffect(() => {
        userSettings.set("useCustomEF", useCustomEF)
    }, [useCustomEF])

    useEffect(() => {
        userSettings.set("efValue", efValue)
    }, [efValue])
    
    // Add missing useEffect for useCustomFilterEF
    useEffect(() => {
        userSettings.set("useCustomFilterEF", useCustomFilterEF)
    }, [useCustomFilterEF])
    
    useEffect(() => {
        userSettings.set("filterEFValue", filterEFValue)
    }, [filterEFValue])

    // Initialize props from localStorage on component mount - only runs once
    const isFirstRun = useRef(true);
    useEffect(() => {
        // Only run once on mount to initialize the props
        if (!isFirstRun.current) return;
        isFirstRun.current = false;
        
        // Set initial values for props from localStorage
        if (setSearchExplorationFactor && useCustomEF) {
            const value = parseInt(efValue)
            const efNumber = isNaN(value) ? 200 : value
            setSearchExplorationFactor(efNumber)
        } else if (setSearchExplorationFactor) {
            setSearchExplorationFactor(undefined)
        }

        if (setFilterExplorationFactor && useCustomFilterEF) {
            const value = parseInt(filterEFValue)
            const efNumber = isNaN(value) ? 100 : value
            setFilterExplorationFactor(efNumber)
        } else if (setFilterExplorationFactor) {
            setFilterExplorationFactor(undefined)
        }
        
        // Also ensure forceLinearScan and noThread are initialized from props
        if (setForceLinearScan) {
            const stored = userSettings.get("forceLinearScan") ?? false;
            if (stored !== forceLinearScan) {
                setForceLinearScan(stored);
            }
        }
        
        if (setNoThread) {
            const stored = userSettings.get("noThread") ?? false;
            if (stored !== noThread) {
                setNoThread(stored);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Since forceLinearScan and noThread settings come in as props, we'll use these useEffects
    // to save them to localStorage when they change
    useEffect(() => {
        userSettings.set("forceLinearScan", forceLinearScan);
    }, [forceLinearScan]);

    useEffect(() => {
        userSettings.set("noThread", noThread);
    }, [noThread]);

    // Handle image embedding generation
    const handleImageSelect = (base64Data: string) => {
        setSearchType("Image")  // Set search type to Image when an image is selected
        setSearchQuery(base64Data)
    }

    const handleImageEmbeddingGenerated = (embedding: number[]) => {
        // Set search query to a vector representation (needed for the search)
        setSearchQuery(embedding.join(", "))
    }
    const handleForceLinearScanToggle = (checked: boolean) => {
        setLocalForceLinearScan(checked)
        setForceLinearScan(checked)
        
        userSettings.set("forceLinearScan", checked)
        triggerSearchAfterOptionChange()
    }
    const handleNoThreadToggle = (checked: boolean) => {
        setLocalNoThread(checked)
        setNoThread(checked)
        userSettings.set("noThread", checked)
        triggerSearchAfterOptionChange()
    }

    const handleDoneButtonClick = () => {
        triggerSearchAfterOptionChange()
        
        setShowSearchOptions(false)
    }

    return (
        <section className="mb-2">
            <div className="bg-[white] p-4 rounded shadow-md flex flex-col gap-2 items-start">
                <div className="flex gap-2 items-center w-full justify-between overflow-hidden">
                    <div className="flex gap-2 items-center">
                        <label className="text-sm font-medium text-gray-700">
                            Search by
                        </label>
                        <Select
                            defaultValue={searchType}
                            value={searchType}
                            onValueChange={(value) => {
                                // Clear search query when switching between search types
                                if (value !== searchType) {
                                    setSearchQuery("")
                                }
                                setSearchType(
                                    value as "Vector" | "Element" | "Image"
                                )
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
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
                            <div className="flex items-center gap-1">
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
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0"
                            >
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
                            config={metadata?.embedding}
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
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
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
                                        : "bg-[white] hover:bg-gray-100"
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
                                    vectorSetName={vectorSetName}
                                    clearError={clearError}
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
                    <div className="bg-[white] w-full px-2 py-2 rounded border-t border-gray-200 flex flex-col items-start mt-2">
                        <div className="flex items-center w-full">
                            <label className="text-xs font-medium text-gray-500">
                                Redis Command 
                            </label>
                            
                            <div className="grow"></div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowRedisCommand(false)}
                            >
                                <X className="h-4 w-4 text-gray-500" />
                            </Button>
                        </div>
                        <RedisCommandBox
                            vectorSetName={vectorSetName}
                            dim={dim}
                            executedCommand={executedCommand}
                            searchQuery={searchQuery}
                            searchFilter={localFilter}
                            showRedisCommand={showRedisCommand}
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
                <DialogContent className="max-w-2xl">
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
                                        Custom Search Exploration Factor (EF)
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Enable to set a custom HNSW exploration
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
                                        The Exploration Factor (EF) controls the
                                        search quality in HNSW graphs. Higher
                                        values (100-500) improve search quality
                                        at the cost of performance. Lower values
                                        (10-50) prioritize speed over accuracy.
                                        The default value of 200 provides a good
                                        balance.
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-0.5">
                                    <Label htmlFor="custom-filter-ef">
                                        Custom Filter Exploration Factor
                                        (FILTER-EF)
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Enable to set a custom filter
                                        exploration factor
                                    </p>
                                </div>
                                <Switch
                                    id="custom-filter-ef"
                                    checked={useCustomFilterEF}
                                    onCheckedChange={handleFilterEFToggle}
                                />
                            </div>

                            {useCustomFilterEF && (
                                <div className="space-y-2">
                                    <Label htmlFor="filter-ef-value">
                                        Filter EF Value
                                    </Label>
                                    <Input
                                        id="filter-ef-value"
                                        type="number"
                                        value={filterEFValue}
                                        onChange={(e) =>
                                            handleFilterEFValueChange(
                                                e.target.value
                                            )
                                        }
                                        min="1"
                                        className="w-full"
                                    />
                                    {/* <div className="text-sm text-gray-500 space-y-2">
                                        <p>
                                            The Filter Exploration Factor
                                            (FILTER-EF) affects search quality
                                            when using filters:
                                        </p>
                                        <ul className="list-disc pl-5 space-y-1">
                                            <li>
                                                For highly selective filters
                                                (few matches), use a higher
                                                value
                                            </li>
                                            <li>
                                                For less selective filters, the
                                                default is usually sufficient
                                            </li>
                                            <li>
                                                Very selective filters with low
                                                values may return fewer items
                                                than requested
                                            </li>
                                            <li>
                                                Extremely high values may impact
                                                performance without significant
                                                benefit
                                            </li>
                                        </ul>
                                        <p className="pt-2">
                                            The optimal value depends on your
                                            filter selectivity, data
                                            distribution, and required recall
                                            quality. Start with the default and
                                            increase if needed when you observe
                                            fewer results than expected.
                                        </p>
                                    </div> */}
                                </div>
                            )}

                            {/* Force Linear Scan */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-0.5">
                                    <Label htmlFor="force-linear-scan">
                                        Force Linear Scan (TRUTH)
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Forces the command to perform a linear
                                        scan of all entries, without using the
                                        graph O(N)
                                    </p>
                                </div>
                                <Switch
                                    id="force-linear-scan"
                                    checked={localForceLinearScan}
                                    onCheckedChange={handleForceLinearScanToggle}
                                />
                            </div>

                            {/* No Threading */}
                            <div className="flex items-center justify-between pt-4 border-t">
                                <div className="space-y-0.5">
                                    <Label htmlFor="no-thread">
                                        No Threading (NOTHREAD)
                                    </Label>
                                    <p className="text-sm text-gray-500">
                                        Forces main thread execution. Normally{" "}
                                        <code>VSIM</code> spawns a thread
                                        instead.
                                    </p>
                                </div>
                                <Switch
                                    id="no-thread"
                                    checked={localNoThread}
                                    onCheckedChange={handleNoThreadToggle}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleDoneButtonClick}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    )
}
