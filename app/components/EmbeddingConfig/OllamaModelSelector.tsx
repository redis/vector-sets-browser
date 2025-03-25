import { OLLAMA_MODELS } from "@/app/embeddings/types/embeddingModels"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import * as React from "react"

interface OllamaModel {
    id: string
    name: string
    description: string
    size?: string
    pulls?: string
    tags?: string
    updated?: string
    dimensions?: number
}

const ollamaModels: OllamaModel[] = [
    {
        id: "nomic-embed-text",
        name: "nomic-embed-text",
        description:
            "A high-performing open embedding model with a large token context window.",
        size: "17M",
        pulls: "3",
        updated: "12 months ago",
        dimensions: OLLAMA_MODELS["nomic-embed-text"]?.dimensions,
    },
    {
        id: "mxbai-embed-large",
        name: "mxbai-embed-large",
        description:
            "State-of-the-art large embedding model from mixedbread.ai",
        size: "335m",
        pulls: "1.6M",
        updated: "9 months ago",
        dimensions: OLLAMA_MODELS["mxbai-embed-large"]?.dimensions,
    },
    {
        id: "snowflake-arctic-embed",
        name: "snowflake-arctic-embed",
        description:
            "A suite of text embedding models by Snowflake, optimized for performance.",
        size: "335m",
        pulls: "692.8K",
        updated: "10 months ago",
        dimensions: 1024,
    },
    {
        id: "bge-m3",
        name: "bge-m3",
        description:
            "BGE-M3 is a new model from BAAI distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity.",
        size: "567m",
        pulls: "450.8K",
        updated: "6 months ago",
        dimensions: 1024,
    },
    {
        id: "all-minilm",
        name: "all-minilm",
        description: "Embedding models on very large sentence level datasets.",
        size: "33m",
        pulls: "298K",
        updated: "9 months ago",
        dimensions: OLLAMA_MODELS["all-minilm"]?.dimensions,
    },
    {
        id: "bge-large",
        name: "bge-large",
        description: "Embedding model from BAAI mapping texts to vectors.",
        size: "335m",
        pulls: "82.9K",
        updated: "6 months ago",
        dimensions: 1024,
    },
    {
        id: "paraphrase-multilingual",
        name: "paraphrase-multilingual",
        description:
            "Sentence-transformers model that can be used for tasks like clustering or semantic search.",
        size: "278m",
        pulls: "39.8K",
        updated: "6 months ago",
        dimensions: 768,
    },
    {
        id: "snowflake-arctic-embed2",
        name: "snowflake-arctic-embed2",
        description:
            "Snowflake's frontier embedding model. Arctic Embed 2.0 adds multilingual support without sacrificing English performance or scalability.",
        size: "568m",
        pulls: "31.2K",
        updated: "2 months ago",
        dimensions: 1024,
    },
    {
        id: "granite-embedding",
        name: "granite-embedding",
        description:
            "The IBM Granite Embedding models are text-only dense biencoder embedding models, with 30M available in English only and 278M serving multilingual use cases.",
        size: "278M",
        pulls: "N/A",
        updated: "N/A",
        dimensions: 768,
    },
]

interface OllamaModelSelectorProps {
    value: string
    onChange: (value: string) => void
}

export default function OllamaModelSelector({
    value,
    onChange,
}: OllamaModelSelectorProps) {
    const [customModel, setCustomModel] = React.useState("")
    const isCustom = !ollamaModels.some((model) => model.id === value)

    React.useEffect(() => {
        if (isCustom) {
            setCustomModel(value)
        }
    }, [value])

    return (
        <div className="space-y-4">
            <Select
                value={isCustom ? "custom" : value}
                onValueChange={(val) => {
                    if (val === "custom") {
                        onChange(customModel)
                    } else {
                        onChange(val)
                    }
                }}
            >
                <SelectTrigger className="w-full text-left h-12">
                    <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                    {ollamaModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                            <div className="flex flex-col">
                                <div className="font-medium">
                                    {model.name}
                                    {model.size && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            ({model.size})
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
                    <SelectItem value="custom">
                        <div className="flex flex-col py-2">
                            <div className="font-medium">Custom Model</div>
                            <p className="text-xs text-muted-foreground">
                                Use a custom model installed locally
                            </p>
                        </div>
                    </SelectItem>
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
                        Enter the name of any other Ollama model you have
                        installed locally
                    </p>
                </div>
            )}
        </div>
    )
}
