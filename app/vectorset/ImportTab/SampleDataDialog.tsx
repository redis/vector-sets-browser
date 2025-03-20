"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { SampleDataSelect, SampleDataset } from "./SampleDataSelect"
import { SampleDataImporter } from "./SampleDataImporter"
import { VectorSetMetadata } from "@/app/embeddings/types/config"

interface SampleDataDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    vectorSetName: string
    metadata: VectorSetMetadata | null
    onUpdateMetadata?: (metadata: VectorSetMetadata) => void
    onImportComplete?: () => void
}

export function SampleDataDialog({
    open,
    onOpenChange,
    vectorSetName,
    metadata,
    onUpdateMetadata,
    onImportComplete,
}: SampleDataDialogProps) {
    const [step, setStep] = useState<"select" | "import">("select")
    const [selectedDataset, setSelectedDataset] =
        useState<SampleDataset | null>(null)

    const handleSelectDataset = (dataset: SampleDataset) => {
        setSelectedDataset(dataset)
        setStep("import")
    }

    const handleClose = () => {
        console.log("handleClose")
        // Reset state when dialog closes
        onOpenChange(false)

        // Small delay to allow the dialog to close animation to complete
        // before resetting the internal state
        setTimeout(() => {
            setStep("select")
            setSelectedDataset(null)
        }, 200)

        if (step === "import" && onImportComplete) {
            onImportComplete()
        }
    }

    const handleCancel = () => {
        // If in import step, go back to select
        if (step === "import" && selectedDataset) {
            setStep("select")
            return
        }

        // Otherwise close the dialog
        handleClose()
    }

    // Determine dialog title based on current step
    const dialogTitle =
        step === "select"
            ? "Select Sample Dataset"
            : `Import ${selectedDataset?.name || "Dataset"}`

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto mt-4 min-h-0">
                    {step === "select" && (
                        <SampleDataSelect
                            onSelect={handleSelectDataset}
                            onCancel={handleClose}
                            useCarousel={true}
                        />
                    )}

                    {step === "import" && selectedDataset && (
                        <SampleDataImporter
                            dataset={selectedDataset}
                            vectorSetName={vectorSetName}
                            metadata={metadata}
                            onUpdateMetadata={onUpdateMetadata}
                            onClose={handleClose}
                        />
                    )}
                </div>
                
            </DialogContent>
        </Dialog>
    )
}
