"use client"

import { useState } from "react"
import { VectorSetMetadata } from "../../types/embedding"
import { AlertCircle, BookOpen, Film } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface SampleDataset {
    name: string
    description: string
    icon: React.ReactNode
    fileUrl: string
    columns: string[]
    recordCount: number
}

export default function ImportSampleData() {
    const [error, setError] = useState<string | null>(null)

    const sampleDatasets: SampleDataset[] = [
        {
            name: "Goodreads Books",
            description:
                "A collection of popular books with titles, authors, descriptions, and ratings from Goodreads",
            icon: <BookOpen className="h-5 w-5 text-blue-500" />,
            fileUrl:
                "https://www.kaggle.com/datasets/jealousleopard/goodreadsbooks/data",
            columns: [
                "title",
                "author",
                "description",
                "rating",
                "genres",
                "published_year",
            ],
            recordCount: 1000,
        },
        {
            name: "IMDB Movies",
            description:
                "A dataset of movies with titles, plot synopses, directors, and ratings from IMDB",
            icon: <Film className="h-5 w-5 text-amber-500" />,
            fileUrl: "/sample-data/imdb-movies.csv",
            columns: [
                "title",
                "plot_synopsis",
                "director",
                "rating",
                "release_year",
                "tags",
            ],
            recordCount: 800,
        },
    ]

    return (
        <div className="flex flex-col h-full w-full min-h-[500px]">
            <div className="w-full">
                <div className="text-lg font-medium mb-4">Load Sample Data</div>
                
                <div className="overflow-hidden border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Dataset
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Records
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sampleDatasets.map((dataset) => (
                                <tr key={dataset.name} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0">
                                                {dataset.icon}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {dataset.name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {dataset.columns.join(", ")}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900">
                                            {dataset.description}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {dataset.recordCount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <a 
                                            href={dataset.fileUrl} 
                                            className="text-indigo-600 hover:text-indigo-900"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Download
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
