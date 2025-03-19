import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { TensorFlowModelName, TENSORFLOW_MODELS } from "@/app/embeddings/types/config"

interface TensorFlowModelSelectorProps {
    value: string
    onChange: (value: string) => void
}

interface ModelInfo {
    id: TensorFlowModelName
    name: string
    description: string
    dimensions: number
}

// Create model info from TENSORFLOW_MODELS
const tensorflowModels: ModelInfo[] = [
    {
        id: "universal-sentence-encoder",
        name: "Universal Sentence Encoder",
        description:
            "Encodes text into 512-dimensional embeddings. Good for semantic similarity and text classification.",
        dimensions: TENSORFLOW_MODELS["universal-sentence-encoder"].dimensions,
    },
    {
        id: "universal-sentence-encoder-lite",
        name: "Universal Sentence Encoder Lite",
        description:
            "Lightweight version with the same dimensions but smaller model size for faster loading.",
        dimensions: TENSORFLOW_MODELS["universal-sentence-encoder-lite"].dimensions,
    },
    {
        id: "universal-sentence-encoder-multilingual",
        name: "Universal Sentence Encoder Multilingual",
        description:
            "Supports 16 languages while maintaining the same vector dimensions.",
        dimensions: TENSORFLOW_MODELS["universal-sentence-encoder-multilingual"].dimensions,
    },
]

export default function TensorFlowModelSelector({
    value,
    onChange,
}: TensorFlowModelSelectorProps) {
    const [selectedModel, setSelectedModel] = useState<string>(
        value || tensorflowModels[0].id
    )

    const handleChange = (newValue: string) => {
        setSelectedModel(newValue)
        onChange(newValue)
    }

    return (
        <div className="space-y-4">
            <RadioGroup
                value={selectedModel}
                onValueChange={handleChange}
                className="flex flex-col space-y-2 p-4"
            >
                {tensorflowModels.map((model) => (
                    <div key={model.id} className="flex items-start ">
                        <RadioGroupItem value={model.id} id={model.id} />
                        <Label
                            htmlFor={model.id}
                            className="font-medium flex flex-col space-y-1 pl-2"
                        >
                            <div>{model.name}</div>
                            <p className="text-sm text-gray-500">
                                {model.description}
                            </p>
                        </Label>
                    </div>
                ))}
            </RadioGroup>
            <p className="text-gray-500">
                All models output{" "}
                {selectedModel
                    ? tensorflowModels.find((m) => m.id === selectedModel)
                          ?.dimensions
                    : 512}
                -dimensional embeddings
            </p>
        </div>
    )
}
