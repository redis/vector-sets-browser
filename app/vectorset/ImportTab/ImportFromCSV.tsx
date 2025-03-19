"use client"

import { ApiError } from "@/app/api/client"
import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { generateEmbeddingTemplate } from "@/app/api/openai"
import { userSettings } from "@/app/utils/userSettings"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Info, Sparkles } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { VectorSetMetadata } from "@/app/embeddings/types/config"

interface ImportFromCSVProps {
    onClose: () => void
    metadata: VectorSetMetadata | null
    vectorSetName?: string | null
}

export default function ImportFromCSV({
    onClose,
    metadata,
    vectorSetName,
}: ImportFromCSVProps) {
    const [error, setError] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)
    const [csvPreview, setCsvPreview] = useState<{
        totalRecords: number
        headers: string[]
        sampleRows: Record<string, string | number>[]
        fileName: string
    } | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [selectedElementColumn, setSelectedElementColumn] =
        useState<string>("")
    const [selectedVectorColumn, setSelectedVectorColumn] = useState<string>("")
    const [selectedAttributeColumns, setSelectedAttributeColumns] = useState<
        string[]
    >([])
    const [elementTemplate, setElementTemplate] = useState<string>("")
    const [vectorTemplate, setVectorTemplate] = useState<string>("")
    const [activeTab, setActiveTab] = useState<string>("ai")
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
    const [openAIKeyError, setOpenAIKeyError] = useState<string | null>(null)
    const [isOpenAIKeyAvailable, setIsOpenAIKeyAvailable] = useState<
        boolean | null
    >(null)
    const [isCheckingOpenAIKey, setIsCheckingOpenAIKey] = useState(false)
    const [showSampleData, setShowSampleData] = useState(false)

    // Check if OpenAI key is available
    useEffect(() => {
        const checkOpenAIKey = () => {
            setIsCheckingOpenAIKey(true)
            try {
                // Check if key exists in settings
                const savedKey = userSettings.get<string>("openai_api_key")

                // Check if environment variable is available (this will be handled server-side)
                // For client-side, we'll just check if settings has a key
                setIsOpenAIKeyAvailable(!!savedKey)
            } catch (error) {
                console.error("Error checking OpenAI key:", error)
                setIsOpenAIKeyAvailable(false)
            } finally {
                setIsCheckingOpenAIKey(false)
            }
        }

        checkOpenAIKey()
    }, [])

    useEffect(() => {
        async function loadApiKey() {
            const savedKey = userSettings.get<string>("openai_api_key")
            if (savedKey) {
                setOpenAIKey(savedKey)
            }
        }
        loadApiKey()
    }, [])

    // Function to save OpenAI key
    const handleSaveApiKey = async () => {
        if (openAIKey) {
            userSettings.set("openai_api_key", openAIKey)
            toast.success("OpenAI API key saved successfully")
            setOpenAIKeyError(null) // Clear any previous error
        }
    }

    // Function to generate template suggestions using OpenAI
    const generateTemplateSuggestions = async (
        headers: string[],
        sampleRows: Record<string, string | number>[]
    ) => {
        if (!headers.length || !sampleRows.length) return

        setIsGeneratingTemplates(true)

        try {
            // Format sample rows for the prompt
            const sampleRowsArray = sampleRows.map((row) =>
                Object.values(row).join(", ")
            )

            const template = await generateEmbeddingTemplate(
                headers,
                sampleRowsArray
            )

            if (!template.elementTemplate || !template.embeddingTemplate) {
                throw new Error("Failed to generate template suggestions")
            }

            // Update state with the generated templates
            setSuggestedElementTemplate(template.elementTemplate)
            setSuggestedVectorTemplate(template.embeddingTemplate)

            // If we're in AI mode, automatically apply the suggestions
            if (activeTab === "ai") {
                setElementTemplate(template.elementTemplate)
                setVectorTemplate(template.embeddingTemplate)
            }
        } catch (error) {
            console.error("Error generating template suggestions:", error)
            setError(
                "Failed to generate template suggestions. You can still create templates manually."
            )
            // If we get an authentication error, the key might be invalid
            if (
                error instanceof Error && 
                (error.toString().includes("authentication") ||
                error.toString().includes("API key"))
            ) {
                setIsOpenAIKeyAvailable(false)
            }
        } finally {
            setIsGeneratingTemplates(false)
        }
    }

    // When a file is loaded and we have preview data, generate template suggestions
    useEffect(() => {
        if (csvPreview?.headers && csvPreview.sampleRows.length > 0) {
            generateTemplateSuggestions(
                csvPreview.headers,
                csvPreview.sampleRows
            )
        }
    }, [csvPreview])

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!event.target.files || event.target.files.length === 0) {
            return
        }

        const file = event.target.files[0]
        setSelectedFile(file)

        try {
            // Reset states
            setError(null)
            setImportStarted(false)
            setSelectedElementColumn("")
            setSelectedVectorColumn("")
            setSelectedAttributeColumns([])
            setElementTemplate("")
            setVectorTemplate("")
            setSuggestedElementTemplate("")
            setSuggestedVectorTemplate("")
            setShowElementEditor(false)
            setShowVectorEditor(false)
            setShowPreview(false)
            setActiveTab("ai")

            // Read file for preview
            const text = await file.text()

            // Parse CSV with proper quote handling
            const parseCSVLine = (line: string): string[] => {
                const fields: string[] = []
                let field = ""
                let inQuotes = false
                let i = 0

                while (i < line.length) {
                    const char = line[i]

                    if (char === '"') {
                        if (
                            inQuotes &&
                            i + 1 < line.length &&
                            line[i + 1] === '"'
                        ) {
                            // Handle escaped quotes
                            field += '"'
                            i++
                        } else {
                            // Toggle quote mode
                            inQuotes = !inQuotes
                        }
                    } else if (char === "," && !inQuotes) {
                        // End of field
                        fields.push(field.trim())
                        field = ""
                    } else {
                        field += char
                    }
                    i++
                }

                // Add the last field
                fields.push(field.trim())
                return fields
            }

            // Parse numeric values and handle comma-separated numbers
            const processValue = (value: string): string | number => {
                // Remove commas from numbers (e.g., "1,234.56" or "123,100,000" → numeric value)
                if (/^-?[\d,]+(\.\d+)?$/.test(value)) {
                    const numberWithoutCommas = value.replace(/,/g, '')
                    const parsedNumber = parseFloat(numberWithoutCommas)
                    return isNaN(parsedNumber) ? value : parsedNumber
                }
                
                // Extract numbers from text with units (e.g., "160 min" → 160)
                const numberWithUnitsMatch = value.match(/^-?(\d+(?:,\d+)*(?:\.\d+)?)\s+\w+/)
                if (numberWithUnitsMatch) {
                    const numberPart = numberWithUnitsMatch[1].replace(/,/g, '')
                    const parsedNumber = parseFloat(numberPart)
                    return isNaN(parsedNumber) ? value : parsedNumber
                }
                
                return value
            }

            const lines = text
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)

            const headers = parseCSVLine(lines[0])

            // Parse first few rows for preview
            const sampleRows = lines.slice(1, 4).map((line) => {
                const values = parseCSVLine(line)
                return headers.reduce((obj, header, i) => {
                    // Process the value to handle numeric data correctly
                    obj[header] = values[i] ? processValue(values[i]) : ""
                    return obj
                }, {} as Record<string, string | number>)
            })

            setCsvPreview({
                totalRecords: lines.length - 1,
                headers,
                sampleRows,
                fileName: file.name,
            })

            // Validate dimensions
            if (!metadata?.embedding) {
                setError(
                    "Please configure an embedding engine before importing data"
                )
                return
            }

            // Validate file size
            if (lines.length > 10000) {
                setError(
                    "Warning: Large file detected. Import may take several minutes."
                )
            }

            // Clear any previous errors
            setError(null)
        } catch (error) {
            console.error("Error reading file:", error)
            setError(`Error reading file: ${error}`)
        }
    }

    const handleAttributeToggle = (column: string) => {
        setSelectedAttributeColumns((prev) =>
            prev.includes(column)
                ? prev.filter((c) => c !== column)
                : [...prev, column]
        )
    }

    const insertColumnIntoTemplate = (
        template: string,
        column: string,
        setter: (value: string) => void,
        textareaRef: React.RefObject<HTMLTextAreaElement>
    ) => {
        if (textareaRef.current) {
            const textarea = textareaRef.current
            const start = textarea.selectionStart
            const end = textarea.selectionEnd

            const newTemplate =
                template.substring(0, start) +
                `\${${column}}` +
                template.substring(end)

            setter(newTemplate)

            // Set focus back to textarea and position cursor after the inserted template
            setTimeout(() => {
                textarea.focus()
                const newCursorPos = start + `\${${column}}`.length
                textarea.setSelectionRange(newCursorPos, newCursorPos)
            }, 0)
        } else {
            // Fallback if ref is not available
            const newTemplate = template + `\${${column}}`
            setter(newTemplate)
        }
    }

    // Function to render template with highlighted column references
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

    const handleImport = async () => {
        if (!selectedFile || !vectorSetName || !csvPreview) return

        if (activeTab === "manual") {
            if (!selectedElementColumn) {
                setError(
                    "Please select a column to use as the element identifier"
                )
                return
            }

            if (!selectedVectorColumn) {
                setError("Please select a column to encode as a vector")
                return
            }
        } else {
            // AI mode
            if (!elementTemplate) {
                setError("Please provide a template for the element identifier")
                return
            }

            if (!vectorTemplate) {
                setError("Please provide a template for the vector content")
                return
            }
        }

        setIsImporting(true)

        const config: ImportJobConfig = {
            delimiter: ",",
            hasHeader: true,
            skipRows: 0,
            elementColumn:
                activeTab === "manual"
                    ? selectedElementColumn
                    : csvPreview.headers[0],
            textColumn:
                activeTab === "manual"
                    ? selectedVectorColumn
                    : csvPreview.headers[0],
            elementTemplate: activeTab === "ai" ? elementTemplate : undefined,
            textTemplate: activeTab === "ai" ? vectorTemplate : undefined,
            attributeColumns:
                selectedAttributeColumns.length > 0
                    ? selectedAttributeColumns
                    : undefined,
            preserveNumericValues: true,
            metadata: metadata || undefined,
        }

        try {
            await jobs.createImportJob(vectorSetName, selectedFile, config)
            setImportStarted(true)
            setShowSuccessDialog(true)
            setIsImporting(false)
        } catch (error) {
            console.error("Error importing file:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Error importing file"
            )
            setIsImporting(false)
        }
    }

    // Function to apply suggested templates
    const applyTemplateSuggestions = () => {
        if (suggestedElementTemplate) {
            setElementTemplate(suggestedElementTemplate)
        }
        if (suggestedVectorTemplate) {
            setVectorTemplate(suggestedVectorTemplate)
        }
    }

    // Function to render a preview of the template with actual data
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

    // Function to cycle through sample rows for preview
    const cycleSamplePreview = () => {
        if (!csvPreview?.sampleRows.length) return
        setPreviewSampleIndex((prevIndex) =>
            prevIndex >= csvPreview.sampleRows.length - 1 ? 0 : prevIndex + 1
        )
    }

    // Add a tooltip to show the type of a value
    const getValueTypeInfo = (value: string | number) => {
        const type = typeof value
        if (type === 'number') {
            return `Number: ${value}`
        } else {
            // Check if it should have been converted to a number
            if (/^[\d,]+(\.\d+)?$/.test(value as string)) {
                return `String: "${value}" (Could be converted to number)`
            }
            const numberWithUnitsMatch = (value as string).match(/^(\d+(?:,\d+)?(?:\.\d+)?)\s+\w+/)
            if (numberWithUnitsMatch) {
                return `String: "${value}" (Contains number: ${numberWithUnitsMatch[1]})`
            }
            return `String: "${value}"`
        }
    }

    // Render OpenAI key setup screen
    const renderOpenAIKeySetup = () => {
        return (
            <div className="space-y-6 py-4">
                <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>
                        The AI Import feature requires an OpenAI API key to
                        analyze your CSV data and create optimal templates.
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
                            Your API key will be stored securely in your
                            browser. You can get an API key from{" "}
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
                            <AlertDescription>
                                {openAIKeyError}
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex flex-col space-y-2">
                        <Button onClick={handleSaveApiKey}>Save API Key</Button>
                        <Button
                            variant="outline"
                            onClick={() => setActiveTab("manual")}
                        >
                            Continue with Manual Import Instead
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex flex-col h-full w-full min-h-[500px]">
                <div className="w-full">
                    <div className="text-lg font-medium">Import from CSV</div>

                    <p className="text-sm text-muted-foreground mt-2">
                        Import a CSV file to create a new vector set. The first
                        row of the CSV file should contain the column headers.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Each item will be embedded using the embedding engine
                        configured in the vector set.
                    </p>

                    <div className="w-full mt-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".csv"
                            className="hidden"
                        />
                        <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full"
                            disabled={isImporting}
                        >
                            Select CSV File
                        </Button>
                    </div>



                    {!metadata?.embedding && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                Please configure an embedding engine in the
                                vector set settings before importing data.
                            </AlertDescription>
                        </Alert>
                    )}

                    {csvPreview && (
                        <div className="space-y-4 w-full">
                            <div>
                                <div className="text-lg">File Preview</div>
                                <div className="text-sm text-muted-foreground">
                                    {csvPreview.fileName} -{" "}
                                    {csvPreview.totalRecords} records
                                </div>
                            </div>

                            <Tabs
                                value={activeTab}
                                onValueChange={setActiveTab}
                                className="w-full"
                            >
                                <TabsList className="grid grid-cols-2 mb-4">
                                    <TabsTrigger value="ai">
                                        AI Import
                                    </TabsTrigger>
                                    <TabsTrigger value="manual">
                                        Manual
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="manual"
                                    className="space-y-4"
                                >
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="element-column">
                                                Element Identifier Column
                                            </Label>
                                            <Select
                                                value={selectedElementColumn}
                                                onValueChange={
                                                    setSelectedElementColumn
                                                }
                                            >
                                                <SelectTrigger id="element-column">
                                                    <SelectValue placeholder="Select column" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {csvPreview.headers.map(
                                                        (header) => (
                                                            <SelectItem
                                                                key={header}
                                                                value={header}
                                                            >
                                                                {header}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                This column will be used as the
                                                unique identifier for each
                                                vector
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="vector-column">
                                                Vector Content Column
                                            </Label>
                                            <Select
                                                value={selectedVectorColumn}
                                                onValueChange={
                                                    setSelectedVectorColumn
                                                }
                                            >
                                                <SelectTrigger id="vector-column">
                                                    <SelectValue placeholder="Select column" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {csvPreview.headers.map(
                                                        (header) => (
                                                            <SelectItem
                                                                key={header}
                                                                value={header}
                                                            >
                                                                {header}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-xs text-muted-foreground">
                                                This column&apos;s text will be
                                                encoded as a vector
                                            </p>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="ai" className="space-y-4">
                                    {isCheckingOpenAIKey ? (
                                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                            <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                                            <p className="text-center">
                                                Checking OpenAI API
                                                configuration...
                                            </p>
                                        </div>
                                    ) : isOpenAIKeyAvailable === false ? (
                                        renderOpenAIKeySetup()
                                    ) : (
                                        <>
                                            <Alert className="mb-4">
                                                <Info className="h-4 w-4" />
                                                <AlertDescription>
                                                    AI Import automatically
                                                    creates optimal templates
                                                    for your data by analyzing
                                                    your CSV columns and
                                                    content.
                                                </AlertDescription>
                                            </Alert>

                                            {isGeneratingTemplates && (
                                                <div className="flex flex-col items-center justify-center py-8 space-y-4">
                                                    <Sparkles className="h-8 w-8 text-amber-500 animate-pulse" />
                                                    <p className="text-center">
                                                        Analyzing your data and
                                                        generating optimal
                                                        templates...
                                                    </p>
                                                </div>
                                            )}

                                            {!isGeneratingTemplates &&
                                                suggestedElementTemplate &&
                                                suggestedVectorTemplate && (
                                                    <div className="space-y-6">
                                                        <div className="flex justify-end mb-2">
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={applyTemplateSuggestions}
                                                            >
                                                                Reapply AI Suggestions
                                                            </Button>
                                                        </div>
                                                        <div className="space-y-3 border rounded-lg p-4">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-base font-medium">
                                                                    AI Suggested
                                                                    Element Name
                                                                </Label>
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

                                                            <div className="p-3 bg-muted rounded-md">
                                                                {renderHighlightedTemplate(
                                                                    elementTemplate
                                                                )}
                                                            </div>

                                                            {showElementEditor && (
                                                                <div className="space-y-2 mt-3 pt-3 border-t">
                                                                    <Label htmlFor="element-template">
                                                                        Edit
                                                                        Element
                                                                        Template
                                                                    </Label>
                                                                    <Textarea
                                                                        id="element-template"
                                                                        ref={
                                                                            elementTemplateRef
                                                                        }
                                                                        value={
                                                                            elementTemplate
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setElementTemplate(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className="min-h-[80px]"
                                                                    />
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {csvPreview.headers.map(
                                                                            (
                                                                                header
                                                                            ) => (
                                                                                <Button
                                                                                    key={
                                                                                        header
                                                                                    }
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        insertColumnIntoTemplate(
                                                                                            elementTemplate,
                                                                                            header,
                                                                                            setElementTemplate,
                                                                                            elementTemplateRef
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        header
                                                                                    }
                                                                                </Button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="space-y-3 border rounded-lg p-4">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-base font-medium">
                                                                    AI Suggested
                                                                    Embedding
                                                                    Template
                                                                </Label>
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

                                                            <div className="p-3 bg-muted rounded-md">
                                                                {renderHighlightedTemplate(
                                                                    vectorTemplate
                                                                )}
                                                            </div>

                                                            {showVectorEditor && (
                                                                <div className="space-y-2 mt-3 pt-3 border-t">
                                                                    <Label htmlFor="vector-template">
                                                                        Edit
                                                                        Embedding
                                                                        Template
                                                                    </Label>
                                                                    <Textarea
                                                                        id="vector-template"
                                                                        ref={
                                                                            vectorTemplateRef
                                                                        }
                                                                        value={
                                                                            vectorTemplate
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            setVectorTemplate(
                                                                                e
                                                                                    .target
                                                                                    .value
                                                                            )
                                                                        }
                                                                        className="min-h-[120px]"
                                                                    />
                                                                    <div className="flex flex-wrap gap-1 mt-2">
                                                                        {csvPreview.headers.map(
                                                                            (
                                                                                header
                                                                            ) => (
                                                                                <Button
                                                                                    key={
                                                                                        header
                                                                                    }
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() =>
                                                                                        insertColumnIntoTemplate(
                                                                                            vectorTemplate,
                                                                                            header,
                                                                                            setVectorTemplate,
                                                                                            vectorTemplateRef
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        header
                                                                                    }
                                                                                </Button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-2">
                                                                        For best
                                                                        results,
                                                                        include
                                                                        all
                                                                        relevant
                                                                        information
                                                                        in the
                                                                        template.
                                                                        The more
                                                                        context
                                                                        provided,
                                                                        the
                                                                        better
                                                                        the
                                                                        embedding
                                                                        will
                                                                        represent
                                                                        your
                                                                        data.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="mt-4">
                                                            <Button
                                                                variant="outline"
                                                                onClick={() =>
                                                                    setShowPreview(
                                                                        !showPreview
                                                                    )
                                                                }
                                                                className="w-full"
                                                            >
                                                                {showPreview
                                                                    ? "Hide Preview"
                                                                    : "Show Preview with Sample Data"}
                                                            </Button>

                                                            {showPreview &&
                                                                csvPreview
                                                                    .sampleRows
                                                                    .length >
                                                                    0 && (
                                                                    <div className="mt-3 space-y-4 border rounded-lg p-4">
                                                                        <div className="flex items-center justify-between">
                                                                            <h4 className="text-sm font-medium">
                                                                                Preview
                                                                                with
                                                                                Sample
                                                                                Data
                                                                            </h4>
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={
                                                                                    cycleSamplePreview
                                                                                }
                                                                            >
                                                                                Next
                                                                                Sample
                                                                            </Button>
                                                                        </div>

                                                                        <div className="space-y-3">
                                                                            <div>
                                                                                <Label className="text-xs">
                                                                                    Element
                                                                                    Name:
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
                                                                                    Embedding
                                                                                    Text:
                                                                                </Label>
                                                                                <div className="p-2 bg-muted rounded-md text-sm mt-1 max-h-[150px] overflow-y-auto">
                                                                                    {renderTemplateWithData(
                                                                                        vectorTemplate,
                                                                                        previewSampleIndex
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                )}
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>

                            <div className="space-y-2">
                                <Label>Attribute Columns (Optional)</Label>
                                <ScrollArea className="h-32 border rounded-md p-2">
                                    <div className="space-y-2">
                                        {csvPreview.headers.map((header) => (
                                            <div
                                                key={header}
                                                className="flex items-center space-x-2"
                                            >
                                                <Checkbox
                                                    id={`attr-${header}`}
                                                    checked={selectedAttributeColumns.includes(
                                                        header
                                                    )}
                                                    onCheckedChange={() =>
                                                        handleAttributeToggle(
                                                            header
                                                        )
                                                    }
                                                />
                                                <Label
                                                    htmlFor={`attr-${header}`}
                                                >
                                                    {header}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                                <p className="text-xs text-muted-foreground">
                                    Selected columns will be stored as
                                    attributes with each vector
                                </p>
                            </div>

                            <div className="mt-4">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setShowSampleData(!showSampleData)
                                    }
                                    className="w-full"
                                >
                                    {showSampleData
                                        ? "Hide Sample Data"
                                        : "Show Sample Data"}
                                </Button>

                                {showSampleData && (
                                    <div className="mt-3">
                                        <div className="text-lg mb-2">
                                            Sample Data
                                        </div>
                                        <div className="w-full max-w-full overflow-scroll border rounded-lg">
                                            <div className="max-w-[600px]">
                                                <table className="w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-0">
                                                        <tr>
                                                            {csvPreview.headers.map(
                                                                (header) => (
                                                                    <th
                                                                        key={
                                                                            header
                                                                        }
                                                                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                                    >
                                                                        {header}
                                                                    </th>
                                                                )
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {csvPreview.sampleRows.map(
                                                            (row, i) => (
                                                                <tr key={i}>
                                                                    {csvPreview.headers.map(
                                                                        (
                                                                            header
                                                                        ) => (
                                                                            <td
                                                                                key={
                                                                                    header
                                                                                }
                                                                                className={`px-6 py-4 text-sm ${typeof row[header] === 'number' ? 'font-semibold text-blue-600' : 'text-gray-500'} max-w-[300px] truncate`}
                                                                                title={getValueTypeInfo(row[header])}
                                                                            >
                                                                                {
                                                                                    row[
                                                                                        header
                                                                                    ]
                                                                                }
                                                                            </td>
                                                                        )
                                                                    )}
                                                                </tr>
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1" />

                {error && (
                    <Alert
                        variant={
                            error.includes("Warning:")
                                ? "default"
                                : "destructive"
                        }
                        className="w-full mt-4"
                    >
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
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

                <div className="flex gap-2 justify-end mt-4 pt-4 border-t w-full">
                    {csvPreview && (
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleImport}
                            disabled={
                                isImporting ||
                                !metadata?.embedding ||
                                (activeTab === "manual" &&
                                    (!selectedElementColumn ||
                                        !selectedVectorColumn)) ||
                                (activeTab === "ai" &&
                                    (!elementTemplate || !vectorTemplate))
                            }
                        >
                            {isImporting
                                ? "Starting Import..."
                                : "Start Import"}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog
                open={showSuccessDialog}
                onOpenChange={(open) => {
                    setShowSuccessDialog(open)
                    if (!open) {
                        onClose()
                    }
                }}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Import Started Successfully</DialogTitle>
                        <DialogDescription>
                            <p className="p-4">
                                Your data import has started. For large files
                                this may take a long time. You can see the
                                import status and pause/cancel on the vectorset
                                list.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => setShowSuccessDialog(false)}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
