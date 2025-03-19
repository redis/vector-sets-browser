"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, BookOpen, Film } from "lucide-react"
import { useState } from "react"
import { VectorSetMetadata } from "@/app/embeddings/types/config"
import { Button } from "@/components/ui/button"
import { jobs, ImportJobConfig } from "@/app/api/jobs"

interface SampleDataset {
    name: string
    description: string
    icon: React.ReactNode
    fileUrl: string
    columns: string[]
    recordCount: number
    elementTemplate: string
    vectorTemplate: string
    attributeColumns: string[]
}

interface ImportSampleDataProps {
    onClose: () => void
    metadata: VectorSetMetadata | null
    vectorSetName: string
}

export default function ImportSampleData({ onClose, metadata, vectorSetName }: ImportSampleDataProps) {
    const [error, setError] = useState<string | null>(null)
    const [isImporting, setIsImporting] = useState(false)
    const [importStarted, setImportStarted] = useState(false)
    const [showSuccessDialog, setShowSuccessDialog] = useState(false)

    const sampleDatasets: SampleDataset[] = [
        {
            name: "Goodreads Books",
            description:
                "A collection of popular books with titles, authors, descriptions, and ratings from Goodreads",
            icon: <BookOpen className="h-5 w-5 text-blue-500" />,
            fileUrl: "/sample-data/top2k_book_descriptions.csv",
            columns: [
                "title",
                "authors",
                "description",
                "average_rating",
                "isbn",
                "original_publication_year",
                "ratings_count",
                "language_code",

            ],
            recordCount: 2000,
            elementTemplate: "${title} (ISBN: ${isbn})",
            vectorTemplate: "The book titled \"${title}\", authored by ${authors}, was initially published in ${original_publication_year}. It has an average rating of ${average_rating} across ${ratings_count} ratings, and is available under ISBN ${isbn}. The description is as follows: ${description}.",
            attributeColumns: ["average_rating", "original_publication_year", "authors", "isbn", "ratings_count", "language_code"]
        },
        {
            name: "IMDB Movies",
            description:
                "A dataset of the top 1000 movies with titles, plot synopses, directors, and ratings from IMDB",
            icon: <Film className="h-5 w-5 text-amber-500" />,
            fileUrl: "/sample-data/imdb_top_1000.csv",
            columns: [
                "Poster_Link",
                "Series_Title",
                "Released_Year",
                "Certificate",
                "Runtime",
                "Genre",
                "IMDB_Rating",
                "Overview",
                "Meta_score",
                "Director",
                "Star1",
                "Star2",
                "Star3",
                "Star4",
                "No_of_Votes",
                "Gross"
            ],
            recordCount: 1000,
            elementTemplate: "${Series_Title} (${Released_Year})",
            vectorTemplate: "Movie '${Series_Title}' was released in ${Released_Year} with a runtime of ${Runtime} minutes. Directed by ${Director}, this ${Genre} film has a rating of ${IMDB_Rating} on IMDB. Overview: ${Overview}. It stars ${Star1}, ${Star2}, ${Star3}, and ${Star4}.",
            attributeColumns: ["IMDB_Rating", "Released_Year", "Director", "Genre", "Runtime", "Meta_score"]
        },
    ]

    const handleImportSampleDataset = async (dataset: SampleDataset) => {
        if (!metadata) {
            setError("Please configure an embedding engine before importing data");
            return;
        }

        setError(null);
        setIsImporting(true);

        try {
            // Step 1: Fetch the CSV file
            const response = await fetch(dataset.fileUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch sample dataset: ${response.statusText}`);
            }
            
            // Convert the response to a Blob with CSV content type
            const csvBlob = await response.blob();
            
            // Create a File object from the Blob
            const file = new File([csvBlob], `${dataset.name.toLowerCase().replace(/\s+/g, '-')}.csv`, {
                type: 'text/csv'
            });

            // Step 2: Create the import job config
            const config: ImportJobConfig = {
                delimiter: ",",
                hasHeader: true,
                skipRows: 0,
                elementColumn: dataset.columns[0], // This doesn't matter for template-based import
                textColumn: dataset.columns[0],    // This doesn't matter for template-based import
                elementTemplate: dataset.elementTemplate,
                textTemplate: dataset.vectorTemplate,
                attributeColumns: dataset.attributeColumns,
                metadata: metadata || undefined,
            };

            // Step 3: Create the import job
            await jobs.createImportJob(vectorSetName, file, config);
            
            setImportStarted(true);
            setShowSuccessDialog(true);
            setIsImporting(false);
            
            // Close the dialog after successful import
            onClose();
        } catch (error) {
            console.error("Error importing sample dataset:", error);
            setError(`Error importing sample dataset: ${error instanceof Error ? error.message : String(error)}`);
            setIsImporting(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full min-h-[500px]">
            <div className="w-full">
                <div className="text-lg font-medium mb-4">Sample Datasets</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sampleDatasets.map((dataset) => (
                        <div 
                            key={dataset.name}
                            className="bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col"
                        >
                            <div className="p-6 flex-grow">
                                <div className="flex items-center mb-4">
                                    <div className="mr-3 bg-gray-50 p-2 rounded-full">
                                        {dataset.icon}
                                    </div>
                                    <h3 className="text-lg font-medium">{dataset.name}</h3>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-4">
                                    {dataset.description}
                                </p>
                                
                                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                                    <span>Records: {dataset.recordCount.toLocaleString()}</span>
                                </div>
                                
                                <div className="text-xs text-gray-500">
                                    <span className="font-medium">Includes:</span> {dataset.columns.slice(0, 6).join(", ")}
                                    {dataset.columns.length > 6 ? "..." : ""}
                                </div>
                            </div>
                            
                            <div className="border-t p-4">
                                <Button
                                    variant="default"
                                    className="w-full"
                                    onClick={() => handleImportSampleDataset(dataset)}
                                    disabled={isImporting}
                                >
                                    {isImporting ? "Importing..." : "Import Data"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    )
}
