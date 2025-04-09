import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { SampleDataDialog } from "./SampleDataDialog"
import ImportFromCSV from "./ImportFromCSV"
import { vectorSets } from "@/app/api/vector-sets"
import { Job } from "@/app/api/jobs"
import { ArrowLeft } from "lucide-react"

interface ImportDialogsProps {
    showImportCSV: boolean
    showImportSample: boolean
    showImportSuccessDialog: boolean
    metadata: VectorSetMetadata | null
    vectorSetName: string
    successJob: Job | null
    onImportCSVClose: () => void
    onImportSampleClose: () => void
    onSuccessDialogClose: () => void
    onImportSuccess: () => void
    onFetchJobs: () => void
}

export default function ImportDialogs({
    showImportCSV,
    showImportSample,
    showImportSuccessDialog,
    metadata,
    vectorSetName,
    successJob,
    onImportCSVClose,
    onImportSampleClose,
    onSuccessDialogClose,
    onImportSuccess,
    onFetchJobs,
}: ImportDialogsProps) {
    return (
        <>
            {showImportCSV && (
                <div className="bg-[white] p-2 rounded-lg shadow-xs">
                    <div className="mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onImportCSVClose}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </div>
                    <ImportFromCSV
                        onClose={onImportCSVClose}
                        onImportSuccess={onImportSuccess}
                        metadata={metadata}
                        vectorSetName={vectorSetName}
                    />
                </div>
            )}

            {showImportSample && (
                <div className="bg-[white] p-2 rounded-lg shadow-xs">
                    <div className="mb-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onImportSampleClose}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </div>
                    <SampleDataDialog
                        open={showImportSample}
                        onOpenChange={(open) => {
                            if (!open) onImportSampleClose()
                        }}
                        vectorSetName={vectorSetName}
                        metadata={metadata}
                        onImportComplete={(success) => {
                            console.log(
                                "onImportComplete called with success:",
                                success
                            )
                            onFetchJobs()

                            if (success) {
                                console.log(
                                    "Import was successful, showing success dialog soon"
                                )
                                setTimeout(() => {
                                    onImportSuccess()
                                }, 1000)
                            }
                        }}
                        onUpdateMetadata={async (newMetadata) => {
                            console.log("Updating metadata:", newMetadata)
                            try {
                                await vectorSets.setMetadata({
                                    name: vectorSetName,
                                    metadata: newMetadata,
                                })
                                window.location.reload()
                            } catch (error) {
                                console.error(
                                    "Failed to update metadata:",
                                    error
                                )
                            }
                        }}
                    />
                </div>
            )}

            <Dialog
                open={showImportSuccessDialog}
                onOpenChange={onSuccessDialogClose}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Import Completed Successfully</DialogTitle>
                        <DialogDescription>
                            Your data import has completed successfully!
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="secondary"
                            onClick={onSuccessDialogClose}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
} 