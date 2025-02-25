import { VectorSetMetadata } from "../types/embedding"
import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const searchTypes = [
    {
        value: "Vector",
        label: "Vector",
    },
    {
        value: "Element",
        label: "Element",
    },
]

interface SearchBoxProps {
    searchType: "Vector" | "Element"
    setSearchType: (type: "Vector" | "Element") => void
    searchQuery: string
    setSearchQuery: (query: string) => void
    dim: number | null
    metadata: VectorSetMetadata | null
}

export default function SearchBox({
    searchType,
    setSearchType,
    searchQuery,
    setSearchQuery,
    dim,
    metadata,
}: SearchBoxProps) {
    const [open, setOpen] = React.useState(false)

    return (
        <section className="mb-6">
            <div className="bg-white p-4 rounded shadow-md flex flex-col gap-2 items-start">
                <div className="flex gap-2 items-center w-full">
                    <label className="text-sm font-medium text-gray-700">
                        Search by
                    </label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-[120px] justify-between"
                            >
                                {searchType || "Select type..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[120px] p-0">
                            <Command>
                                <CommandInput placeholder="Search type..." />
                                <CommandList>
                                    <CommandEmpty>No type found.</CommandEmpty>
                                    <CommandGroup>
                                        {searchTypes.map((type) => (
                                            <CommandItem
                                                key={type.value}
                                                value={type.value}
                                                onSelect={(currentValue) => {
                                                    setSearchType(currentValue as "Vector" | "Element")
                                                    setOpen(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        searchType === type.value ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {type.label}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex flex-col gap-2 grow w-full">
                    <div className="relative">
                        <Input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={
                                searchType === "Element"
                                    ? "Enter Element"
                                    : metadata?.embedding?.provider && metadata?.embedding?.provider !== "none"
                                    ? "Enter search text OR Enter raw vector data (0.1, 0.2, ...)"
                                    : "Enter vector data (0.1, 0.2, ...)"
                            }
                            className="border rounded p-3 w-full pr-24"
                        />
                        {searchType === "Vector" && (
                            <button
                                type="button"
                                className="absolute right-0 top-0.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm"
                                onClick={() => {
                                    if (dim) {
                                        const randomVector = Array.from(
                                            { length: dim },
                                            () => Math.random()
                                        ).map((n) => n.toFixed(4))
                                        setSearchQuery(randomVector.join(", "))
                                    }
                                }}
                            >
                                Random
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
} 