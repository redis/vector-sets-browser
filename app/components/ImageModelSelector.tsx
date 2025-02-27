import { useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ImageModel } from "@/app/types/embedding"

interface ImageModelSelectorProps {
    value: string
    onChange: (value: string) => void
}

interface ModelInfo {
    id: ImageModel
    name: string
    description: string
    dimensions: number
}

// For now, we only support MobileNet due to dependency conflicts
const imageModels: ModelInfo[] = [
    {
        id: "mobilenet",
        name: "MobileNet V2",
        description:
            "Lightweight model optimized for mobile and web applications. Good balance of speed and accuracy.",
        dimensions: 1024,
    },
    // Other models removed due to dependency conflicts
    // {
    //   id: "efficientnet",
    //   name: "EfficientNet B0",
    //   description: "Optimized CNN architecture with better accuracy and efficiency than many larger models.",
    //   dimensions: 1280
    // },
    // {
    //   id: "resnet50",
    //   name: "ResNet50",
    //   description: "Deep residual network with 50 layers. Higher accuracy but more computationally intensive.",
    //   dimensions: 2048
    // }
]

export default function ImageModelSelector({
    value,
    onChange,
}: ImageModelSelectorProps) {
    const [selectedModel, setSelectedModel] = useState<string>(
        value || imageModels[0].id
    )

    const handleChange = (newValue: string) => {
        setSelectedModel(newValue)
        onChange(newValue)
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
                Note: Currently only MobileNet is supported due to dependency
                constraints.
            </p>
        </div>
    )
}
