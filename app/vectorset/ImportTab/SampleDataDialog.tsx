"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { SampleDataSelect, SampleDataset } from "./SampleDataSelect"
import { SampleDataImporter } from "./SampleDataImporter"
import { VectorSetMetadata } from "@/app/embeddings/types/embeddingModels"

interface SampleDataDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    vectorSetName: string
    metadata: VectorSetMetadata | null
    onUpdateMetadata?: (metadata: VectorSetMetadata) => void
    onImportComplete?: (success: boolean) => void
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
    const [importSuccess, setImportSuccess] = useState(false)

    const handleSelectDataset = (dataset: SampleDataset) => {
        setSelectedDataset(dataset)
        setStep("import")
    }

    const handleClose = () => {
        console.log("handleClose called with importSuccess:", importSuccess)

        // Check if we need to signal import completion before closing
        const wasInImportStep = step === "import"
        const successState = importSuccess; // Capture current success state

        // Reset state when dialog closes
        onOpenChange(false)

        // Small delay to allow the dialog to close animation to complete
        // before resetting the internal state
        setTimeout(() => {
            setStep("select")
            setSelectedDataset(null)
        }, 200)

        // Only call onImportComplete after the dialog is closed
        // and only if we were in the import step
        if (wasInImportStep && onImportComplete) {
            // Add a longer delay to ensure the dialog is closed first
            setTimeout(() => {
                console.log("Calling onImportComplete with success:", successState)
                onImportComplete(successState)
            }, 500)
        }
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
                            onClose={() => {
                                console.log("SampleDataImporter onClose called");
                                // Set import success flag explicitly
                                setImportSuccess(true);
                                // Use setTimeout to ensure state is updated before handleClose is called
                                setTimeout(() => {
                                    handleClose();
                                }, 100);
                            }}
                        />
                    )}
                </div>

            </DialogContent>
        </Dialog>
    )
}
