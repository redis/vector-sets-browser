import * as React from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface OllamaModel {
  id: string
  name: string
  description: string
  size?: string
  pulls?: string
  tags?: string
  updated?: string
}

const ollamaModels: OllamaModel[] = [
  {
    id: "nomic-embed-text",
    name: "nomic-embed-text",
    description: "A high-performing open embedding model with a large token context window.",
    size: "17M",
    pulls: "3",
    updated: "12 months ago"
  },
  {
    id: "mxbai-embed-large",
    name: "mxbai-embed-large",
    description: "State-of-the-art large embedding model from mixedbread.ai",
    size: "335m",
    pulls: "1.6M",
    updated: "9 months ago"
  },
  {
    id: "snowflake-arctic-embed",
    name: "snowflake-arctic-embed",
    description: "A suite of text embedding models by Snowflake, optimized for performance.",
    size: "335m",
    pulls: "692.8K",
    updated: "10 months ago"
  },
  {
    id: "bge-m3",
    name: "bge-m3",
    description: "BGE-M3 is a new model from BAAI distinguished for its versatility in Multi-Functionality, Multi-Linguality, and Multi-Granularity.",
    size: "567m",
    pulls: "450.8K",
    updated: "6 months ago"
  },
  {
    id: "all-minilm",
    name: "all-minilm",
    description: "Embedding models on very large sentence level datasets.",
    size: "33m",
    pulls: "298K",
    updated: "9 months ago"
  },
  {
    id: "bge-large",
    name: "bge-large",
    description: "Embedding model from BAAI mapping texts to vectors.",
    size: "335m",
    pulls: "82.9K",
    updated: "6 months ago"
  },
  {
    id: "paraphrase-multilingual",
    name: "paraphrase-multilingual",
    description: "Sentence-transformers model that can be used for tasks like clustering or semantic search.",
    size: "278m",
    pulls: "39.8K",
    updated: "6 months ago"
  },
  {
    id: "snowflake-arctic-embed2",
    name: "snowflake-arctic-embed2",
    description: "Snowflake's frontier embedding model. Arctic Embed 2.0 adds multilingual support without sacrificing English performance or scalability.",
    size: "568m",
    pulls: "31.2K",
    updated: "2 months ago"
  },
  {
    id: "granite-embedding",
    name: "granite-embedding",
    description: "The IBM Granite Embedding models are text-only dense biencoder embedding models, with 30M available in English only and 278M serving multilingual use cases.",
    size: "278M",
    pulls: "N/A",
    updated: "N/A"
  }
]

interface OllamaModelSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function OllamaModelSelector({ value, onChange }: OllamaModelSelectorProps) {
  const [customModel, setCustomModel] = React.useState("")
  const isCustom = !ollamaModels.some(model => model.id === value)

  // Update custom model input when an existing value doesn't match any predefined models
  React.useEffect(() => {
    if (isCustom) {
      setCustomModel(value)
    }
  }, [value])

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px] rounded-md border p-4">
        <RadioGroup 
          value={isCustom ? "custom" : value} 
          onValueChange={(val) => {
            if (val === "custom") {
              onChange(customModel)
            } else {
              onChange(val)
            }
          }}
          className="gap-6"
        >
          {ollamaModels.map((model) => (
            <div key={model.id} className="flex items-start space-x-4">
              <RadioGroupItem value={model.id} id={model.id} className="mt-1" />
              <div className="grid gap-1.5">
                <Label htmlFor={model.id} className="font-medium">
                  {model.name}
                  {model.size && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({model.size})
                    </span>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">{model.description}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {model.pulls && <span>👥 {model.pulls} pulls</span>}
                  {model.updated && <span>🕒 Updated {model.updated}</span>}
                </div>
              </div>
            </div>
          ))}
          
          <div className="flex items-start space-x-4">
            <RadioGroupItem value="custom" id="custom" className="mt-1" />
            <div className="grid gap-1.5 flex-1">
              <Label htmlFor="custom" className="font-medium">
                Custom Model
              </Label>
              <Input
                value={customModel}
                onChange={(e) => {
                  setCustomModel(e.target.value)
                  if (isCustom) {
                    onChange(e.target.value)
                  }
                }}
                placeholder="Enter custom model name"
                className="max-w-sm"
              />
              <p className="text-sm text-muted-foreground">
                Enter the name of any other Ollama model you have installed locally
              </p>
            </div>
          </div>
        </RadioGroup>
      </ScrollArea>
    </div>
  )
} 