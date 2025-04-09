import { Database, FileJson, FileSpreadsheet } from "lucide-react"
import ImportCard from "./ImportCard"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { getModelName } from "@/app/embeddings/types/embeddingModels"

interface ImportOptionsProps {
    metadata: VectorSetMetadata | null
    onImportCSV: () => void
    onImportSample: () => void
    onImportJSON: () => void
}

export default function ImportOptions({
    metadata,
    onImportCSV,
    onImportSample,
    onImportJSON,
}: ImportOptionsProps) {
    return (
        <div>
            <p className="py-4">
                Import your data into this Vector Set to get started.
            </p>
            <p className="py-4">
                This vector set is configured to use{" "}
                <strong>{metadata?.embedding.provider}</strong>{" "}
                model:{" "}
                <strong>
                    {metadata ? getModelName(metadata.embedding) : "Unknown"}
                </strong>
                . You can change the embedding engine on the Information tab.
            </p>
            <div className="grid grid-cols-3 gap-4">
                <ImportCard
                    icon={FileSpreadsheet}
                    title="Import from CSV"
                    description="Upload your own CSV file with text data"
                    iconColor="text-blue-500"
                    onClick={onImportCSV}
                />
                <ImportCard
                    icon={Database}
                    title="Sample Data"
                    description="Import pre-configured datasets with one click"
                    iconColor="text-green-500"
                    onClick={onImportSample}
                />
                <ImportCard
                    icon={FileJson}
                    title="Import JSON"
                    description="Import test data from JSON"
                    iconColor="text-purple-500"
                    onClick={onImportJSON}
                />
            </div>
        </div>
    )
} 