"use client"

import { useState } from "react"
import { AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import { Dataset } from "./types/DatasetProvider"
import { datasetRegistry } from "./providers/DatasetRegistry"

interface SampleDataSelectProps {
    onSelect: (dataset: Dataset) => void
    onCancel: () => void
    selectedDataset?: string | null
    useCarousel?: boolean
}

export function SampleDataSelect({ 
    onSelect, 
    onCancel, 
    selectedDataset: initialSelectedDataset = null,
    useCarousel = false 
}: SampleDataSelectProps) {
    const [selectedDataset, setSelectedDataset] = useState<string | null>(initialSelectedDataset)
    const [error, setError] = useState<string | null>(null)

    const datasets = datasetRegistry.getAllDatasets()

    const handleSelectDataset = (dataset: Dataset) => {
        setSelectedDataset(dataset.name)
    }

    const handleContinue = async () => {
        if (!selectedDataset) {
            setError("Please select a dataset first")
            return
        }
        
        try {
            const dataset = datasetRegistry.getDatasetByName(selectedDataset)
            onSelect(dataset)
        } catch (error) {
            setError(`Dataset not found: ${selectedDataset}`)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <p className="text-gray-600 mb-4">
                Select a sample dataset to import into your vector set
            </p>

            {useCarousel ? (
                <div className="relative w-full overflow-visible px-12">
                    <Carousel 
                        className="w-full"
                        opts={{
                            align: "start",
                            slidesToScroll: 1
                        }}
                    >
                        <CarouselContent className="">
                            {datasets.map((dataset) => (
                                <CarouselItem key={dataset.name} className="pl-4 basis-full sm:basis-1/2 md:basis-1/2">
                                    <DatasetCard 
                                        dataset={dataset} 
                                        isSelected={selectedDataset === dataset.name}
                                        onSelect={handleSelectDataset}
                                    />
                                </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="absolute -left-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
                        <CarouselNext className="absolute -right-10 top-1/2 -translate-y-1/2 h-8 w-8 md:h-9 md:w-9 bg-[white] border shadow-xs" />
                    </Carousel>
                </div>
            ) :
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {datasets.map((dataset) => (
                        <DatasetCard 
                            key={dataset.name}
                            dataset={dataset} 
                            isSelected={selectedDataset === dataset.name}
                            onSelect={handleSelectDataset}
                        />
                    ))}
                </div>
            }

            <div className="flex justify-end mt-6 gap-3">
                <Button variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button 
                    variant="default" 
                    onClick={handleContinue}
                    disabled={!selectedDataset}
                >
                    Continue
                </Button>
            </div>

            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    )
}

interface DatasetCardProps {
    dataset: Dataset
    isSelected: boolean
    onSelect: (dataset: Dataset) => void
}

function DatasetCard({ dataset, isSelected, onSelect }: DatasetCardProps) {
    return (
        <div
            className={`bg-[white] rounded-md border shadow-sm overflow-hidden flex flex-col h-full
              ${isSelected ? "border-red-500 border-2" : ""}`}
            onClick={() => onSelect(dataset)}
        >
            <div className="p-4 grow">
                <div className="flex items-center mb-4">
                    <div className="mr-3 bg-gray-50 p-2 rounded-full">
                        {dataset.icon}
                    </div>
                    <h3 className="text-lg font-medium">{dataset.name}</h3>
                    <Badge variant="outline" className="ml-2">
                        {dataset.dataType}
                    </Badge>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    {dataset.description}
                </p>

                {/* Render custom preview component if available */}
                {dataset.previewComponent && (
                    <dataset.previewComponent dataset={dataset} />
                )}

                <div className="text-xs text-gray-500 mt-3">
                    <span className="font-medium">Record Count:</span>{" "}
                    {dataset.recordCount.toLocaleString()}
                </div>
            </div>
        </div>
    )
} 