import { VectorTuple, vgetattr_multi } from "@/app/redis-server/api"
import { generateFilterQuery } from "@/app/api/openai"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import {
    AlertCircle,
    HelpCircle,
    Loader2,
    Sparkles,
    Terminal,
    X,
} from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { div } from "@tensorflow/tfjs"

interface SmartFilterInputProps {
    value: string
    onChange: (value: string) => void
    results: VectorTuple[]
    placeholder?: string
    className?: string
    error?: boolean
    vectorSetName?: string
}

export default function SmartFilterInput({
    value,
    onChange,
    results,
    placeholder = "Enter a search filter (e.g. .year < 1982)",
    className,
    error: propError,
    vectorSetName,
}: SmartFilterInputProps) {
    const [inputValue, setInputValue] = useState(value)
    const [cursorPosition, setCursorPosition] = useState(0)
    const [availableAttributes, setAvailableAttributes] = useState<string[]>([])
    const [currentInput, setCurrentInput] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const [isLoadingAttributes, setIsLoadingAttributes] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [selectedIndex, setSelectedIndex] = useState<number>(0)
    const selectedItemRef = useRef<HTMLButtonElement>(null)

    // Natural language query support
    const [activeTab, setActiveTab] = useState("natural")
    const [nlQuery, setNlQuery] = useState("")
    const [isProcessingNL, setIsProcessingNL] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Extract available attributes from search results
    useEffect(() => {
        const fetchAttributes = async () => {
            if (!results || results.length === 0 || !vectorSetName) {
                return
            }

            setIsLoadingAttributes(true)
            const attributes = new Set<string>()

            try {
                // Extract elements from results
                const elements = results.map((result) => result[0])

                // Fetch attributes using vgetattr_multi
                const response = await vgetattr_multi({
                    keyName: vectorSetName,
                    elements,
                    returnCommandOnly: false,
                })
                if (!response || !response.success) {
                    return
                }
                const attributesResults = response.result

                if (attributesResults && attributesResults.length > 0) {
                    // Process each attribute JSON string
                    attributesResults.forEach((attributeJson) => {
                        if (attributeJson) {
                            try {
                                const attributeObj = JSON.parse(attributeJson)

                                if (
                                    attributeObj &&
                                    typeof attributeObj === "object"
                                ) {
                                    Object.keys(attributeObj).forEach((key) => {
                                        attributes.add(key)
                                    })
                                }
                            } catch (error) {
                                console.error(
                                    "Error parsing attribute JSON:",
                                    error
                                )
                            }
                        }
                    })
                }
            } catch (error) {
                console.error("Error fetching attributes:", error)
                // Fallback: try to extract from the results directly
                extractAttributesFromResults(results, attributes)
            }

            // Add manually discovered attributes from filter input
            const filterMatches =
                value.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)/g) || []
            filterMatches.forEach((match) => {
                const attr = match.substring(1) // Remove the leading dot
                attributes.add(attr)
            })

            const attributesArray = Array.from(attributes)
            setAvailableAttributes(attributesArray)
            setIsLoadingAttributes(false)
        }

        fetchAttributes()
    }, [results, value, vectorSetName])

    // Helper function to extract attributes from results directly (fallback)
    const extractAttributesFromResults = (
        results: VectorTuple[],
        attributes: Set<string>
    ) => {
        results.forEach((result) => {
            // VectorTuple format: [element, score, vector?, attributes?]
            // The attributes are in the 4th position (index 3)
            if (result && result.length >= 4) {
                const attributesData = result[3]

                if (typeof attributesData === "string") {
                    try {
                        const attributesObj = JSON.parse(attributesData)

                        if (
                            attributesObj &&
                            typeof attributesObj === "object"
                        ) {
                            Object.keys(attributesObj).forEach((key) => {
                                attributes.add(key)
                            })
                        }
                    } catch (error) {
                        console.error("Error parsing attributes string:", error)

                        // If JSON parsing fails, try to extract attributes using regex
                        try {
                            const attrRegex = /['"]([\w\d_]+)['"]:\s*([^,}]+)/g
                            let match

                            while (
                                (match = attrRegex.exec(attributesData)) !==
                                null
                            ) {
                                const [_, key] = match
                                attributes.add(key)
                            }
                        } catch (regexError) {
                            console.error(
                                "Regex extraction failed:",
                                regexError
                            )
                        }
                    }
                } else if (
                    typeof attributesData === "object" &&
                    attributesData !== null
                ) {
                    if (attributesData && typeof attributesData === "object") {
                        Object.keys(attributesData).forEach((key) => {
                            attributes.add(key)
                        })
                    }
                }
            }
        })
    }

    // Update input value when the external value changes
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // Process natural language query
    const processNaturalLanguage = async () => {
        if (!nlQuery.trim()) return

        setIsProcessingNL(true)
        setError(null)

        try {
            const result = await generateFilterQuery(
                nlQuery,
                availableAttributes
            )

            // Update filter value
            const filterQuery = result.filterQuery

            // Validate if the response is a valid filter query (should start with a dot)
            if (!filterQuery.trim().startsWith(".")) {
                // If it's not a valid filter, show it as an error message
                setError(filterQuery)
                setInputValue("")
                onChange("")
            } else {
                // Valid filter query
                setInputValue(filterQuery)
                onChange(filterQuery)
            }
        } catch (err) {
            setError(
                "Failed to process natural language query. Please try again or use direct syntax."
            )
            console.error(err)
        } finally {
            setIsProcessingNL(false)
        }
    }

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (activeTab === "direct") {
            const newValue = e.target.value
            setInputValue(newValue)
            onChange(newValue)

            // Get cursor position
            const position = e.target.selectionStart || 0
            setCursorPosition(position)

            // Extract current attribute being typed
            const textBeforeCursor = newValue.substring(0, position)
            const match = textBeforeCursor.match(/\.([a-zA-Z0-9_]*)$/)

            if (match) {
                setCurrentInput(match[1])
                setShowDropdown(true)
            } else {
                setCurrentInput("")
                setShowDropdown(false)
            }
        } else {
            // Natural language mode
            setNlQuery(e.target.value)
        }
    }

    // Handle selection from the autocomplete menu
    const handleSelect = (attribute: string) => {
        // Find the position of the current attribute in the input
        const textBeforeCursor = inputValue.substring(0, cursorPosition)
        const match = textBeforeCursor.match(/\.([a-zA-Z0-9_]*)$/)

        if (match) {
            const startPos = textBeforeCursor.lastIndexOf("." + match[1])
            const beforeAttr = inputValue.substring(0, startPos)
            const afterAttr = inputValue.substring(cursorPosition)

            // Create new value with the selected attribute
            const newValue = beforeAttr + "." + attribute + afterAttr
            setInputValue(newValue)
            onChange(newValue)

            // Calculate new cursor position
            const newCursorPos = startPos + attribute.length + 1
            setCursorPosition(newCursorPos)

            // Close dropdown
            setShowDropdown(false)

            // Focus the input and set cursor position
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus()
                    inputRef.current.setSelectionRange(
                        newCursorPos,
                        newCursorPos
                    )
                }
            }, 0)
        }
    }

    // Filter attributes based on current input
    const filteredAttributes = availableAttributes.filter((attr) =>
        attr.toLowerCase().includes(currentInput.toLowerCase())
    )

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowDropdown(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    // Handle keyboard events for navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (activeTab === "direct") {
            if (!showDropdown || filteredAttributes.length === 0) {
                return
            }

            // Keep track of current cursor position
            let handled = false

            if (e.key === "Escape") {
                setShowDropdown(false)
                handled = true
            } else if (e.key === "ArrowDown") {
                setSelectedIndex((prev) =>
                    Math.min(prev + 1, filteredAttributes.length - 1)
                )
                handled = true
            } else if (e.key === "ArrowUp") {
                setSelectedIndex((prev) => Math.max(prev - 1, 0))
                handled = true
            } else if (e.key === "Enter" && selectedIndex >= 0) {
                handleSelect(filteredAttributes[selectedIndex])
                handled = true
            }

            // Prevent default for handled keys
            if (handled) {
                e.preventDefault()
                e.stopPropagation()
            }
        } else if (activeTab === "natural" && e.key === "Enter") {
            processNaturalLanguage()
            e.preventDefault()
            e.stopPropagation()
        }
    }

    // When cursor position changes due to user input, update our tracked position
    const handleSelectionChange = () => {
        if (inputRef.current) {
            const position = inputRef.current.selectionStart || 0
            setCursorPosition(position)
        }
    }

    // Effect to scroll selected item into view when it changes
    useEffect(() => {
        if (showDropdown && selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            })
        }
    }, [selectedIndex, showDropdown])

    // Reset selectedIndex when filtered attributes change
    useEffect(() => {
        //setSelectedIndex(0);
    }, [filteredAttributes])

    return (
        <div className="relative w-full">
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
            >
                <div className="flex items-center space-x-2 mb-2">
                    <label className="text-sm font-medium text-gray-700">
                        Filter by
                    </label>{" "}
                    <TabsList className="h-9">
                        <TabsTrigger value="natural" className="text-xs px-3">
                            <Sparkles className="h-3.5 w-3.5 mr-1" />
                            Natural Language
                        </TabsTrigger>
                        <TabsTrigger value="direct" className="text-xs px-3">
                            <Terminal className="h-3.5 w-3.5 mr-1" />
                            Direct Syntax
                        </TabsTrigger>
                    </TabsList>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-9 w-9"
                                        >
                                            <HelpCircle className="h-4 w-4" />
                                            <span className="sr-only">
                                                Filter syntax help
                                            </span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="space-y-2">
                                            <h4 className="font-medium">
                                                Filter Expression Help
                                            </h4>
                                            <p className="text-sm text-muted-foreground">
                                                Redis vector sets supports a
                                                simple but powerful filtering
                                                syntax.
                                            </p>
                                            <div className="text-xs space-y-1">
                                                <p>
                                                    <strong>Arithmetic:</strong>{" "}
                                                    +, -, *, /, % (modulo), **
                                                    (exponentiation)
                                                </p>
                                                <p>
                                                    <strong>Comparison:</strong>{" "}
                                                    &gt;, &gt;=, &lt;, &lt;=,
                                                    ==, !=
                                                </p>
                                                <p>
                                                    <strong>Logical:</strong>{" "}
                                                    and/&&, or/||, !/not
                                                </p>
                                                <p>
                                                    <strong>
                                                        Containment:
                                                    </strong>{" "}
                                                    in
                                                </p>
                                                <p>
                                                    <strong>Grouping:</strong>{" "}
                                                    (...)
                                                </p>
                                                <p>
                                                    <strong>
                                                        Accessing Attributes:
                                                    </strong>{" "}
                                                    Use dot notation
                                                    (.attributeName)
                                                </p>
                                            </div>
                                            <div className="text-xs space-y-1 mt-2">
                                                <p>
                                                    <strong>Examples:</strong>
                                                </p>
                                                <p className="font-mono text-[10px]">
                                                    .year &gt;= 1980 and .year
                                                    &lt; 1990
                                                </p>
                                                <p className="font-mono text-[10px]">
                                                    .genre == {'"'}action{'"'}{" "}
                                                    and .rating &gt; 8.0
                                                </p>
                                                <p className="font-mono text-[10px]">
                                                    .director in [{'"'}Spielberg
                                                    {'"'},{'"'}Nolan{'"'}]
                                                </p>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p className="text-xs">Filter syntax help</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="relative w-full">
                    <Input
                        ref={inputRef}
                        type="text"
                        value={activeTab === "direct" ? inputValue : nlQuery}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onSelect={handleSelectionChange}
                        placeholder={
                            activeTab === "direct"
                                ? placeholder
                                : "Describe what you want to filter in plain English..."
                        }
                        className={`${
                            propError || error ? "border-red-500" : ""
                        } ${className || ""} ${
                            activeTab === "natural" && inputValue
                                ? "pr-20"
                                : "pr-12"
                        }`}
                        disabled={isProcessingNL}
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                        {/* Clear button when a filter is active */}
                        {inputValue && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => {
                                                setInputValue("")
                                                setNlQuery("")
                                                onChange("")
                                            }}
                                        >
                                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="sr-only">
                                                Clear filter
                                            </span>
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p className="text-xs">Clear filter</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Natural language process button */}
                        {activeTab === "natural" && (
                            <>
                                {isProcessingNL ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={processNaturalLanguage}
                                        disabled={
                                            isProcessingNL || !nlQuery.trim()
                                        }
                                    >
                                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                                        <span className="sr-only">
                                            Process natural language
                                        </span>
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{error}</span>
                    </div>
                )}

                {activeTab === "natural" && inputValue && !isProcessingNL && (
                    <div className="flex gap-2 items-center w-full mt-2">
                        <div className="text-xs font-medium">
                            Generated filter:
                        </div>
                        <div className="p-2 bg-muted/75 rounded-md w-full">
                            <div className="flex items-center mb-1 w-full">
                                
                                <div className="text-sm">
                                    {inputValue}
                                </div>
                                <div className="flex-grow"></div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        className="text-sm hover:text-foreground"
                                        onClick={() => setActiveTab("direct")}
                                    >
                                        Edit filter
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-sm hover:text-foreground"
                                        onClick={() => {
                                            setInputValue("")
                                            setNlQuery("")
                                            onChange("")
                                        }}
                                    >
                                        Clear filter
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Tabs>

            {showDropdown && filteredAttributes.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-[white] shadow-lg"
                >
                    <div className="max-h-60 overflow-auto py-1">
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                            Attributes {isLoadingAttributes && "(Loading...)"}
                        </div>
                        {filteredAttributes.map((attr, index) => (
                            <button
                                key={attr}
                                ref={
                                    index === selectedIndex
                                        ? selectedItemRef
                                        : null
                                }
                                className={`block w-full px-4 py-2 text-left text-sm ${
                                    index === selectedIndex
                                        ? "bg-gray-100"
                                        : "hover:bg-gray-100"
                                } focus:outline-hidden`}
                                onClick={() => handleSelect(attr)}
                            >
                                {attr}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Debug information - remove in production */}
            {/* <div className="mt-2 p-2 border rounded bg-gray-50 text-xs whitespace-pre-wrap max-h-40 overflow-auto">
                <strong>Debug:</strong> 
                <br/>
                {debugInfo || "No debug info available"}
            </div> */}
        </div>
    )
}
