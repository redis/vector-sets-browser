import { ApiError } from "@/app/api/client"
import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
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
import { FileSpreadsheet, Loader2, X } from "lucide-react"
import React from "react"
import ImportCard from "../ImportCard"
import CSVFileSelector, { CSVPreviewData } from "./CSVFileSelector"
import CSVImportConfigurator from "./CSVImportConfigurator"

interface ImportFromCSVFlowProps {
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onImportSuccess: () => void
}

type WizardStep = "select" | "configure" | "attributes" | "confirm"

interface ConfigData {
    elementTemplate: string
    vectorTemplate: string
    selectedAttributes: string[]
}

export default function ImportFromCSVFlow({
    metadata,
    vectorSetName,
    onImportSuccess,
}: ImportFromCSVFlowProps) {
    const [showDialog, setShowDialog] = React.useState(false)
    const [csvPreview, setCsvPreview] = React.useState<CSVPreviewData | null>(
        null
    )
    const [currentStep, setCurrentStep] = React.useState<WizardStep>("select")
    const [configuredData, setConfiguredData] =
        React.useState<ConfigData | null>(null)
    const [isConfigValid, setIsConfigValid] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [importStarted, setImportStarted] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const handleClose = () => {
        if (isImporting) return // Prevent closing while import is in progress
        if (importStarted) {
            onImportSuccess() // Only notify parent of success when import has actually started
        }
        setShowDialog(false)
        setCsvPreview(null)
        setCurrentStep("select")
        setConfiguredData(null)
        setIsConfigValid(false)
        setError(null)
        setImportStarted(false)
    }

    const startCSVImport = async () => {
        if (!csvPreview || !configuredData || !vectorSetName) return

        setIsImporting(true)
        setError(null)

        const config: ImportJobConfig = {
            delimiter: ",",
            hasHeader: true,
            skipRows: 0,
            elementTemplate: configuredData.elementTemplate,
            textTemplate: configuredData.vectorTemplate,
            attributeColumns:
                configuredData.selectedAttributes.length > 0
                    ? configuredData.selectedAttributes
                    : undefined,
            metadata: metadata || undefined,
            exportType: "redis",
        }

        try {
            console.log("[ImportTab] Creating import job")
            console.log("[ImportTab] Config: ", config)

            const file = new File(
                [csvPreview.fileContent],
                csvPreview.fileName,
                { type: "text/csv" }
            )
            console.log("[ImportTab] File: ", file)

            await jobs.createImportJob(vectorSetName, file, config)

            setImportStarted(true)

            setIsImporting(false) // Set importing to false after job is created
        } catch (error) {
            console.error("Error starting import:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Error starting import"
            )
            setIsImporting(false)
            setImportStarted(false)
        }
    }

    const handleNext = () => {
        switch (currentStep) {
            case "select":
                setCurrentStep("configure")
                break
            case "configure":
                if (isConfigValid && configuredData) {
                    setCurrentStep("attributes")
                }
                break
            case "attributes":
                setCurrentStep("confirm")
                break
        }
    }

    const handleBack = () => {
        switch (currentStep) {
            case "configure":
                setCurrentStep("select")
                break
            case "attributes":
                setCurrentStep("configure")
                break
            case "confirm":
                setCurrentStep("attributes")
                break
        }
    }

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center space-x-2 mb-6">
            {(
                ["select", "configure", "attributes", "confirm"] as WizardStep[]
            ).map((step, index) => (
                <React.Fragment key={step}>
                    <div
                        className={`h-2 w-2 rounded-full ${currentStep === step
                                ? "bg-primary"
                                : index <
                                    [
                                        "select",
                                        "configure",
                                        "attributes",
                                        "confirm",
                                    ].indexOf(currentStep)
                                    ? "bg-primary/50"
                                    : "bg-muted"
                            }`}
                    />
                    {index < 3 && (
                        <div
                            className={`h-[2px] w-8 ${index <
                                    [
                                        "select",
                                        "configure",
                                        "attributes",
                                        "confirm",
                                    ].indexOf(currentStep)
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
                return "Step 1: Select CSV File"
            case "configure":
                return "Step 2: Define Element and Vector Templates"
            case "attributes":
                return "Step 3: Select Attributes"
            case "confirm":
                return "Step 4: Confirm and Start Import"
        }
    }

    const renderContent = () => {
        switch (currentStep) {
            case "select":
                return (
                    <CSVFileSelector
                        metadata={metadata}
                        onFileSelected={(preview) => {
                            setCsvPreview(preview)
                            handleNext()
                        }}
                    />
                )
            case "configure":
                return (
                    csvPreview && (
                        <CSVImportConfigurator
                            csvPreview={csvPreview}
                            metadata={metadata}
                            vectorSetName={vectorSetName}
                            onConfigured={(config) => {
                                setConfiguredData(config)
                            }}
                            onValidityChange={(isValid) => {
                                setIsConfigValid(isValid)
                            }}
                            hideImportButton
                        />
                    )
                )
            case "attributes":
                return (
                    csvPreview && (
                        <CSVImportConfigurator
                            csvPreview={csvPreview}
                            metadata={metadata}
                            vectorSetName={vectorSetName}
                            onConfigured={(config) => {
                                setConfiguredData(config)
                            }}
                            onValidityChange={(isValid) => {
                                setIsConfigValid(isValid)
                            }}
                            hideImportButton
                            showAttributesSection
                        />
                    )
                )
            case "confirm":
                if (importStarted) {
                    return (
                        <div className="space-y-6 py-8">
                            Import started successfully! You can view progress
                            and manage the import from the Import Tab.
                        </div>
                    )
                }

                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium">
                                Import Summary
                            </h3>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <div className="text-sm font-medium">
                                        File
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {csvPreview?.fileName}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">
                                        Records
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {csvPreview?.totalRecords} items will be
                                        imported
                                    </div>
                                </div>
                                {configuredData?.selectedAttributes.length ? (
                                    <div>
                                        <div className="text-sm font-medium">
                                            Selected Attributes
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {configuredData.selectedAttributes.join(
                                                ", "
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                <div>
                                    <div className="text-sm font-medium">
                                        Element Template
                                    </div>
                                    <div className="text-sm text-muted-foreground font-mono">
                                        {configuredData?.elementTemplate}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">
                                        Vector Template
                                    </div>
                                    <div className="text-sm text-muted-foreground font-mono">
                                        {configuredData?.vectorTemplate}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-center pb-4">
                            <Button
                                size="lg"
                                onClick={startCSVImport}
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
                        </div>
                    </div>
                )
        }
    }

    return (
        <>
            <ImportCard
                icon={FileSpreadsheet}
                title="Import from CSV"
                description="Upload your own CSV file with text data"
                iconColor="text-blue-500"
                onClick={() => setShowDialog(true)}
            />

            <Dialog
                open={showDialog}
                onOpenChange={(open) => {
                    // Only allow closing if we're not importing and import hasn't started
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
                                {currentStep !== "select" && (
                                    <Button
                                        variant="outline"
                                        onClick={handleBack}
                                        disabled={isImporting}
                                    >
                                        Back
                                    </Button>
                                )}
                                <div className="grow"></div>

                                {(currentStep === "configure" ||
                                    currentStep === "attributes") && (
                                        <Button
                                            onClick={() => handleNext()}
                                            disabled={!isConfigValid || isImporting}
                                        >
                                            Next
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
