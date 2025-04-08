import { IMAGE_MODELS, ImageModelName } from "@/app/embeddings/types/embeddingModels"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState } from "react"

interface ImageModelSelectorProps {
    value: ImageModelName
    onChange: (value: ImageModelName) => void
}

interface ModelInfo {
    id: ImageModelName
    name: string
    description: string
    dimensions: number
}

// Create model info from IMAGE_MODELS only
const imageModels: ModelInfo[] = [
    {
        id: "mobilenet",
        name: "MobileNet V2",
        description:
            "Lightweight model optimized for mobile and web applications. Good balance of speed and accuracy.",
        dimensions: IMAGE_MODELS["mobilenet"].dimensions,
    }
]

export default function ImageModelSelector({
    value,
    onChange,
}: ImageModelSelectorProps) {
    const [selectedModel, setSelectedModel] = useState<ImageModelName>(
        value || imageModels[0].id
    )

    const handleChange = (newValue: string) => {
        const modelValue = newValue as ImageModelName
        setSelectedModel(modelValue)
        onChange(modelValue)
    }

    return (
        <div className="space-y-4">
            <RadioGroup value={selectedModel} onValueChange={handleChange}>
                {imageModels.map((model) => (
                    <div
                        key={model.id}
                        className="flex items-start space-x-3 p-2"
                    >
                        <RadioGroupItem value={model.id} id={model.id} />
                        <div className="grid gap-1.5 leading-none">
                            <Label htmlFor={model.id} className="font-medium">
                                {model.name}
                            </Label>
                            <p className="text-sm text-gray-500">
                                {model.description}
                            </p>
                        </div>
                    </div>
                ))}
            </RadioGroup>
            <p className="text-xs text-gray-500">
                Selected model outputs{" "}
                {selectedModel
                    ? imageModels.find((m) => m.id === selectedModel)
                          ?.dimensions
                    : 1024}
                -dimensional embeddings
            </p>
            <p className="text-xs text-gray-500">
                Note: MobileNet is optimized for image similarity tasks.
            </p>
        </div>
    )
}
