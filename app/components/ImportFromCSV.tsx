"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { VectorSetMetadata } from "../types/embedding"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fileOperations } from "@/app/api/file-operations"
import { ApiError } from "@/app/api/client"
import type { ImportConfig } from "@/app/api/file-operations"

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
        sampleRows: Record<string, string>[]
        fileName: string
    } | null>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return
        }

        const file = event.target.files[0]
        setSelectedFile(file)

        try {
            // Reset states
            setError(null)
            setImportStarted(false)
            
            // Read file for preview
            const text = await file.text()
            const lines = text
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            const headers = lines[0].split(",").map((h) => h.trim())

            // Validate required columns
            const requiredColumns = ["title", "plot_synopsis", "tags"]
            const missingColumns = requiredColumns.filter(
                (col) => !headers.includes(col)
            )

            if (missingColumns.length > 0) {
                setError(
                    `CSV file is missing required columns: ${missingColumns.join(
                        ", "
                    )}`
                )
                return
            }

            // Parse first few rows for preview
            const sampleRows = lines.slice(1, 4).map((line) => {
                const values = line.split(",")
                return headers.reduce((obj, header, i) => {
                    obj[header] = values[i]?.trim() || ""
                    return obj
                }, {} as Record<string, string>)
            })

            setCsvPreview({
                totalRecords: lines.length - 1,
                headers,
                sampleRows,
                fileName: file.name,
            })

            // Validate dimensions
            if (!metadata?.embedding) {
                setError("Please configure an embedding engine before importing data")
                return
            }

            // Validate file size
            if (lines.length > 10000) {
                setError("Warning: Large file detected. Import may take several minutes.")
            }

            // Clear any previous errors
            setError(null)
        } catch (error) {
            console.error('Error reading file:', error)
            setError(`Error reading file: ${error}`)
        }
    }

    const handleImport = async () => {
        if (!selectedFile || !vectorSetName || !csvPreview) return;

        setIsImporting(true)
        
        const config: ImportConfig = {
            delimiter: ",",
            hasHeader: true,
            skipRows: 0,
            textColumn: "plot_synopsis",
            imageColumn: undefined,
            metadata: metadata || undefined
        };

        try {
            const result = await fileOperations.importFile(vectorSetName, selectedFile, config);
            setImportStarted(true)
            setShowSuccessDialog(true)
            setIsImporting(false)
        } catch (error) {
            console.error("Error importing file:", error);
            setError(error instanceof ApiError ? error.message : "Error importing file");
            setIsImporting(false)
        }
    };

    return (
        <>
            <div className="flex flex-col h-full w-full min-h-[500px]">
                <div className="w-full">
                    <div className="text-lg font-medium">Import from CSV</div>

                    <p className="text-sm text-muted-foreground mt-2">
                        Import a CSV file to create a new vector set. The first row of the CSV file should contain the column headers.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Each item will be embedded using the embedding engine configured in the vector set.
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
                                Please configure an embedding engine in the vector set settings before importing data.
                            </AlertDescription>
                        </Alert>
                    )}

                    {csvPreview && (
                        <div className="space-y-4 w-full">
                            <div>
                                <div className="text-lg">File Preview</div>
                                <div className="text-sm text-muted-foreground">
                                    {csvPreview.fileName} - {csvPreview.totalRecords} records
                                </div>
                            </div>

                            <div>
                                <div className="text-lg mb-2">Sample Data</div>
                                <div className="w-full max-w-full overflow-scroll border rounded-lg">
                                    <div className="max-w-[600px]">
                                        <table className="w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    {csvPreview.headers.map((header) => (
                                                        <th
                                                            key={header}
                                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                        >
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {csvPreview.sampleRows.map((row, i) => (
                                                    <tr key={i}>
                                                        {csvPreview.headers.map((header) => (
                                                            <td
                                                                key={header}
                                                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                                                            >
                                                                {row[header]}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1" />

                {error && (
                    <Alert variant={error.includes("Warning:") ? "default" : "destructive"} className="w-full mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {importStarted && (
                    <Alert variant="default" className="w-full mt-4">
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>Import started! You can view progress and manage the import from the main screen.</AlertDescription>
                    </Alert>
                )}

                <div className="flex gap-2 justify-end mt-4 pt-4 border-t w-full">
                    {csvPreview && (
                        <Button
                            type="button"
                            variant="default"
                            onClick={handleImport}
                            disabled={isImporting || !metadata?.embedding}
                        >
                            {isImporting ? "Starting Import..." : "Start Import"}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={showSuccessDialog} onOpenChange={(open) => {
                setShowSuccessDialog(open)
                if (!open) {
                    onClose()
                }
            }}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Import Started Successfully</DialogTitle>
                        <DialogDescription>
                            <p className="p-4">
                            Your data import has started. For large files this may take a long time. You can see the import status and pause/cancel on the vectorset list.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end">
                        <Button variant="secondary" onClick={() => setShowSuccessDialog(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
} 