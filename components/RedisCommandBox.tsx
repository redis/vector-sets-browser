import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { useState } from "react"

interface RedisCommandBoxProps {
    vectorSetName: string
    dim: number | null
    executedCommand?: string
    searchQuery: string
    searchFilter: string
    showRedisCommand: boolean
}

export default function RedisCommandBox({
    vectorSetName,
    dim,
    executedCommand,
    searchQuery,
    searchFilter,
    showRedisCommand,
}: RedisCommandBoxProps) {
    const [showFullVector, setShowFullVector] = useState(false);

    // Helper function to get and format the Redis command
    const getRedisCommand = (forClipboard: boolean = false) => {
        // If copying the full command, return as a simple string
        if (forClipboard && executedCommand) {
            return executedCommand;
        }
        // For display purposes, we'll return a structured object
        if (executedCommand) {
            // For display purposes, truncate the vector values
            const valuesMatch = executedCommand.match(/VALUES\s+(\d+)/i);
            if (valuesMatch) {
                // Find the VALUES keyword and the number that follows it
                const valuesToken = "VALUES"
                const valuesIndex = executedCommand.indexOf(valuesToken);
                const countStr = valuesMatch[1];
                const countNum = parseInt(countStr);

                if (!isNaN(countNum) && countNum > 2) {
                    // Find the beginning of the number sequence
                    const valuesList = executedCommand.substring(valuesIndex);
                    const numberEndIndex = valuesList.indexOf(countStr) + countStr.length;
                    const valuesStart = valuesIndex + numberEndIndex;

                    // Skip initial whitespace
                    let startPos = valuesStart;
                    while (startPos < executedCommand.length && /\s/.test(executedCommand[startPos])) {
                        startPos++;
                    }

                    // Continue past any numeric values to find where non-numeric content begins
                    let currentPos = startPos;

                    // Continue past all numeric values
                    while (currentPos < executedCommand.length) {
                        // Skip whitespace
                        while (currentPos < executedCommand.length && /\s/.test(executedCommand[currentPos])) {
                            currentPos++;
                        }

                        // Check if we're looking at a number
                        const isNumberStart = /[\d\.\-]/.test(executedCommand[currentPos]);

                        if (!isNumberStart) {
                            // Found non-numeric content, we're done
                            break;
                        }

                        // Skip this number
                        while (currentPos < executedCommand.length &&
                            !/\s/.test(executedCommand[currentPos])) {
                            currentPos++;
                        }
                    }

                    // Extract parts
                    const prefix = executedCommand.substring(0, startPos);
                    const allVectors = executedCommand.substring(startPos, currentPos).trim();
                    const suffix = currentPos < executedCommand.length ? executedCommand.substring(currentPos) : "";

                    // Return a structured result for display
                    return {
                        type: 'structured',
                        prefix: prefix,
                        vectors: allVectors,
                        suffix: suffix
                    };
                }
            }

            // If we couldn't parse the structure, return the original command as a string
            return { type: 'simple', text: executedCommand };
        }

        // If no executed command yet, show a loading message
        if (searchQuery || searchFilter) {
            return { type: 'simple', text: "Searching..." };
        }

        // Default fallback for initial state
        return {
            type: 'simple',
            text: ``
        };
    }

    if (!showRedisCommand) return null;

    return (
        <div className="flex gap-2 items-center w-full bg-gray-100 rounded-md">
            <div className="text-muted-foreground p-1 font-mono overflow-x-scroll text-sm grow">
                {(() => {
                    const commandData = getRedisCommand(false);
                    if (!commandData) {
                        return "Enter search parameters to see the Redis command";
                    }

                    if (typeof commandData === 'string') {
                        return commandData;
                    }

                    if (commandData.type === 'simple') {
                        return commandData.text;
                    }

                    // Render structured command
                    return (
                        <div className="text-muted-foreground font-mono text-xs">
                            {commandData.prefix}
                            {showFullVector ? (
                                <span 
                                    className="inline-flex border border-gray-300 p-0.5 items-center rounded mx-1 cursor-pointer hover:bg-gray-100"
                                    onClick={() => setShowFullVector(false)}
                                    title="Click to collapse vector values"
                                >
                                    {commandData.vectors}
                                </span>
                            ) : (
                                <span
                                    className="inline-flex border border-gray-300 p-0.5 items-center rounded mx-1"
                                    title="Vector values truncated, click to see the whole vector"
                                >
                                    <span className="max-w-[75px] overflow-hidden whitespace-nowrap relative">
                                        {commandData.vectors}
                                        <span className="absolute inset-y-0 right-0 w-8 bg-linear-to-r from-transparent to-gray-100"></span>
                                    </span>
                                    <span 
                                        className="text-black rounded-r cursor-pointer hover:bg-gray-200 px-1"
                                        onClick={() => setShowFullVector(true)}
                                    >
                                        ...
                                    </span>
                                </span>
                            )}
                            {commandData.suffix}
                        </div>
                    );
                })()}
            </div>
            <div className="grow"></div>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500 mr-2"
                onClick={() => {
                    const command = getRedisCommand(true)
                    navigator.clipboard.writeText(typeof command === 'string' ? command : executedCommand || '')
                }}
            >
                <Copy className="h-4 w-4" />
            </Button>
        </div>
    )
} 