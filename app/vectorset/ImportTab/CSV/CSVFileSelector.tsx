import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import { useRef, useState } from "react"

export interface CSVPreviewData {
    totalRecords: number
    headers: string[]
    sampleRows: Record<string, string | number>[]
    fileName: string
    fileContent: string
}

interface CSVFileSelectorProps {
    metadata: VectorSetMetadata | null
    onFileSelected: (preview: CSVPreviewData) => void
}

export default function CSVFileSelector({
    metadata,
    onFileSelected,
}: CSVFileSelectorProps) {
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!event.target.files || event.target.files.length === 0) {
            return
        }

        const file = event.target.files[0]

        try {
            setError(null)
            const text = await file.text()
            const fileExtension = file.name.split(".").pop()?.toLowerCase()

            if (fileExtension !== "csv") {
                setError(`Unsupported file type. Please upload a CSV file.`)
                return
            }

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
                    const numberWithoutCommas = value.replace(/,/g, "")
                    const parsedNumber = parseFloat(numberWithoutCommas)
                    return isNaN(parsedNumber) ? value : parsedNumber
                }

                // Extract numbers from text with units (e.g., "160 min" → 160)
                const numberWithUnitsMatch = value.match(
                    /^-?(\d+(?:,\d+)*(?:\.\d+)?)\s+\w+/
                )
                if (numberWithUnitsMatch) {
                    const numberPart = numberWithUnitsMatch[1].replace(/,/g, "")
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

            const preview: CSVPreviewData = {
                totalRecords: lines.length - 1,
                headers,
                sampleRows,
                fileName: file.name,
                fileContent: text,
            }

            // Validate dimensions
            if (!metadata?.embedding) {
                setError(
                    "Please configure an embedding engine before importing data"
                )
                return
            }

            // Validate file size
            if (preview.totalRecords > 10000) {
                setError(
                    "Warning: Large file detected. Import may take several minutes."
                )
            }

            onFileSelected(preview)
        } catch (error) {
            console.error("Error reading file:", error)
            setError(`Error reading file: ${error}`)
        }
    }

    return (
        <div className="w-full">
            <div className="text-lg font-medium">
                Select a file to get started
            </div>

            <p className="text-sm text-muted-foreground mt-2">
                Import a CSV file to create a new vector set. The first row
                should contain column headers.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
                Each item will be embedded using the embedding engine configured
                in the vector set.
            </p>

            <div className="w-full p-4 flex items-center justify-center mt-4">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv"
                    className="hidden"
                />
                <Button
                    type="button"
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-[300px]"
                >
                    Select CSV file
                </Button>
            </div>

            {!metadata?.embedding && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        Please configure an embedding engine in the vector set
                        settings before importing data.
                    </AlertDescription>
                </Alert>
            )}

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}
