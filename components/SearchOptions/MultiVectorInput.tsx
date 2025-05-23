import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { VectorSetMetadata } from "@/lib/types/vectors"
import {
    VectorCombinationMethod
} from "@/lib/vector/vectorUtils"
import { Info, Minus, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    combinationMethodOptions,
    generateId,
    VectorInput
} from "./MultiVectorInputUtils"
import SearchInput from "./SearchInput"
import { VectorCombinationService } from "./VectorCombinationService"
import VectorSimilarityVisualizer from "./VectorSimilarityVisualizer"
import WeightVisualization from "./WeightVisualization"

interface MultiVectorInputProps {
    metadata: VectorSetMetadata | null
    dim: number | null
    onVectorCombinationGenerated: (combinedVector: number[]) => void
    triggerSearch?: () => void // Optional function to explicitly trigger search
}

export default function MultiVectorInput({
    metadata,
    dim,
    onVectorCombinationGenerated,
    triggerSearch,
}: MultiVectorInputProps) {
    // Initialize with two vector inputs by default
    const [vectorInputs, setVectorInputs] = useState<VectorInput[]>([
        { id: "1", vector: "", weight: 1.0 },
        { id: "2", vector: "", weight: 1.0 },
    ])
    
    // Add state for normalization option
    const [normalizeVector, setNormalizeVector] = useState(true)
    
    // Add state for combination method
    const [combinationMethod, setCombinationMethod] =
        useState<VectorCombinationMethod>(VectorCombinationMethod.LINEAR)
    
    // Add state to track the current combined vector
    const [combinedVector, setCombinedVector] = useState<number[] | null>(null)
    
    // Store the last combined vector to avoid unnecessary updates
    const lastCombinedVectorRef = useRef<string>("")
    
    // Debounce timer reference
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    
    // Add a new vector input
    const addVectorInput = () => {
        setVectorInputs([
            ...vectorInputs, 
            { id: generateId(), vector: "", weight: 1.0 },
        ])
    }
    
    // Remove a vector input
    const removeVectorInput = (id: string) => {
        if (vectorInputs.length > 2) {
            // Keep at least 2 inputs
            setVectorInputs(vectorInputs.filter((input) => input.id !== id))
        }
    }
    
    // Update vector input text
    const updateVectorInput = (id: string, vector: string) => {
        setVectorInputs(
            vectorInputs.map((input) =>
                input.id === id ? { ...input, vector } : input
            )
        )
    }
    
    // Update vector weight
    const updateVectorWeight = (id: string, weight: number) => {
        setVectorInputs(
            vectorInputs.map((input) =>
                input.id === id ? { ...input, weight } : input
            )
        )
    }
    
    // Toggle vector weight between positive and negative
    const toggleVectorWeight = (id: string, isPositive: boolean) => {
        setVectorInputs(
            vectorInputs.map((input) =>
                input.id === id
                    ? {
                          ...input,
                          weight: isPositive
                              ? Math.abs(input.weight)
                              : -Math.abs(input.weight),
                      }
                    : input
            )
        )
    }
    
    // Handle image selection for a vector input
    const handleImageSelect = (id: string) => (base64Data: string) => {
        // This is only for tracking which inputs have images
        setVectorInputs(
            vectorInputs.map((input) =>
                input.id === id
                    ? { ...input, imageData: base64Data || undefined }
                    : input
            )
        )
    }
    
    // Handle embedding generation for a vector input
    const handleEmbeddingGenerated = (id: string) => (embedding: number[]) => {
        if (embedding && embedding.length > 0) {
            // Format the vector as a string and update the input
            const vectorStr = VectorCombinationService.formatVector(embedding)
            updateVectorInput(id, vectorStr)
        }
    }
    
    // Memoized function to compute the combined vector with debounce
    const combineVectorsWithDebounce = useCallback(() => {
        // Clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }
        
        // Set a new timer
        debounceTimerRef.current = setTimeout(async () => {
            try {
                const combined = await VectorCombinationService.combineVectors(
                    vectorInputs,
                    metadata,
                    normalizeVector,
                    combinationMethod
                )
                
                // Only call the callback if we have a valid combined vector
                if (combined) {
                    // Stringify to check if it has changed
                    const combinedString = JSON.stringify(combined)
                    
                    // Only call the callback if the combined vector has changed
                    if (combinedString !== lastCombinedVectorRef.current) {
                        lastCombinedVectorRef.current = combinedString
                        console.log("Sending combined vector to parent")
                        setCombinedVector(combined) // Store locally for visualization
                        onVectorCombinationGenerated(combined)
                    } else {
                        console.log("Combined vector unchanged, not sending")
                    }
                } else {
                    setCombinedVector(null) // Clear if no valid combined vector
                }
            } catch (error) {
                console.error("Error in debounced vector combination:", error)
            }
        }, 300) // 300ms debounce
    }, [vectorInputs, metadata, normalizeVector, combinationMethod, onVectorCombinationGenerated])
    
    // Immediate vector combination without debounce (for method/normalization changes)
    const combineVectorsImmediately = useCallback(async () => {
        try {
            const combined = await VectorCombinationService.combineVectors(
                vectorInputs,
                metadata,
                normalizeVector,
                combinationMethod
            )
            
            // Only call the callback if we have a valid combined vector
            if (combined) {
                // Stringify to check if it has changed
                const combinedString = JSON.stringify(combined)
                
                // Only call the callback if the combined vector has changed
                if (combinedString !== lastCombinedVectorRef.current) {
                    lastCombinedVectorRef.current = combinedString
                    console.log("Sending combined vector to parent (immediate)")
                    setCombinedVector(combined) // Store locally for visualization
                    onVectorCombinationGenerated(combined)
                } else {
                    console.log("Combined vector unchanged, not sending (immediate)")
                }
            } else {
                setCombinedVector(null) // Clear if no valid combined vector
            }
        } catch (error) {
            console.error("Error in immediate vector combination:", error)
        }
    }, [vectorInputs, metadata, normalizeVector, combinationMethod, onVectorCombinationGenerated])
    
    // Manually trigger vector combination and search
    const handleSearchClick = async () => {
        console.log("Search button clicked, generating combined vector...")
        try {
            const combined = await VectorCombinationService.combineVectors(
                vectorInputs,
                metadata,
                normalizeVector,
                combinationMethod
            )
            
            if (combined) {
                // Log that we're sending a valid combined vector
                console.log(
                    "Combined vector generated successfully:",
                    combined.slice(0, 5),
                    "..."
                )
                
                // Store the combined vector locally and update parent
                setCombinedVector(combined)
                onVectorCombinationGenerated(combined)
                
                // Then explicitly trigger the search after a small delay to ensure the vector is set
                if (triggerSearch) {
                    console.log("Triggering search with combined vector...")
                    setTimeout(() => {
                        triggerSearch()
                        console.log("Search triggered")
                    }, 200)
                }
            } else {
                setCombinedVector(null)
                console.log(
                    "No valid vectors to search with. Please enter valid vector data in at least one input."
                )
            }
        } catch (error) {
            console.error("Error when triggering search:", error)
        }
    }
    
    // Effect to combine vectors when inputs change
    useEffect(() => {
        combineVectorsWithDebounce()
        
        // Cleanup
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [combineVectorsWithDebounce])
    
    // Effect to recombine vectors immediately when method or normalization changes
    useEffect(() => {
        combineVectorsImmediately()
    }, [normalizeVector, combinationMethod, combineVectorsImmediately])
    
    return (
        <div className="w-full space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium whitespace-nowrap">
                    Combine Multiple Vectors
                </h3>
                
                {/* Combination method select - moved inline */}
                <div className="flex items-center gap-2 flex-1">
                    <Select
                        value={combinationMethod}
                        onValueChange={(value) =>
                            setCombinationMethod(
                                value as VectorCombinationMethod
                            )
                        }
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                            {combinationMethodOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="cursor-help">
                                    <Info size={16} className="text-gray-500" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-md">
                                <p className="text-sm">
                                    Choose how vectors are combined:
                                </p>
                                <ul className="text-xs list-disc pl-4 mt-1 space-y-1">
                                    {combinationMethodOptions.map((option) => (
                                        <li key={option.value}>
                                            <strong>{option.label}:</strong>{" "}
                                            {option.description}
                                        </li>
                                    ))}
                                </ul>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    
                    {/* Normalize toggle - moved inline */}
                    <div className="flex items-center gap-2 ml-2">
                        <Switch
                            id="normalize-vector"
                            checked={normalizeVector}
                            onCheckedChange={setNormalizeVector}
                        />
                        <label
                            htmlFor="normalize-vector"
                            className="text-sm whitespace-nowrap"
                        >
                            Normalize
                        </label>
                    </div>
                </div>
                
                <div className="flex gap-2 ml-auto">
                    <Button 
                        onClick={handleSearchClick}
                        variant="default" 
                        size="sm"
                        className="flex items-center gap-1"
                    >
                        <Search size={16} />
                        <span>Search</span>
                    </Button>
                    <Button 
                        onClick={addVectorInput} 
                        variant="outline" 
                        size="sm"
                        className="flex items-center gap-1"
                    >
                        <Plus size={16} />
                        <span>Add Vector</span>
                    </Button>
                </div>
            </div>
            
            {/* Add weight visualization component */}
            <WeightVisualization inputs={vectorInputs} />
            
            {/* Add vector similarity visualizer */}
            <VectorSimilarityVisualizer inputs={vectorInputs} combinedVector={combinedVector} />
            
            {vectorInputs.map((input, index) => (
                <div
                    key={input.id}
                    className="border rounded p-2 space-y-2 bg-gray-50/30"
                >
                    <div className="flex items-center gap-2 py-1 w-full">
                        <div className="text-sm font-medium min-w-16 px-2 py-1 rounded bg-gray-100/60">
                            Vector {index + 1}
                        </div>
                        
                        <div className="text-xs text-gray-500 mr-1">
                            Weight:
                        </div>
                        <Slider
                            value={[Math.abs(input.weight)]}
                            min={0}
                            max={3}
                            step={0.1}
                            onValueChange={(value) =>
                                updateVectorWeight(
                                    input.id,
                                    input.weight < 0 ? -value[0] : value[0]
                                )
                            }
                            className="flex-1"
                        />
                        <div className="flex items-center gap-1">
                            <Button
                                variant={
                                    input.weight >= 0 ? "default" : "outline"
                                }
                                size="sm"
                                className="h-7 w-7 px-0"
                                onClick={() =>
                                    toggleVectorWeight(input.id, true)
                                }
                                title="Add vector (positive weight)"
                            >
                                <Plus size={14} />
                            </Button>
                            <Button
                                variant={
                                    input.weight < 0 ? "default" : "outline"
                                }
                                size="sm"
                                className="h-7 w-7 px-0"
                                onClick={() =>
                                    toggleVectorWeight(input.id, false)
                                }
                                title="Subtract vector (negative weight)"
                            >
                                <Minus size={14} />
                            </Button>
                            <Input
                                type="number"
                                value={Math.abs(input.weight)}
                                onChange={(e) => {
                                    const absValue = Math.abs(
                                        parseFloat(e.target.value)
                                    )
                                    updateVectorWeight(
                                        input.id,
                                        input.weight < 0 ? -absValue : absValue
                                    )
                                }}
                                className="w-14 h-7 text-xs"
                                min={0}
                                step={0.1}
                            />
                        </div>
                        
                        {vectorInputs.length > 2 && (
                            <Button
                                onClick={() => removeVectorInput(input.id)}
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 ml-1"
                                title="Remove vector"
                            >
                                <Minus size={16} />
                            </Button>
                        )}
                    </div>
                    
                    <SearchInput
                        searchType="Vector"
                        searchQuery={input.vector}
                        setSearchQuery={(vector) =>
                            updateVectorInput(input.id, vector)
                        }
                        metadata={metadata}
                        dim={dim}
                        onImageSelect={handleImageSelect(input.id)}
                        onImageEmbeddingGenerated={handleEmbeddingGenerated(
                            input.id
                        )}
                    />
                </div>
            ))}
        </div>
    )
}
