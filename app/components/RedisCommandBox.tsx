import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { useEffect } from "react"

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

    // Helper function to get and format the Redis command
    const getRedisCommand = (includeFullEmbedding: boolean = false) => {
        // If copying the full command, return as a simple string
        if (includeFullEmbedding && executedCommand) {
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
            <div className="text-grey-400 p-2 font-mono overflow-x-scroll text-sm grow">
                {(() => {
                    const commandData = getRedisCommand();
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
                        <div className="text-gray-500 font-mono text-xs">
                            {commandData.prefix}
                            <span
                                className="inline-flex items-center bg-yellow-50 rounded mx-1"
                                title="Vector values truncated, click copy to see the whole command"
                            >
                                <span className="px-1 max-w-[100px] overflow-hidden whitespace-nowrap relative">
                                    {commandData.vectors}
                                    <span className="absolute inset-y-0 right-0 w-8 bg-linear-to-r from-transparent to-yellow-50"></span>
                                </span>
                                <span className="text-yellow-800 px-1 bg-yellow-50 rounded-r">...</span>
                            </span>
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

            {/* <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-gray-500"
                onClick={() => setShowRedisCommand(false)}
            >
                <X className="h-4 w-4" />
            </Button> */}
        </div>
    )
} 