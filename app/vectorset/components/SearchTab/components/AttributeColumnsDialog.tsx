import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { AttributeColumnsDialogProps } from "../types"

export default function AttributeColumnsDialog({
    isOpen,
    onClose,
    columns,
    onToggleColumn,
}: AttributeColumnsDialogProps) {
    const attributeColumns = columns.filter((col) => col.type === "attribute")

    // Add handlers for select all and deselect all
    const handleSelectAll = () => {
        attributeColumns.forEach((col) => {
            if (!col.visible) {
                onToggleColumn(col.name, true)
            }
        })
    }

    const handleDeselectAll = () => {
        attributeColumns.forEach((col) => {
            if (col.visible) {
                onToggleColumn(col.name, false)
            }
        })
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Attribute Columns</DialogTitle>
                    <DialogDescription>
                        Select which attribute columns to display in the results
                        table. Your selections will be saved for future
                        sessions.
                    </DialogDescription>
                </DialogHeader>

                {attributeColumns.length > 0 && (
                    <div className="flex justify-between items-center mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="text-xs"
                        >
                            Select All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDeselectAll}
                            className="text-xs"
                        >
                            Deselect All
                        </Button>
                    </div>
                )}

                <ScrollArea className="h-[50vh] mt-4 pr-4">
                    <div className="space-y-0">
                        {attributeColumns.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                No attribute columns available.
                            </p>
                        ) : (
                            attributeColumns.map((col) => (
                                <div
                                    key={col.name}
                                    className="flex items-center justify-between py-2"
                                >
                                    <Label
                                        htmlFor={`column-${col.name}`}
                                        className="grow"
                                    >
                                        {col.name.charAt(0).toUpperCase() +
                                            col.name.slice(1)}
                                    </Label>
                                    <Switch
                                        id={`column-${col.name}`}
                                        checked={col.visible}
                                        onCheckedChange={(checked) =>
                                            onToggleColumn(col.name, checked)
                                        }
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>

                <div className="mt-6 flex justify-end">
                    <Button onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
} 