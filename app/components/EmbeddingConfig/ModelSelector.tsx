import { 
    ModelData, 
    EmbeddingProvider,
    getModelsByProvider
} from "@/app/embeddings/types/embeddingModels"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import * as React from "react"

interface ModelSelectorProps {
    provider: EmbeddingProvider
    value: string
    onChange: (value: string) => void
    allowCustom?: boolean
}

export default function ModelSelector({
    provider,
    value,
    onChange,
    allowCustom = false
}: ModelSelectorProps) {
    const [customModel, setCustomModel] = React.useState("")
    const models = getModelsByProvider(provider)
    const isCustom = allowCustom && !models.some((model) => model.id === value)

    React.useEffect(() => {
        if (isCustom) {
            setCustomModel(value)
        }
    }, [isCustom, value])

    // Different providers use different UI components
    if (provider === "image") {
        return <ImageModelDisplay models={models} value={value} onChange={onChange} />
    }

    // For providers with many options, use a select
    return (
        <div className="space-y-4">
            <Select
                value={isCustom ? "custom" : value}
                onValueChange={(val) => {
                    if (val === "custom") {
                        onChange(customModel || "")
                    } else {
                        onChange(val)
                    }
                }}
            >
                <SelectTrigger className="w-full text-left h-12">
                    <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                    {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col">
                                <div className="font-medium">
                                    {model.name}
                                    {model.size && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            ({model.size})
                                        </span>
                                    )}
                                    {model.isLegacy && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            (Legacy)
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {model.description}
                                    {model.dimensions && (
                                        <span className="ml-1">
                                            ({model.dimensions} dimensions)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </SelectItem>
                    ))}
                    {allowCustom && (
                        <SelectItem value="custom">
                            <div className="flex flex-col py-2">
                                <div className="font-medium">Custom Model</div>
                                <p className="text-xs text-muted-foreground">
                                    Use a custom model not in the list
                                </p>
                            </div>
                        </SelectItem>
                    )}
                </SelectContent>
            </Select>

            {isCustom && (
                <div className="space-y-2">
                    <Input
                        value={customModel}
                        onChange={(e) => {
                            setCustomModel(e.target.value)
                            onChange(e.target.value)
                        }}
                        placeholder="Enter custom model name"
                    />
                    <p className="text-xs text-muted-foreground">
                        Enter the name of any other model you have installed locally
                    </p>
                </div>
            )}
        </div>
    )
}

// Special display for image models using radio buttons
function ImageModelDisplay({ models, value, onChange }: { 
    models: ModelData[], 
    value: string, 
    onChange: (value: string) => void 
}) {
    const handleChange = (newValue: string) => {
        onChange(newValue)
    }

    const selectedModel = models.find(m => m.id === value) || models[0]

    return (
        <div className="space-y-4">
            <RadioGroup value={value} onValueChange={handleChange}>
                {models.map((model) => (
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
                {selectedModel?.dimensions || 1024}-dimensional embeddings
            </p>
        </div>
    )
} 