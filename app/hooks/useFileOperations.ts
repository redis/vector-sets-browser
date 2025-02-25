import { useState, useRef } from "react"
import { VectorSetMetadata } from "../types/embedding"

interface CsvPreview {
    totalRecords: number
    headers: string[]
    sampleRows: Record<string, string>[]
    fileName: string
}

interface UseFileOperationsProps {
    vectorSetName: string | null
    onStatusChange: (status: string) => void
    onModalClose?: () => void
}

interface UseFileOperationsReturn {
    csvPreview: CsvPreview | null
    fileInputRef: React.RefObject<HTMLInputElement>
    isAddVectorModalOpen: boolean
    isEditConfigModalOpen: boolean
    setIsAddVectorModalOpen: (isOpen: boolean) => void
    setIsEditConfigModalOpen: (isOpen: boolean) => void
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>
    handleStartImport: () => Promise<void>
    handleSaveConfig: (vectorSetName: string, metadata: VectorSetMetadata) => Promise<void>
}

export function useFileOperations({
    onStatusChange,
    onModalClose
}: UseFileOperationsProps): UseFileOperationsReturn {
    const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null)
    const [isAddVectorModalOpen, setIsAddVectorModalOpen] = useState(false)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Validate dimensions of the CSV data
    const validateDimensions = async () => {
        if (!csvPreview) return null

        try {
            const firstRow = csvPreview.sampleRows[0]
            if (!firstRow) return null

            const textToEmbed = `${firstRow["title"]} ${firstRow["plot_synopsis"]} ${firstRow["tags"]}`

            const response = await fetch("/api/importData/validate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text: textToEmbed,
                }),
            })

            const data = await response.json()
            if (data.error) {
                return {
                    isValid: false,
                    error: data.error,
                }
            }

            return {
                isValid: true,
                dimensions: data.dimensions,
            }
        } catch (error) {
            return {
                isValid: false,
                error: `Error validating dimensions: ${error}`,
            }
        }
    }

    // Handle file selection
    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!event.target.files || event.target.files.length === 0) {
            return
        }

        const file = event.target.files[0]

        try {
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
                onStatusChange(
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
            const validation = await validateDimensions()
            if (validation && !validation.isValid) {
                onStatusChange(validation.error)
            }
        } catch (error) {
            onStatusChange(
                "Error reading CSV file: " + (error as Error).message
            )
        }
    }

    // Handle CSV import
    const handleStartImport = async () => {
        if (!csvPreview) return

        try {
            const formData = new FormData()
            if (fileInputRef.current?.files?.[0]) {
                formData.append("file", fileInputRef.current.files[0])

                const response = await fetch("/api/importData", {
                    method: "POST",
                    body: formData,
                })

                // Set up event source for progress updates
                const eventSource = new EventSource("/api/importData/progress")

                eventSource.onmessage = (event) => {
                    const data = JSON.parse(event.data)
                    if (data.error) {
                        onStatusChange(data.error)
                        eventSource.close()
                    }
                    if (data.progress === 100) {
                        eventSource.close()
                        setTimeout(() => {
                            setIsAddVectorModalOpen(false)
                            setCsvPreview(null)
                            if (onModalClose) onModalClose()
                        }, 2000)
                    }
                }

                eventSource.onerror = () => {
                    eventSource.close()
                    onStatusChange("Lost connection to server")
                }
            }
        } catch (error) {
            onStatusChange((error as Error).message)
        }
    }

    // Handle metadata configuration save
    const handleSaveConfig = async (
        vectorSetName: string,
        metadata: VectorSetMetadata
    ) => {
        console.log("[useFileOperations] Saving metadata:", metadata);
        try {
            const response = await fetch("/api/redis", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "setMetadata",
                    params: { keyName: vectorSetName, metadata },
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                console.error("[useFileOperations] Failed to save metadata:", errorData);
                throw new Error(errorData.error || "Failed to save metadata");
            }
            const data = await response.json();
            if (!data.success) {
                console.error("[useFileOperations] Save metadata failed:", data.error);
                throw new Error(data.error || "Failed to save metadata");
            }
            console.log("[useFileOperations] Metadata saved successfully:", data);
            onStatusChange("Configuration saved successfully");
            if (onModalClose) onModalClose();
        } catch (error) {
            console.error("[useFileOperations] Error saving metadata:", error);
            throw error;
        }
    };

    return {
        csvPreview,
        fileInputRef,
        isAddVectorModalOpen,
        isEditConfigModalOpen,
        setIsAddVectorModalOpen,
        setIsEditConfigModalOpen,
        handleFileChange,
        handleStartImport,
        handleSaveConfig
    }
} 