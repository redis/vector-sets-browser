import { Button } from "@/components/ui/button"
import { Database, FileSpreadsheet, Plus } from "lucide-react"

interface EmptyVectorSetProps {
    onAddVector: () => void
    onChangeTab: (tab: string, options?: { openSampleData?: boolean }) => void
}

export default function EmptyVectorSet({ onAddVector, onChangeTab }: EmptyVectorSetProps) {
    // Handler to change to import tab and automatically open sample data dialog
    const handleImportSamples = () => {
        onChangeTab("import", { openSampleData: true });
    };
    
    // Handler to change to import data tab
    const handleImportData = () => {
        onChangeTab("import");
    };

    return (
        <div className="flex flex-col items-center justify-center py-12 space-y-8 bg-[white] rounded-lg border border-dashed border-gray-300 p-8">
            <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-gray-800">Your Vector Set is Empty</h2>
                <p className="text-sm text-gray-500 max-w-md">
                    This vector set doesn't contain any vectors yet. You can add vectors in several ways:
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
                <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col items-center text-center space-y-4">
                    <div className="p-3 bg-blue-50 rounded-full">
                        <Plus className="h-8 w-8 text-blue-500" />
                    </div>
                    <h3 className="font-medium">Add Individual Vector</h3>
                    <p className="text-sm text-gray-500">
                        Add a single vector by providing text or a raw vector array.
                    </p>
                    <Button 
                        variant="outline" 
                        className="mt-auto"
                        onClick={onAddVector}
                    >
                        Add Vector
                    </Button>
                </div>

                <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col items-center text-center space-y-4">
                    <div className="p-3 bg-green-50 rounded-full">
                        <Database className="h-8 w-8 text-green-500" />
                    </div>
                    <h3 className="font-medium">Import Sample Data</h3>
                    <p className="text-sm text-gray-500">
                        Use pre-configured datasets like books, movies, or images.
                    </p>
                    <Button 
                        variant="outline" 
                        className="mt-auto"
                        onClick={handleImportSamples}
                    >
                        Import Samples
                    </Button>
                </div>

                <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col items-center text-center space-y-4">
                    <div className="p-3 bg-amber-50 rounded-full">
                        <FileSpreadsheet className="h-8 w-8 text-amber-500" />
                    </div>
                    <h3 className="font-medium">Import Your Data</h3>
                    <p className="text-sm text-gray-500">
                        Upload a CSV file with your own data or use the API.
                    </p>
                    <Button 
                        variant="outline" 
                        className="mt-auto"
                        onClick={handleImportData}
                    >
                        Import Data
                    </Button>
                </div>
            </div>
        </div>
    )
} 