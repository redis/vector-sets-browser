import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { generateEmbeddingTemplate } from "@/app/api/openai"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { userSettings } from "@/app/utils/userSettings"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Sparkles
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

interface CSVPreviewData {
    headers: string[]
    sampleRows: Record<string, string | number>[]
    fileName: string
    totalRecords: number
    fileContent: string
}

interface CSVImportConfiguratorProps {
    csvPreview: CSVPreviewData
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onConfigured?: (config: {
        elementTemplate: string;
        vectorTemplate: string;
        selectedAttributes: string[];
    }) => void
    onValidityChange?: (isValid: boolean) => void
    hideImportButton?: boolean
    showAttributesSection?: boolean
}

export function AttributesConfigurator({
    csvPreview,
    selectedAttributeColumns,
    onAttributeToggle,
}: {
    csvPreview: CSVPreviewData;
    selectedAttributeColumns: string[];
    onAttributeToggle: (header: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="pb-2">
                <p className="text-sm text-muted-foreground mt-1">
                    Select columns to store as attributes. These
                    will be attached as JSON to each element and can
                    be used for filtering.
                </p>
            </div>

            <ScrollArea className="h-[400px] border rounded-md p-2">
                <div className="space-y-3">
                    {csvPreview.headers.map((header) => (
                        <div
                            key={header}
                            className="flex items-center gap-3 px-2"
                        >
                            <Switch
                                id={`attr-${header}`}
                                checked={selectedAttributeColumns.includes(
                                    header
                                )}
                                onCheckedChange={() =>
                                    onAttributeToggle(header)
                                }
                            />
                            <Label
                                htmlFor={`attr-${header}`}
                                className="text-sm"
                            >
                                {header}
                            </Label>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}

export default function CSVImportConfigurator({
    csvPreview,
    metadata,
    vectorSetName,
    onConfigured,
    onValidityChange,
    hideImportButton = false,
    showAttributesSection = false,
}: CSVImportConfiguratorProps) {
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [selectedAttributeColumns, setSelectedAttributeColumns] = useState<
        string[]
    >([])
    const [elementTemplate, setElementTemplate] = useState<string>("")
    const [vectorTemplate, setVectorTemplate] = useState<string>("")
    const elementTemplateRef = useRef<HTMLTextAreaElement>(null)
    const vectorTemplateRef = useRef<HTMLTextAreaElement>(null)
    const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false)
    const [suggestedElementTemplate, setSuggestedElementTemplate] =
        useState<string>("")
    const [suggestedVectorTemplate, setSuggestedVectorTemplate] =
        useState<string>("")
    const [showElementEditor, setShowElementEditor] = useState(false)
    const [showVectorEditor, setShowVectorEditor] = useState(false)
    const [showPreview, setShowPreview] = useState(false)
    const [previewSampleIndex, setPreviewSampleIndex] = useState(0)
    const [openAIKey, setOpenAIKey] = useState<string>("")
    const [isCheckingOpenAIKey, setIsCheckingOpenAIKey] = useState(true)
    const [isOpenAIKeyAvailable, setIsOpenAIKeyAvailable] = useState<
        boolean | null
    >(null)
    const [openAIKeyError, setOpenAIKeyError] = useState<string | null>(null)

    useEffect(() => {
        const checkOpenAIKey = async () => {
            try {
                const key = await userSettings.get<string>("openai_api_key")
                setIsOpenAIKeyAvailable(!!key)
                setOpenAIKey(key || "")
                setIsCheckingOpenAIKey(false)
            } catch (error) {
                console.error("Error checking OpenAI key:", error)
                setIsOpenAIKeyAvailable(false)
                setIsCheckingOpenAIKey(false)
            }
        }
        checkOpenAIKey()
    }, [])

    const handleSaveApiKey = async () => {
        try {
            await userSettings.set("openai_api_key", openAIKey)
            setIsOpenAIKeyAvailable(true)
            setOpenAIKeyError(null)
        } catch (_error) {
            setOpenAIKeyError("Failed to save API key")
        }
    }

    const handleAttributeToggle = (header: string) => {
        setSelectedAttributeColumns((current) =>
            current.includes(header)
                ? current.filter((h) => h !== header)
                : [...current, header]
        )
    }

    const generateTemplateSuggestions = async (
        headers: string[],
        sampleRows: Record<string, string | number>[]
    ) => {
        if (!isOpenAIKeyAvailable) return

        setIsGeneratingTemplates(true)
        try {
            const sampleRowsAsStrings = sampleRows.map((row) =>
                headers.map((header) => String(row[header])).join(", ")
            )

            const templates = await generateEmbeddingTemplate(
                headers,
                sampleRowsAsStrings
            )
            if (templates) {
                setSuggestedElementTemplate(templates.elementTemplate)
                setSuggestedVectorTemplate(templates.embeddingTemplate)
                setElementTemplate(templates.elementTemplate)
                setVectorTemplate(templates.embeddingTemplate)
            }
        } catch (error) {
            console.error("Error generating templates:", error)
        }
        setIsGeneratingTemplates(false)
    }

    useEffect(() => {
        if (
            csvPreview?.headers &&
            csvPreview.sampleRows.length > 0 &&
            isOpenAIKeyAvailable
        ) {
            generateTemplateSuggestions(
                csvPreview.headers,
                csvPreview.sampleRows
            )
        }
    }, [csvPreview, isOpenAIKeyAvailable])

    const insertColumnIntoTemplate = (
        currentTemplate: string,
        column: string,
        setTemplate: (template: string) => void,
        ref: React.RefObject<HTMLTextAreaElement | null>
    ) => {
        const placeholder = `\${${column}}`
        const textarea = ref.current
        if (textarea) {
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const newTemplate =
                currentTemplate.substring(0, start) +
                placeholder +
                currentTemplate.substring(end)
            setTemplate(newTemplate)
            // Set cursor position after the inserted placeholder
            setTimeout(() => {
                if (textarea) {
                    const newPosition = start + placeholder.length
                    textarea.setSelectionRange(newPosition, newPosition)
                    textarea.focus()
                }
            }, 0)
        } else {
            setTemplate(
                currentTemplate
                    ? `${currentTemplate} ${placeholder}`
                    : placeholder
            )
        }
    }

    const renderTemplateWithData = (template: string, rowIndex: number) => {
        if (!template || !csvPreview?.sampleRows[rowIndex]) return null

        let result = template
        const row = csvPreview.sampleRows[rowIndex]

        // Replace all ${Column} references with actual data
        csvPreview.headers.forEach((header) => {
            const regex = new RegExp(`\\$\\{${header}\\}`, "g")
            result = result.replace(regex, String(row[header] || ""))
        })

        return result
    }

    const renderHighlightedTemplate = (template: string) => {
        if (!template) return null

        // Regular expression to match ${Column_Name} patterns
        const regex = /\$\{([^}]+)\}/g
        let lastIndex = 0
        const parts = []
        let match
        let key = 0

        while ((match = regex.exec(template)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(
                    <span key={key++}>
                        {template.substring(lastIndex, match.index)}
                    </span>
                )
            }

            // Add the highlighted column name
            parts.push(
                <span
                    key={key++}
                    className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-md text-xs font-medium"
                >
                    {match[0]}
                </span>
            )

            lastIndex = match.index + match[0].length
        }

        // Add any remaining text
        if (lastIndex < template.length) {
            parts.push(<span key={key++}>{template.substring(lastIndex)}</span>)
        }

        return <div className="whitespace-pre-wrap break-words">{parts}</div>
    }

    const cycleSamplePreview = () => {
        setPreviewSampleIndex((prevIndex) =>
            prevIndex >= csvPreview.sampleRows.length - 1 ? 0 : prevIndex + 1
        )
    }

    const handleImport = async () => {
        if (!vectorSetName) return

        if (!elementTemplate) {
            return
        }

        if (!vectorTemplate) {
            return
        }

        if (onConfigured) {
            onConfigured({
                elementTemplate,
                vectorTemplate,
                selectedAttributes: selectedAttributeColumns,
            })
            return
        }

        setIsImporting(true)

        const config: ImportJobConfig = {
            delimiter: ",",
            hasHeader: true,
            skipRows: 0,
            elementTemplate,
            textTemplate: vectorTemplate,
            attributeColumns:
                selectedAttributeColumns.length > 0
                    ? selectedAttributeColumns
                    : undefined,
            metadata: metadata || undefined,
            exportType: "redis",
            outputFilename: undefined,
        }

        try {
            console.log("[ImportTab] Creating import job")
            console.log("[ImportTab] Config: ", config)
            const file = new File(
                [csvPreview.fileContent],
                csvPreview.fileName,
                { type: "text/csv" }
            )
            const { jobId } = await jobs.createImportJob(
                vectorSetName,
                file,
                config
            )

            // Start monitoring the job status
            setImportStarted(true)

            // Add a delay before starting to poll to allow job initialization
            await new Promise(resolve => setTimeout(resolve, 2000))

            // Poll for job status with retries for initial check
            const checkJobStatus = async (retries = 5) => {
                try {
                    const job = await jobs.getJob(jobId)

                    if (!job && retries > 0) {
                        // If job not found and we have retries left, wait and try again
                        console.log(`[ImportTab] Job ${jobId} not found, retrying... (${retries} retries left)`)
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        return checkJobStatus(retries - 1)
                    }

                    if (!job) {
                        console.error(`[ImportTab] Job ${jobId} not found after ${5 - retries} retries`)
                        setIsImporting(false)
                        return
                    }

                    // Log the job status
                    console.log(`[ImportTab] Job ${jobId} status:`, job.status)

                    switch (job.status.status) {
                        case "completed":
                            eventBus.emit(AppEvents.VECTORS_IMPORTED, {
                                vectorSetName,
                            })
                            setIsImporting(false)
                            break
                        case "failed":
                            setIsImporting(false)
                            break
                        default:
                            // Continue polling if job is still running
                            setTimeout(() => checkJobStatus(0), 1000)
                    }
                } catch (error) {
                    if (retries > 0) {
                        // If error and we have retries left, wait and try again
                        console.log(`[ImportTab] Error checking job status, retrying... (${retries} retries left)`, error)
                        await new Promise(resolve => setTimeout(resolve, 1000))
                        return checkJobStatus(retries - 1)
                    }
                    console.error("Error checking job status:", error)
                    setIsImporting(false)
                }
            }

            // Start polling with retry attempts
            checkJobStatus()
        } catch (error) {
            console.error("Error importing file:", error)
            setIsImporting(false)
        }
    }

    const renderOpenAIKeySetup = () => (
        <div className="space-y-6 py-4">
            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                    The AI Import feature requires an OpenAI API key to analyze
                    your CSV data and create optimal templates.
                </AlertDescription>
            </Alert>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="openai-key">OpenAI API Key</Label>
                    <Input
                        id="openai-key"
                        type="password"
                        value={openAIKey}
                        onChange={(e) => setOpenAIKey(e.target.value)}
                        placeholder="sk-..."
                        className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                        Your API key will be stored securely in your browser.
                        You can get an API key from{" "}
                        <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            OpenAI&apos;s website
                        </a>
                        .
                    </p>
                </div>

                {openAIKeyError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{openAIKeyError}</AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-col space-y-2">
                    <Button onClick={handleSaveApiKey}>Save API Key</Button>
                </div>
            </div>
        </div>
    )

    // Add effect to check validity whenever relevant values change
    useEffect(() => {
        const isValid = Boolean(
            elementTemplate &&
            vectorTemplate &&
            metadata?.embedding
        )
        onValidityChange?.(isValid)

        if (isValid) {
            onConfigured?.({
                elementTemplate,
                vectorTemplate,
                selectedAttributes: selectedAttributeColumns,
            })
        }
    }, [elementTemplate, vectorTemplate, metadata?.embedding, selectedAttributeColumns])

    return (
        <div className="space-y-4 w-full">
            <div className="pb-2">
                <div className="text-right text-sm text-muted-foreground">
                    File: {csvPreview.fileName}
                </div>
            </div>

            {isCheckingOpenAIKey ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                    <p className="text-center">
                        Checking OpenAI API configuration...
                    </p>
                </div>
            ) : isOpenAIKeyAvailable === false ? (
                renderOpenAIKeySetup()
            ) : isGeneratingTemplates ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                    <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                    <p className="text-center">
                        Analyzing your data and generating optimal templates...
                    </p>
                </div>
            ) : suggestedElementTemplate && suggestedVectorTemplate ? (
                <div className="space-y-8">
                    {showAttributesSection ? (
                        <AttributesConfigurator
                            csvPreview={csvPreview}
                            selectedAttributeColumns={selectedAttributeColumns}
                            onAttributeToggle={handleAttributeToggle}
                        />
                    ) : (
                        <>
                            {/* Step 1: Templates */}
                            <div className="space-y-4">
                                <div className="border-b pb-2">
                                    <p className="text-sm mt-1">
                                        Create natural language templates using
                                        your data fields. For better results,
                                        write complete sentences that provide
                                        context for each field. For example:
                                        {`"`}Book titled &#123;bookTitle&#125; by
                                        &#123;author&#125; was published in
                                        &#123;publishedYear&#125;{`"`}.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label>Element Template</Label>
                                                <p className="text-sm text-muted-foreground">
                                                    Defines how to identify each
                                                    element
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setShowElementEditor(
                                                        !showElementEditor
                                                    )
                                                }
                                            >
                                                {showElementEditor
                                                    ? "Hide Editor"
                                                    : "Edit"}
                                            </Button>
                                        </div>
                                        {showElementEditor ? (
                                            <>
                                                <Textarea
                                                    ref={elementTemplateRef}
                                                    value={elementTemplate}
                                                    onChange={(e) =>
                                                        setElementTemplate(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="min-h-[120px] font-mono"
                                                />
                                                <div className="mt-2 p-2 bg-muted rounded-md">
                                                    {renderHighlightedTemplate(
                                                        elementTemplate
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {csvPreview.headers.map(
                                                        (header) => (
                                                            <Button
                                                                key={header}
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    insertColumnIntoTemplate(
                                                                        elementTemplate,
                                                                        header,
                                                                        setElementTemplate,
                                                                        elementTemplateRef as React.RefObject<HTMLTextAreaElement>
                                                                    )
                                                                }
                                                            >
                                                                {header}
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mt-2 p-2 bg-muted rounded-md">
                                                {renderHighlightedTemplate(
                                                    elementTemplate
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <Label>
                                                    Vector Content Template
                                                </Label>
                                                <p className="text-sm text-muted-foreground">
                                                    The text that will be
                                                    converted into a vector
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setShowVectorEditor(
                                                        !showVectorEditor
                                                    )
                                                }
                                            >
                                                {showVectorEditor
                                                    ? "Hide Editor"
                                                    : "Edit"}
                                            </Button>
                                        </div>
                                        {showVectorEditor ? (
                                            <>
                                                <Textarea
                                                    ref={vectorTemplateRef}
                                                    value={vectorTemplate}
                                                    onChange={(e) =>
                                                        setVectorTemplate(
                                                            e.target.value
                                                        )
                                                    }
                                                    className="min-h-[120px] font-mono"
                                                />
                                                <div className="mt-2 p-2 bg-muted rounded-md">
                                                    {renderHighlightedTemplate(
                                                        vectorTemplate
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {csvPreview.headers.map(
                                                        (header) => (
                                                            <Button
                                                                key={header}
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() =>
                                                                    insertColumnIntoTemplate(
                                                                        vectorTemplate,
                                                                        header,
                                                                        setVectorTemplate,
                                                                        vectorTemplateRef as React.RefObject<HTMLTextAreaElement>
                                                                    )
                                                                }
                                                            >
                                                                {header}
                                                            </Button>
                                                        )
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="mt-2 p-2 bg-muted rounded-md">
                                                {renderHighlightedTemplate(
                                                    vectorTemplate
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Preview Section */}
                            <div className="space-y-4">
                                <div className="border-b pb-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold">
                                                Preview
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                See how your templates will look
                                                with actual data.
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setShowPreview(!showPreview)
                                            }
                                            className="flex items-center gap-2"
                                        >
                                            {showPreview ? (
                                                <>
                                                    Hide Preview{" "}
                                                    <ChevronUp className="h-4 w-4" />
                                                </>
                                            ) : (
                                                <>
                                                    Show Preview{" "}
                                                    <ChevronDown className="h-4 w-4" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {showPreview &&
                                    csvPreview.sampleRows.length > 0 && (
                                        <div className="space-y-4 border rounded-lg p-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-medium">
                                                    Sample Data Preview
                                                </h4>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={cycleSamplePreview}
                                                >
                                                    Next Sample
                                                </Button>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs">
                                                        Element Name:
                                                    </Label>
                                                    <div className="p-2 bg-muted rounded-md text-sm mt-1">
                                                        {renderTemplateWithData(
                                                            elementTemplate,
                                                            previewSampleIndex
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label className="text-xs">
                                                        Vector Content:
                                                    </Label>
                                                    <div className="p-2 bg-muted rounded-md text-sm mt-1">
                                                        {renderTemplateWithData(
                                                            vectorTemplate,
                                                            previewSampleIndex
                                                        )}
                                                    </div>
                                                </div>

                                                {selectedAttributeColumns.length >
                                                    0 && (
                                                        <div>
                                                            <Label className="text-xs">
                                                                Selected Attributes:
                                                            </Label>
                                                            <div className="p-2 bg-muted rounded-md text-sm mt-1">
                                                                {selectedAttributeColumns.map(
                                                                    (attr) => (
                                                                        <div
                                                                            key={
                                                                                attr
                                                                            }
                                                                            className="flex gap-2"
                                                                        >
                                                                            <span className="font-medium">
                                                                                {
                                                                                    attr
                                                                                }
                                                                                :
                                                                            </span>
                                                                            <span>
                                                                                {String(
                                                                                    csvPreview
                                                                                        .sampleRows[
                                                                                    previewSampleIndex
                                                                                    ][
                                                                                    attr
                                                                                    ]
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                            </div>
                                        </div>
                                    )}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Failed to generate templates. Please try again or
                        contact support if the problem persists.
                    </AlertDescription>
                </Alert>
            )}

            {importStarted && (
                <Alert variant="default" className="w-full mt-4">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                        Import started! You can view progress and manage the
                        import from the main screen.
                    </AlertDescription>
                </Alert>
            )}

            {!hideImportButton && (
                <div className="flex gap-2 justify-end mt-4 pt-4 border-t w-full">
                    <Button
                        type="button"
                        variant="default"
                        onClick={handleImport}
                        disabled={
                            isImporting ||
                            !metadata?.embedding ||
                            !elementTemplate ||
                            !vectorTemplate
                        }
                    >
                        {isImporting
                            ? "Starting Import..."
                            : "Next"}
                    </Button>
                </div>
            )}
        </div>
    )
}
