import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Loader2, Sparkles, X, Edit, Trash } from "lucide-react"
import React from "react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface NaturalLanguageInputProps {
    nlQuery: string
    setNlQuery: (value: string) => void
    isProcessingNL: boolean
    processNaturalLanguage: () => void
    error: string | null
    generatedFilter: string
    clearFilter: () => void
    switchToDirectMode: () => void
}

export default function NaturalLanguageInput({
    nlQuery,
    setNlQuery,
    isProcessingNL,
    processNaturalLanguage,
    error,
    generatedFilter,
    clearFilter,
    switchToDirectMode,
}: NaturalLanguageInputProps) {
    return (
        <div className="w-full">
            <div className="relative w-full">
                <Input
                    type="text"
                    value={nlQuery}
                    onChange={(e) => setNlQuery(e.target.value)}
                    placeholder="Describe what you want to filter in plain English..."
                    className={`${error ? "border-red-500" : ""} ${
                        generatedFilter ? "pr-20" : "pr-12"
                    }`}
                    disabled={isProcessingNL}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            processNaturalLanguage()
                            e.preventDefault()
                            e.stopPropagation()
                        }
                    }}
                />

                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                    {/* Clear button when a filter is active */}
                    {generatedFilter && (
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

                    {/* Processing indicator or submit button */}
                    {isProcessingNL ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                        <Button
                            variant="ghost"
                            className="text-black"
                            onClick={processNaturalLanguage}
                            disabled={isProcessingNL || !nlQuery.trim()}
                        >
                            <Sparkles className="h-3.5 w-3.5" />
                            <div>Generate</div>
                        </Button>
                    )}
                </div>
            </div>

            {/* Error message */}
            {error && (
                <div className="flex items-center gap-2 mt-2 text-destructive text-xs">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Generated filter display */}
            {generatedFilter && !isProcessingNL && (
                <div className="flex items-center w-full mt-2 ">
                    <div className="text-xs font-medium">Generated filter:</div>
                    <div className="pl-2 pr-1 bg-muted rounded-md w-full">
                        <div className="flex items-center gap-0 w-full">
                            <div className="text-xs font-mono text-muted-foreground">
                                {generatedFilter}
                            </div>
                            <div className="grow"></div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="hover:text-foreground text-muted-foreground"
                                    onClick={switchToDirectMode}
                                >
                                    <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                variant="ghost"
                                    size="icon"
                                    className="hover:text-foreground text-muted-foreground"
                                    onClick={clearFilter}
                                >
                                    <Trash className="h-3 w-3" />
                                </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
