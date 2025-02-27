import { VectorSetMetadata } from "../types/embedding"
import { Button } from "@/components/ui/button"

interface InfoPanelProps {
    vectorSetName: string
    recordCount: number | null
    dim: number | null
    metadata: VectorSetMetadata | null
    onEditConfig: () => void
}

export default function InfoPanel({ vectorSetName, recordCount, dim, metadata, onEditConfig }: InfoPanelProps) {
    const getModelName = () => {
        if (!metadata?.embedding) return null;
        if (metadata.embedding.provider === 'openai' && metadata.embedding.openai) {
            return metadata.embedding.openai.model;
        }
        if (metadata.embedding.provider === 'ollama' && metadata.embedding.ollama) {
            return metadata.embedding.ollama.modelName;
        }
        return null;
    };

    return (
        <div className="p-4 bg-white rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Vector Set Info</h2>
                <Button variant="outline" size="sm" onClick={onEditConfig}>
                    Edit Config
                </Button>
            </div>
            <div className="space-y-4">
                <div>
                    <h3 className="font-medium mb-2">Basic Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-600">Name:</div>
                        <div>{vectorSetName}</div>
                        <div className="text-gray-600">Vectors:</div>
                        <div>{recordCount !== null ? recordCount.toLocaleString() : 'Loading...'}</div>
                        <div className="text-gray-600">Dimensions:</div>
                        <div>{dim !== null ? dim.toLocaleString() : 'Loading...'}</div>
                        <div className="text-gray-600">Created:</div>
                        <div>{metadata?.created ? new Date(metadata.created).toLocaleString() : 'Unknown'}</div>
                    </div>
                </div>

                <div>
                    <h3 className="font-medium mb-2">Embedding Configuration</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-600">Provider:</div>
                        <div>{metadata?.embedding?.provider || 'None'}</div>
                        {metadata?.embedding?.provider === 'openai' && metadata?.embedding?.openai && (
                            <>
                                <div className="text-gray-600">Model:</div>
                                <div>{metadata.embedding.openai.model}</div>
                            </>
                        )}
                        {metadata?.embedding?.provider === 'ollama' && metadata?.embedding?.ollama && (
                            <>
                                <div className="text-gray-600">Model:</div>
                                <div>{metadata.embedding.ollama.modelName}</div>
                            </>
                        )}
                    </div>
                </div>

                {metadata?.redisConfig && (
                    <div>
                        <h3 className="font-medium mb-2">Redis Configuration</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-gray-600">Quantization:</div>
                            <div>{metadata.redisConfig.quantization}</div>
                            
                            {metadata.redisConfig.reduceDimensions && (
                                <>
                                    <div className="text-gray-600">Reduced Dimensions:</div>
                                    <div>{metadata.redisConfig.reduceDimensions}</div>
                                </>
                            )}
                            
                            <div className="text-gray-600">Default CAS:</div>
                            <div>{metadata.redisConfig.defaultCAS ? 'Enabled' : 'Disabled'}</div>
                            
                            {metadata.redisConfig.buildExplorationFactor && (
                                <>
                                    <div className="text-gray-600">Build EF:</div>
                                    <div>{metadata.redisConfig.buildExplorationFactor}</div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
} 