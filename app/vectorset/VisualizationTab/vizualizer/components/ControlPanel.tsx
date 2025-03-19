import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import React from "react"
import type * as THREE from "three"

interface ControlPanelProps {
    selectedNode: THREE.Mesh | null
    isDarkMode: boolean
    showLines: boolean
    isCardPinned: boolean
    isCardCollapsed: boolean
    onToggleDarkMode: () => void
    onToggleLineVisibility: () => void
    onTogglePin: () => void
    onExpandNode: (
        node: THREE.Mesh,
        skipLayoutReapplication?: boolean
    ) => void | Promise<void>
    onCollapseNode: (node: THREE.Mesh) => void
    onCopyVector: () => void
    onReset: () => void
    onCardMouseEnter: () => void
    onCardMouseLeave: () => void
}

export function ControlPanel({
    selectedNode,
    isDarkMode,
    showLines,
    isCardPinned,
    isCardCollapsed,
    onToggleDarkMode,
    onToggleLineVisibility,
    onTogglePin,
    onExpandNode,
    onCollapseNode,
    onCopyVector,
    onReset,
    onCardMouseEnter,
    onCardMouseLeave,
}: ControlPanelProps) {
    const [isResetDialogOpen, setIsResetDialogOpen] = React.useState(false)

    return (
        <div
            className="node-info-card"
            onMouseEnter={onCardMouseEnter}
            onMouseLeave={onCardMouseLeave}
        >
            <Card>
                {selectedNode && (
                    <div>
                        <CardHeader className="py-0 px-2">
                            <div className="flex items-center">
                                <div className="grow"></div>
                                <div className="">Controls</div>
                                <Button
                                    variant={isCardPinned ? "default" : "ghost"}
                                    size="icon"
                                    onClick={onTogglePin}
                                    className="h-8 w-8"
                                >
                                    {isCardPinned ? (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line
                                                x1="12"
                                                y1="17"
                                                x2="12"
                                                y2="22"
                                            />
                                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                        </svg>
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <line
                                                x1="12"
                                                y1="17"
                                                x2="12"
                                                y2="22"
                                            />
                                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                        </svg>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                        {!isCardCollapsed && (
                            <CardContent>
                                <div className="grid gap-2">
                                    <div className="">
                                        <span className="text-sm text-muted-foreground">
                                            Selected:
                                        </span>
                                        <span className="pl-1">
                                            {selectedNode.userData.element}
                                        </span>
                                    </div>

                                    {selectedNode.userData.similarity !==
                                        null && (
                                        <div className="">
                                            <span className="text-sm text-muted-foreground">
                                                Similarity:
                                            </span>
                                            <span className="pl-1">
                                                {selectedNode.userData.similarity?.toFixed(
                                                    4
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex gap-2 mt-2 w-full">
                                        {!selectedNode.userData.expanded && (
                                            <Button
                                                onClick={() =>
                                                    onExpandNode(selectedNode)
                                                }
                                                className="w-full"
                                                variant="outline"
                                            >
                                                Expand Node
                                            </Button>
                                        )}

                                        {selectedNode.userData.expanded &&
                                            selectedNode.userData
                                                .displayState ===
                                                "expanded" && (
                                                <Button
                                                    onClick={() =>
                                                        onCollapseNode(
                                                            selectedNode
                                                        )
                                                    }
                                                    className="w-full"
                                                    variant="outline"
                                                >
                                                    Hide Neighbors
                                                </Button>
                                            )}

                                        {selectedNode.userData.expanded &&
                                            selectedNode.userData
                                                .displayState ===
                                                "collapsed" && (
                                                <Button
                                                    onClick={() =>
                                                        onExpandNode(
                                                            selectedNode
                                                        )
                                                    }
                                                    className="w-full"
                                                    variant="outline"
                                                >
                                                    Show Neighbors
                                                </Button>
                                            )}

                                        <Button
                                            onClick={onCopyVector}
                                            className="w-full"
                                            variant="outline"
                                        >
                                            Copy Vector
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        )}
                    </div>
                )}
                {!isCardCollapsed && (
                    <div className="space-y-4 px-4 pb-4">
                        <div className="flex items-center justify-between">
                            <Label
                                htmlFor="show-lines"
                                className="cursor-pointer"
                            >
                                Show Relationship Lines
                            </Label>
                            <Switch
                                id="show-lines"
                                checked={showLines}
                                onCheckedChange={onToggleLineVisibility}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="dark-mode">Dark Mode</Label>
                                <Switch
                                    id="dark-mode"
                                    checked={isDarkMode}
                                    onCheckedChange={onToggleDarkMode}
                                />
                            </div>
                        </div>
                        <Separator />

                        <Button
                            onClick={() => setIsResetDialogOpen(true)}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                        >
                            Reset Graph
                        </Button>
                    </div>
                )}
            </Card>

            <AlertDialog
                open={isResetDialogOpen}
                onOpenChange={setIsResetDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Graph</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all nodes except the initial one
                            and restart the visualization. Are you sure you want
                            to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                onReset()
                                setIsResetDialogOpen(false)
                            }}
                        >
                            Reset
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <style jsx>{`
                .node-info-card {
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 4px;
                    box-shadow: 0;
                    z-index: 10;
                    max-height: 80vh;
                    overflow-y: auto;
                }
            `}</style>
        </div>
    )
}
