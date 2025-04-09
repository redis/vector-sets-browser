import { vectorSets } from "@/app/api/vector-sets"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Database } from "lucide-react"
import { useState } from "react"
import ImportCard from "./ImportCard"
import { SampleDataDialog } from "./SampleDataDialog"

interface ImportSamplesFlowProps {
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onImportSuccess: () => void
    onFetchJobs: () => void
}

export default function ImportSamplesFlow({
    metadata,
    vectorSetName,
    onImportSuccess,
    onFetchJobs,
}: ImportSamplesFlowProps) {
    const [showDialog, setShowDialog] = useState(false)

    return (
        <>
            <ImportCard
                icon={Database}
                title="Sample Data"
                description="Import pre-configured datasets with one click"
                iconColor="text-green-500"
                onClick={() => setShowDialog(true)}
            />

            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent className="max-w-4xl">
                    <SampleDataDialog
                        open={showDialog}
                        onOpenChange={(open) => {
                            if (!open) setShowDialog(false)
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
                                    setShowDialog(false)
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
                </DialogContent>
            </Dialog>
        </>
    )
} 