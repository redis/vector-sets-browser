import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface SearchOptionsDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    
    // EF options
    useCustomEF: boolean
    efValue: string
    handleEFToggle: (checked: boolean) => void
    handleEFValueChange: (value: string) => void
    
    // Filter EF options
    useCustomFilterEF: boolean
    filterEFValue: string
    handleFilterEFToggle: (checked: boolean) => void
    handleFilterEFValueChange: (value: string) => void
    
    // Linear scan option
    forceLinearScan: boolean
    handleForceLinearScanToggle: (checked: boolean) => void
    
    // No thread option
    noThread: boolean
    handleNoThreadToggle: (checked: boolean) => void
    
    // WITHATTRIBS option
    useWithAttribs: boolean
    handleWithAttribsToggle: (checked: boolean) => void
    
    // Done button handler
    onDone: () => void
}

export default function SearchOptionsDialog({
    open,
    onOpenChange,
    useCustomEF,
    efValue,
    handleEFToggle,
    handleEFValueChange,
    useCustomFilterEF,
    filterEFValue,
    handleFilterEFToggle,
    handleFilterEFValueChange,
    forceLinearScan,
    handleForceLinearScanToggle,
    noThread,
    handleNoThreadToggle,
    useWithAttribs,
    handleWithAttribsToggle,
    onDone,
}: SearchOptionsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Search Options
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="custom-ef">
                                    Custom Search Exploration Factor (EF)
                                </Label>
                                <p className="text-sm text-gray-500">
                                    Enable to set a custom HNSW exploration
                                    factor
                                </p>
                            </div>
                            <Switch
                                id="custom-ef"
                                checked={useCustomEF}
                                onCheckedChange={handleEFToggle}
                            />
                        </div>

                        {useCustomEF && (
                            <div className="space-y-2">
                                <Label htmlFor="ef-value">EF Value</Label>
                                <Input
                                    id="ef-value"
                                    type="number"
                                    value={efValue}
                                    onChange={(e) =>
                                        handleEFValueChange(e.target.value)
                                    }
                                    min="1"
                                    className="w-full"
                                />
                                <p className="text-sm text-gray-500">
                                    The Exploration Factor (EF) controls the
                                    search quality in HNSW graphs. Higher
                                    values (100-500) improve search quality
                                    at the cost of performance. Lower values
                                    (10-50) prioritize speed over accuracy.
                                    The default value of 200 provides a good
                                    balance.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="space-y-0.5">
                                <Label htmlFor="custom-filter-ef">
                                    Custom Filter Exploration Factor
                                    (FILTER-EF)
                                </Label>
                                <p className="text-sm text-gray-500">
                                    Enable to set a custom filter
                                    exploration factor
                                </p>
                            </div>
                            <Switch
                                id="custom-filter-ef"
                                checked={useCustomFilterEF}
                                onCheckedChange={handleFilterEFToggle}
                            />
                        </div>

                        {useCustomFilterEF && (
                            <div className="space-y-2">
                                <Label htmlFor="filter-ef-value">
                                    Filter EF Value
                                </Label>
                                <Input
                                    id="filter-ef-value"
                                    type="number"
                                    value={filterEFValue}
                                    onChange={(e) =>
                                        handleFilterEFValueChange(
                                            e.target.value
                                        )
                                    }
                                    min="1"
                                    className="w-full"
                                />
                            </div>
                        )}

                        {/* Force Linear Scan */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="space-y-0.5">
                                <Label htmlFor="force-linear-scan">
                                    Force Linear Scan (TRUTH)
                                </Label>
                                <p className="text-sm text-gray-500">
                                    Forces the command to perform a linear
                                    scan of all entries, without using the
                                    graph O(N)
                                </p>
                            </div>
                            <Switch
                                id="force-linear-scan"
                                checked={forceLinearScan}
                                onCheckedChange={handleForceLinearScanToggle}
                            />
                        </div>

                        {/* No Threading */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="space-y-0.5">
                                <Label htmlFor="no-thread">
                                    No Threading (NOTHREAD)
                                </Label>
                                <p className="text-sm text-gray-500">
                                    Forces main thread execution. Normally{" "}
                                    <code>VSIM</code> spawns a thread
                                    instead.
                                </p>
                            </div>
                            <Switch
                                id="no-thread"
                                checked={noThread}
                                onCheckedChange={handleNoThreadToggle}
                            />
                        </div>

                        {/* WITHATTRIBS */}
                        <div className="flex items-center justify-between pt-4 border-t">
                            <div className="space-y-0.5">
                                <Label htmlFor="use-with-attribs">
                                    Use WITHATTRIBS
                                </Label>
                                <p className="text-sm text-gray-500">
                                    Use the new WITHATTRIBS flag to fetch attributes 
                                    directly with VSIM instead of separate VGETATTR calls. 
                                    Improves performance but falls back to old method if unsupported.
                                </p>
                            </div>
                            <Switch
                                id="use-with-attribs"
                                checked={useWithAttribs}
                                onCheckedChange={handleWithAttribsToggle}
                            />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onDone}>
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
} 