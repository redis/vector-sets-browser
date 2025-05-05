import React, { useEffect, useRef } from 'react'

interface AttributeDropdownProps {
    show: boolean
    attributes: string[]
    currentInput: string
    selectedIndex: number
    isLoading: boolean
    onSelect: (attribute: string) => void
}

export default function AttributeDropdown({
    show,
    attributes,
    currentInput,
    selectedIndex,
    isLoading,
    onSelect
}: AttributeDropdownProps) {
    const dropdownRef = useRef<HTMLDivElement>(null)
    const selectedItemRef = useRef<HTMLButtonElement>(null)

    // Filter attributes based on current input
    const filteredAttributes = attributes.filter((attr) =>
        attr.toLowerCase().includes(currentInput.toLowerCase())
    )

    // Effect to scroll selected item into view when it changes
    useEffect(() => {
        if (show && selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            })
        }
    }, [selectedIndex, show])

    if (!show || filteredAttributes.length === 0) {
        return null
    }

    return (
        <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-[white] shadow-lg"
        >
            <div className="max-h-60 overflow-auto py-1">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                    Attributes {isLoading && "(Loading...)"}
                </div>
                {filteredAttributes.map((attr, index) => (
                    <button
                        key={attr}
                        ref={index === selectedIndex ? selectedItemRef : null}
                        className={`block w-full px-4 py-2 text-left text-sm ${
                            index === selectedIndex
                                ? "bg-gray-100"
                                : "hover:bg-gray-100"
                        } focus:outline-hidden`}
                        onClick={() => onSelect(attr)}
                    >
                        {attr}
                    </button>
                ))}
            </div>
        </div>
    )
} 