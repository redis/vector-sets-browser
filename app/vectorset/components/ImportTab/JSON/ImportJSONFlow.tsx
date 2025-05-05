import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileJson, Loader2, X } from "lucide-react"
import React, { useState } from "react"
import eventBus, { AppEvents } from "@/lib/client/events/eventEmitter"
import ImportCard from "../ImportCard"
import { CodeBlock } from "@/components/ui/code-block"
import { vcard, vrem, vsim } from "@/lib/redis-server/api"

interface ImportJSONFlowProps {
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onImportSuccess: () => void
}

type WizardStep = "select" | "confirm"

const sampleJSON = `{
  "element": "Sample element name",
  "vector": [0.1, 0.2, 0.3],
  "attributes": {
    "category": "example",
    "tags": ["sample", "demo"]
  }
}`

export default function ImportJSONFlow({
    metadata,
    vectorSetName,
    onImportSuccess,
}: ImportJSONFlowProps) {
    const [showDialog, setShowDialog] = useState(false)
    const [currentStep, setCurrentStep] = useState<WizardStep>("select")
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [jsonPreview, setJsonPreview] = useState<any | null>(null)

    const handleClose = () => {
        if (isImporting) return
        if (importStarted) {
            onImportSuccess()
        }
        setShowDialog(false)
        setSelectedFile(null)
        setCurrentStep("select")
        setError(null)
        setImportStarted(false)
        setJsonPreview(null)
    }

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return

        const file = event.target.files[0]
        try {
            const jsonContent = await file.text()
            const jsonData = JSON.parse(jsonContent)

            // Validate JSON structure
            if (!validateJsonStructure(jsonData)) {
                setError("Invalid JSON structure. Please check the required format.")
                return
            }

            setSelectedFile(file)
            setJsonPreview(jsonData)
            setCurrentStep("confirm")
            setError(null)
        } catch (error) {
            console.error("Failed to parse JSON:", error)
            setError("Failed to parse JSON file. Please check the file format.")
        }
    }

    const validateJsonStructure = (data: any): boolean => {
        // If it's an array, check the first item
        const item = Array.isArray(data) ? data[0] : data

        return (
            item &&
            typeof item === "object" &&
            "element" in item &&
            "vector" in item &&
            Array.isArray(item.vector) &&
            item.vector.every((v: any) => typeof v === "number")
        )
    }

    // Function to check if the vectorset has only one record with "Placeholder (Vector)"
    // and delete it if found to prevent issues with embedding type or REDUCE option
    const checkAndRemovePlaceholderRecord = async () => {
        try {
            // Check how many records are in the vector set
            const countResponse = await vcard({ keyName: vectorSetName });

            // If there's only one record, check if it's the default placeholder
            if (countResponse.success && countResponse.result === 1) {
                // Get the record using vsim with high count to ensure we get the record
                const searchResult = await vsim({
                    keyName: vectorSetName,
                    count: 1,
                    searchElement: "Placeholder (Vector)"
                })

                if (searchResult.success && searchResult.result && searchResult.result.length > 0) {
                    const recordName = searchResult.result[0][0]; // First element, element name

                    // Check if it's the default placeholder record
                    if (recordName === "Placeholder (Vector)") {
                        console.log("Removing placeholder record before import:", recordName);

                        // Delete the default record
                        const deleteResult = await vrem({
                            keyName: vectorSetName,
                            element: recordName
                        });

                        if (deleteResult.success) {
                            console.log("Placeholder record removed successfully");
                        } else {
                            console.error("Failed to remove placeholder record:", deleteResult.error);
                        }
                    }
                }
            }
        } catch (error) {
            // Log but don't throw error - this is a best-effort operation
            console.error("Error checking/removing placeholder record:", error);
            // Continue with import regardless of this error
        }
    };

    const startJSONImport = async () => {
        if (!selectedFile || !metadata) return

        setIsImporting(true)
        setError(null)

        try {
            // Check and remove placeholder record before starting import
            await checkAndRemovePlaceholderRecord();

            const importJobConfig: ImportJobConfig = {
                fileType: "json",
                exportType: "redis",
                metadata: metadata,
            }

            await jobs.createImportJob(vectorSetName, selectedFile, importJobConfig)
            setImportStarted(true)
            eventBus.emit(AppEvents.VECTORS_IMPORTED, { vectorSetName })
            setIsImporting(false)
        } catch (error) {
            console.error("Error starting import:", error)
            setError(error instanceof Error ? error.message : "Error starting import")
            setIsImporting(false)
            setImportStarted(false)
        }
    }

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center space-x-2 mb-6">
            {(["select", "confirm"] as WizardStep[]).map((step, index) => (
                <React.Fragment key={step}>
                    <div
                        className={`h-2 w-2 rounded-full ${
                            currentStep === step
                                ? "bg-primary"
                                : index < ["select", "confirm"].indexOf(currentStep)
                                ? "bg-primary/50"
                                : "bg-muted"
                        }`}
                    />
                    {index < 1 && (
                        <div
                            className={`h-[2px] w-8 ${
                                index < ["select", "confirm"].indexOf(currentStep)
                                    ? "bg-primary/50"
                                    : "bg-muted"
                            }`}
                        />
                    )}
                </React.Fragment>
            ))}
        </div>
    )

    const renderStepTitle = () => {
        switch (currentStep) {
            case "select":
                return "Step 1: Select JSON File"
            case "confirm":
                return "Step 2: Confirm and Start Import"
        }
    }

    const renderContent = () => {
        switch (currentStep) {
            case "select":
                return (
                    <div className="space-y-6">
                        <div className="space-y-4">
                            <h3 className="text-lg font-medium">JSON Format Requirements</h3>
                            <p className="text-sm text-muted-foreground">
                                Your JSON file should contain objects with the following structure:
                            </p>
                            <div className="bg-muted rounded-md p-4">
                                <CodeBlock code={sampleJSON} language="json" />
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <Button
                                size="lg"
                                onClick={() => document.getElementById("jsonFileInput")?.click()}
                            >
                                Select JSON File
                            </Button>
                            <input
                                id="jsonFileInput"
                                type="file"
                                accept=".json"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </div>
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                )
            case "confirm":
                if (importStarted) {
                    return (
                        <div className="space-y-6 py-8">
                            Import started successfully! You can view progress and manage the import from the Import Tab.
                        </div>
                    )
                }

                return (
                    <div className="space-y-6">
                        <div>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <div className="text-sm font-medium">File</div>
                                    <div className="text-sm text-muted-foreground">
                                        {selectedFile?.name}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Records</div>
                                    <div className="text-sm text-muted-foreground">
                                        {Array.isArray(jsonPreview)
                                            ? `${jsonPreview.length} items will be imported`
                                            : "1 item will be imported"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Preview</div>
                                    <div className="text-sm text-muted-foreground font-mono bg-muted rounded-md p-4 mt-2">
                                        <CodeBlock
                                            code={JSON.stringify(
                                                Array.isArray(jsonPreview)
                                                    ? jsonPreview[0]
                                                    : jsonPreview,
                                                null,
                                                2
                                            )}
                                            language="json"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                    </div>
                )
        }
    }

    return (
        <>
            <ImportCard
                icon={FileJson}
                title="Import JSON"
                description="Import test data from JSON"
                iconColor="text-purple-500"
                onClick={() => setShowDialog(true)}
            />

            <Dialog
                open={showDialog}
                onOpenChange={(open) => {
                    if (!isImporting && !importStarted && !open) {
                        handleClose()
                    }
                }}
            >
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col gap-0 p-0">
                    <DialogHeader className="flex-none p-6 pb-2">
                        <div className="flex items-center justify-between">
                            <DialogTitle>{renderStepTitle()}</DialogTitle>
                            <Button
                                variant="ghost"
                                onClick={handleClose}
                                disabled={isImporting}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    <div className="flex-none px-6">
                        {renderStepIndicator()}
                    </div>

                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-full">
                            <div className="px-6 py-4">{renderContent()}</div>
                        </ScrollArea>
                    </div>

                    <DialogFooter className="flex-none flex justify-between w-full p-6 border-t">
                        {importStarted ? (
                            <div className="flex w-full justify-end">
                                <Button onClick={handleClose}>Close</Button>
                            </div>
                        ) : (
                            <div className="flex gap-2 w-full">
                                {currentStep === "confirm" && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setCurrentStep("select")}
                                        disabled={isImporting}
                                    >
                                        Back
                                    </Button>
                                )}
                                <div className="grow"></div>
                                {currentStep === "confirm" && (
                                    <Button
                                        onClick={startJSONImport}
                                        disabled={isImporting}
                                    >
                                        {isImporting ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Starting Import...
                                            </>
                                        ) : (
                                            "Start Import"
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
