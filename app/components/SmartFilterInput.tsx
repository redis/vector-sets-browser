import { VectorTuple } from "@/app/redis-server/api"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Sparkles, Terminal } from "lucide-react"
import { useEffect, useState } from "react"

// Import custom hooks
import useFilterAttributes from "@/app/hooks/useFilterAttributes"
import useNaturalLanguage from "@/app/hooks/useNaturalLanguage"

// Import components
import {
    DirectSyntaxInput,
    FilterHelpPopover,
    NaturalLanguageInput,
} from "./SmartFilter"

interface SmartFilterInputProps {
    value: string
    onChange: (value: string) => void
    results: VectorTuple[]
    placeholder?: string
    className?: string
    error?: boolean
    vectorSetName?: string
    clearError?: () => void
}

export default function SmartFilterInput({
    value,
    onChange,
    results,
    placeholder = "Enter a search filter (e.g. .year < 1982)",
    className,
    error: propError,
    vectorSetName,
    clearError,
}: SmartFilterInputProps) {
    // State for input and UI management
    const [inputValue, setInputValue] = useState(value)
    const [cursorPosition, setCursorPosition] = useState(0)
    const [currentInput, setCurrentInput] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState<number>(0)
    const [activeTab, setActiveTab] = useState("natural")

    // Get attributes from results using custom hook
    const { availableAttributes, isLoadingAttributes } = useFilterAttributes(
        results,
        value,
        vectorSetName
    )

    // Natural language processing using custom hook
    const {
        nlQuery,
        setNlQuery,
        isProcessingNL,
        error,
        setError,
        processNaturalLanguage,
        clearNlQuery,
    } = useNaturalLanguage({
        availableAttributes,
        onChange,
        clearError,
    })

    // Update input value when the external value changes
    useEffect(() => {
        setInputValue(value)
    }, [value])

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
        }
    }

    // Handle tab change
    const updateTab = (value: string) => {
        setActiveTab(value)
        setError(null)
        if (clearError) {
            clearError()
        }
    }

    // Clear all filters
    const clearFilter = () => {
        setInputValue("")
        setNlQuery("")
        onChange("")
    }

    // Switch to direct mode from natural language
    const switchToDirectMode = () => {
        setActiveTab("direct")
    }

    return (
        <div className="relative w-full">
            <Tabs
                value={activeTab}
                onValueChange={updateTab}
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
                    {/* Help popover */}
                    <FilterHelpPopover />
                </div>

                {/* Content based on active tab */}
                {activeTab === "natural" ? (
                    <NaturalLanguageInput
                        nlQuery={nlQuery}
                        setNlQuery={setNlQuery}
                        isProcessingNL={isProcessingNL}
                        processNaturalLanguage={processNaturalLanguage}
                        error={error}
                        generatedFilter={value}
                        clearFilter={clearFilter}
                        switchToDirectMode={switchToDirectMode}
                    />
                ) : (
                    <DirectSyntaxInput
                        inputValue={inputValue}
                        setInputValue={setInputValue}
                        onChange={onChange}
                        placeholder={placeholder}
                        error={propError}
                        currentInput={currentInput}
                        setCurrentInput={setCurrentInput}
                        showDropdown={showDropdown}
                        setShowDropdown={setShowDropdown}
                        cursorPosition={cursorPosition}
                        setCursorPosition={setCursorPosition}
                        availableAttributes={availableAttributes}
                        isLoadingAttributes={isLoadingAttributes}
                        selectedIndex={selectedIndex}
                        setSelectedIndex={setSelectedIndex}
                        handleSelect={handleSelect}
                        className={className}
                    />
                )}

                {/* Error for direct mode */}
                {activeTab === "direct" && propError && (
                    <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>
                            Invalid filter syntax. Please check your expression.
                        </span>
                    </div>
                )}
            </Tabs>
        </div>
    )
}
