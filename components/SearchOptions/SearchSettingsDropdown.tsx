import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Check, Settings } from "lucide-react"

interface SearchSettingsDropdownProps {
    showFilters: boolean
    setShowFilters: (show: boolean) => void
    showRedisCommand: boolean
    setShowRedisCommand: (show: boolean) => void
    setShowSearchOptions: (show: boolean) => void
}

export default function SearchSettingsDropdown({
    showFilters,
    setShowFilters,
    showRedisCommand,
    setShowRedisCommand,
    setShowSearchOptions,
}: SearchSettingsDropdownProps) {
    return (
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
                    onClick={() => setShowRedisCommand(!showRedisCommand)}
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
    )
} 