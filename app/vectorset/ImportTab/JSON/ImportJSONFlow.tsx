import { ImportJobConfig, jobs } from "@/app/api/jobs"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { FileJson } from "lucide-react"
import { useRef } from "react"
import ImportCard from "../ImportCard"

interface ImportJSONFlowProps {
    metadata: VectorSetMetadata | null
    vectorSetName: string
    onImportSuccess: () => void
}

export default function ImportJSONFlow({
    metadata,
    vectorSetName,
    onImportSuccess,
}: ImportJSONFlowProps) {
    const jsonFileInputRef = useRef<HTMLInputElement>(null)

    const handleJsonImport = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!metadata || !event.target.files || event.target.files.length === 0)
            return

        const file = event.target.files[0]
        try {
            // Create an import job with the JSON file
            const importJobConfig: ImportJobConfig = {
                fileType: "json",
                exportType: "redis", // We want to import to Redis
                metadata: metadata,
                // Let the server determine the appropriate columns and attributes
                // based on the JSON structure
            }

            await jobs.createImportJob(vectorSetName, file, importJobConfig)

            // Clear the file input for future imports
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = ""
            }

            // Emit the VECTORS_IMPORTED event
            eventBus.emit(AppEvents.VECTORS_IMPORTED, { vectorSetName })

            // Call onImportSuccess
            onImportSuccess()
        } catch (error) {
            console.error("Failed to import JSON data:", error)
            // Clear the file input so the user can try again
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = ""
            }
        }
    }

    return (
        <>
            <ImportCard
                icon={FileJson}
                title="Import JSON"
                description="Import test data from JSON"
                iconColor="text-purple-500"
                onClick={() => jsonFileInputRef.current?.click()}
            />
            <input
                type="file"
                ref={jsonFileInputRef}
                onChange={handleJsonImport}
                accept=".json"
                className="hidden"
            />
        </>
    )
} 