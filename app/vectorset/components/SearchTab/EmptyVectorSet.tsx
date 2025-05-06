import { Button } from "@/components/ui/button"
import { Database, FileSpreadsheet, Plus } from "lucide-react"
import DropZone from "./components/DropZone"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { isTextEmbedding, isImageEmbedding, isMultiModalEmbedding } from "@/lib/embeddings/types/embeddingModels"

interface EmptyVectorSetProps {
    onAddVector: () => void
    onChangeTab: (tab: string, options?: { openSampleData?: boolean, openCSV?: boolean }) => void
    handleAddVector?: (element: string, embedding: number[], useCAS?: boolean) => Promise<void>
    vectorSetName?: string | null
    metadata?: VectorSetMetadata | null
}

export default function EmptyVectorSet({ 
    onAddVector, 
    onChangeTab, 
    handleAddVector,
    vectorSetName,
    metadata
}: EmptyVectorSetProps) {
    // Handler to change to import tab and automatically open sample data dialog
    const handleImportSamples = () => {
        onChangeTab("import", { openSampleData: true });
    };

    // Handler to change to import data tab and open CSV dialog
    const handleImportData = () => {
        onChangeTab("import", { openCSV: true });
    };

    // Determine the placeholder text based on embedding type
    const getEmptyStateText = () => {
        if (!metadata?.embedding) {
            return "Drag and drop files here to get started"
        }

        if (isMultiModalEmbedding(metadata.embedding)) {
            return "Drag and drop images or text files here to get started"
        } else if (isImageEmbedding(metadata.embedding)) {
            return "Drag and drop images here to get started"
        } else if (isTextEmbedding(metadata.embedding)) {
            return "Drag and drop text files here to get started"
        }

        return "Drag and drop files here to get started"
    }

    return (
        <div className="flex flex-col items-center justify-center py-4 space-y-4 bg-[white] rounded-lg border border-dashed border-gray-300 p-8">
            {/* Dropzone Area */}
            <DropZone 
                onAddVector={handleAddVector}
                metadata={metadata}
                containerStyle="empty"
            >
                <div className="flex flex-col items-center justify-center p-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-2">This vector set is empty</h3>
                    <p className="text-sm text-gray-500 mb-6 text-center">{getEmptyStateText()}</p>
                </div>
            </DropZone>

            <div className="text-center">
                <p className="text-sm text-gray-500">Or choose one of these options:</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <div
                    onClick={onAddVector}
                    className="bg-white p-6 cursor-pointer hover:border-red-500 hover:border-1 rounded-md border flex flex-col items-center text-center space-y-4"
                >
                    <div className="p-3 bg-blue-50 rounded-full">
                        <Plus className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="font-medium">Add Individual Vector</h3>
                    <p className="text-sm text-gray-500">
                        Add a single vector by providing text or a raw vector
                        array.
                    </p>
                    <Button
                        variant="default"
                        className="mt-auto w-full"
                        onClick={onAddVector}
                    >
                        Add Vector
                    </Button>
                </div>

                <div
                    onClick={handleImportSamples}
                    className="bg-white p-6 hover:border-red-500 hover:border-1 cursor-pointer rounded-md border flex flex-col items-center text-center space-y-4"
                >
                    <div className="p-3 bg-green-50 rounded-full">
                        <Database className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="font-medium">Import Sample Data</h3>
                    <p className="text-sm text-gray-500">
                        Use pre-configured datasets like books, movies, or
                        images.
                    </p>
                    <Button
                        variant="default"
                        className="mt-auto w-full"
                        onClick={handleImportSamples}
                    >
                        Import Samples
                    </Button>
                </div>

                <div
                    onClick={handleImportData}
                    className="bg-white cursor-pointer hover:border-red-500 hover:border-1 p-6 rounded-md border flex flex-col items-center text-center space-y-4"
                >
                    <div className="p-3 bg-amber-50 rounded-full">
                        <FileSpreadsheet className="h-8 w-8 text-amber-500" />
                    </div>
                    <h3 className="font-medium">Import Your Data</h3>
                    <p className="text-sm text-gray-500">
                        Upload a CSV file with your own data or use the API.
                    </p>
                    <Button
                        variant="default"
                        className="mt-auto w-full"
                        onClick={handleImportData}
                    >
                        Import Data
                    </Button>
                </div>
            </div>
        </div>
    )
} 