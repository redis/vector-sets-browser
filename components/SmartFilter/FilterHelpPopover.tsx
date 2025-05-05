import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"
import React from "react"

export default function FilterHelpPopover() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                            >
                                <HelpCircle className=" text-gray-500" />
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
    )
} 