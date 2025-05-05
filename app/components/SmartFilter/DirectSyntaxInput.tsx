import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X } from "lucide-react"
import React, { useEffect, useRef } from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import AttributeDropdown from "./AttributeDropdown"

interface DirectSyntaxInputProps {
    inputValue: string
    setInputValue: (value: string) => void
    onChange: (value: string) => void
    placeholder?: string
    error?: boolean
    currentInput: string
    setCurrentInput: (value: string) => void
    showDropdown: boolean
    setShowDropdown: (show: boolean) => void
    cursorPosition: number
    setCursorPosition: (position: number) => void
    availableAttributes: string[]
    isLoadingAttributes: boolean
    selectedIndex: number
    setSelectedIndex: (index: number) => void
    handleSelect: (attribute: string) => void
    className?: string
}

export default function DirectSyntaxInput({
    inputValue,
    setInputValue,
    onChange,
    placeholder = "Enter a search filter (e.g. .year < 1982)",
    error,
    currentInput,
    setCurrentInput,
    showDropdown,
    setShowDropdown,
    cursorPosition,
    setCursorPosition,
    availableAttributes,
    isLoadingAttributes,
    selectedIndex,
    setSelectedIndex,
    handleSelect,
    className,
}: DirectSyntaxInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    }

    // Handle keyboard navigation of dropdown
    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Filter attributes based on current input
        const filteredAttributes = availableAttributes.filter((attr) =>
            attr.toLowerCase().includes(currentInput.toLowerCase())
        )

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
    }

    // When cursor position changes due to user input, update our tracked position
    const handleSelectionChange = () => {
        if (inputRef.current) {
            const position = inputRef.current.selectionStart || 0
            setCursorPosition(position)
        }
    }

    // Clear filter
    const clearFilter = () => {
        setInputValue("")
        onChange("")
    }

    // Reset selectedIndex when dropdown visibility changes
    useEffect(() => {
        if (showDropdown) {
            setSelectedIndex(0)
        }
    }, [showDropdown, setSelectedIndex])

    return (
        <div className="relative w-full">
            <div className="relative w-full">
                <Input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onSelect={handleSelectionChange}
                    placeholder={placeholder}
                    className={`${error ? "border-red-500" : ""} ${
                        className || ""
                    } pr-12`}
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
                                        onClick={clearFilter}
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
                </div>
            </div>

            {/* Attribute Dropdown */}
            <AttributeDropdown
                show={showDropdown}
                attributes={availableAttributes}
                currentInput={currentInput}
                selectedIndex={selectedIndex}
                isLoading={isLoadingAttributes}
                onSelect={handleSelect}
            />
        </div>
    )
} 