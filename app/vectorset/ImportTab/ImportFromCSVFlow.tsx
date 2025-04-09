import React from "react"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import ImportCard from "./ImportCard"
import CSVFileSelector, { CSVPreviewData } from "./CSVFileSelector"
import CSVImportConfigurator from "./CSVImportConfigurator"
import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { ApiError } from "@/app/api/client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

interface ImportFromCSVFlowProps {
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onImportSuccess: () => void
}

type WizardStep = 'select' | 'configure' | 'confirm'

interface ConfigData {
    elementTemplate: string;
    vectorTemplate: string;
    selectedAttributes: string[];
}

export default function ImportFromCSVFlow({
    metadata,
    vectorSetName,
    onImportSuccess,
}: ImportFromCSVFlowProps) {
    const [showDialog, setShowDialog] = React.useState(false)
    const [csvPreview, setCsvPreview] = React.useState<CSVPreviewData | null>(null)
    const [currentStep, setCurrentStep] = React.useState<WizardStep>('select')
    const [configuredData, setConfiguredData] = React.useState<ConfigData | null>(null)
    const [isConfigValid, setIsConfigValid] = React.useState(false)
    const [isImporting, setIsImporting] = React.useState(false)
    const [importStarted, setImportStarted] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const handleClose = () => {
        if (isImporting) return // Prevent closing while import is in progress
        setShowDialog(false)
        setCsvPreview(null)
        setCurrentStep('select')
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
            attributeColumns: configuredData.selectedAttributes.length > 0
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
            
            await jobs.createImportJob(vectorSetName, file, config)
            setImportStarted(true)
            onImportSuccess() // Notify parent that import has started
        } catch (error) {
            console.error("Error starting import:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Error starting import"
            )
            setIsImporting(false)
        }
    }

    const handleImportSuccess = () => {
        handleClose()
        onImportSuccess()
    }

    const handleNext = () => {
        switch (currentStep) {
            case 'select':
                setCurrentStep('configure')
                break
            case 'configure':
                if (isConfigValid && configuredData) {
                    setCurrentStep('confirm')
                }
                break
        }
    }

    const handleBack = () => {
        switch (currentStep) {
            case 'configure':
                setCurrentStep('select')
                break
            case 'confirm':
                setCurrentStep('configure')
                break
        }
    }

    const renderStepIndicator = () => (
        <div className="flex items-center justify-center space-x-2 mb-6">
            {(['select', 'configure', 'confirm'] as WizardStep[]).map((step, index) => (
                <React.Fragment key={step}>
                    <div 
                        className={`h-2 w-2 rounded-full ${
                            currentStep === step 
                                ? 'bg-primary' 
                                : index < ['select', 'configure', 'confirm'].indexOf(currentStep)
                                    ? 'bg-primary/50'
                                    : 'bg-muted'
                        }`}
                    />
                    {index < 2 && (
                        <div className={`h-[2px] w-8 ${
                            index < ['select', 'configure', 'confirm'].indexOf(currentStep)
                                ? 'bg-primary/50'
                                : 'bg-muted'
                        }`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    )

    const renderStepTitle = () => {
        switch (currentStep) {
            case 'select':
                return 'Step 1: Select CSV File'
            case 'configure':
                return 'Step 2: Configure Import'
            case 'confirm':
                return 'Step 3: Confirm and Start Import'
        }
    }

    const renderContent = () => {
        switch (currentStep) {
            case 'select':
                return (
                    <CSVFileSelector
                        metadata={metadata}
                        onFileSelected={(preview) => {
                            setCsvPreview(preview)
                            handleNext()
                        }}
                    />
                )
            case 'configure':
                return csvPreview && (
                    <CSVImportConfigurator
                        csvPreview={csvPreview}
                        metadata={metadata}
                        vectorSetName={vectorSetName}
                        onImportSuccess={handleImportSuccess}
                        onConfigured={(config) => {
                            setConfiguredData(config)
                        }}
                        onValidityChange={(isValid) => {
                            setIsConfigValid(isValid)
                        }}
                        hideImportButton
                    />
                )
            case 'confirm':
                if (importStarted) {
                    return (
                        <div className="space-y-6 py-8">
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    Import started successfully! You can view progress and manage the import from the Import Tab.
                                </AlertDescription>
                            </Alert>
                        </div>
                    )
                }

                return (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-lg font-medium">Import Summary</h3>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <div className="text-sm font-medium">File</div>
                                    <div className="text-sm text-muted-foreground">{csvPreview?.fileName}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Records</div>
                                    <div className="text-sm text-muted-foreground">{csvPreview?.totalRecords} items will be imported</div>
                                </div>
                                {configuredData?.selectedAttributes.length ? (
                                    <div>
                                        <div className="text-sm font-medium">Selected Attributes</div>
                                        <div className="text-sm text-muted-foreground">{configuredData.selectedAttributes.join(', ')}</div>
                                    </div>
                                ) : null}
                                <div>
                                    <div className="text-sm font-medium">Element Template</div>
                                    <div className="text-sm text-muted-foreground font-mono">{configuredData?.elementTemplate}</div>
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Vector Template</div>
                                    <div className="text-sm text-muted-foreground font-mono">{configuredData?.vectorTemplate}</div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex justify-center">
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
                                    'Start Import'
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

            <Dialog open={showDialog} onOpenChange={handleClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle>{renderStepTitle()}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="px-6">
                        {renderStepIndicator()}
                    </div>

                    <ScrollArea className="flex-1 px-6">
                        <div className="min-h-[300px]">
                            {renderContent()}
                        </div>
                    </ScrollArea>

                    <DialogFooter className="flex justify-between p-6 border-t">
                        <div>
                            {currentStep !== 'select' && !importStarted && (
                                <Button
                                    variant="outline"
                                    onClick={handleBack}
                                    disabled={isImporting}
                                >
                                    Back
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {importStarted ? (
                                <Button onClick={handleClose}>
                                    Close
                                </Button>
                            ) : (
                                <>
                                    <Button 
                                        variant="ghost" 
                                        onClick={handleClose}
                                        disabled={isImporting}
                                    >
                                        Cancel
                                    </Button>
                                    {currentStep === 'configure' && (
                                        <Button 
                                            onClick={() => handleNext()}
                                            disabled={!isConfigValid || isImporting}
                                        >
                                            Next
                                        </Button>
                                    )}
                                </>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
} 