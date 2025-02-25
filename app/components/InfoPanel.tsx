import { VectorSetMetadata } from "../types/embedding"

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
        <section className="mb-4">
            <div className="bg-white p-4 rounded shadow-md">
                <div className="grid grid-cols-3 gap-8 grow items-center">

                    <div className="flex flex-col">
                        <div className="uppercase text-sm">Record Count</div>
                        <div className="font-bold">{recordCount}</div>
                    </div>
                    <div className="flex flex-col">
                        <div className="uppercase text-sm">Dimensions</div>
                        <div className="font-bold">{dim}</div>
                    </div>
                </div>

                <div className="flex flex-col mt-4">
                    <div className="uppercase text-sm mb-2">Embedding Engine</div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                        {metadata?.embedding ? (
                            <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-semibold capitalize">
                                            {metadata.embedding.provider}
                                        </div>
                                        <div className="text-sm text-gray-600">
                                            {metadata.embedding.provider === 'none' ? (
                                                'No embedding provider configured'
                                            ) : (
                                                <>Model: {getModelName()}</>
                                            )}
                                        </div>
                                        {metadata.embedding.provider === "openai" && metadata.embedding.openai && (
                                            <>
                                                <div className="text-sm text-gray-600">
                                                    Cache TTL: {metadata.embedding.openai.cacheTTL}s
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Batch Size: {metadata.embedding.openai.batchSize}
                                                </div>
                                            </>
                                        )}
                                        {metadata.embedding.provider === "ollama" && metadata.embedding.ollama && (
                                            <>
                                                <div className="text-sm text-gray-600">
                                                    URL: {metadata.embedding.ollama.apiUrl}
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Template: {metadata.embedding.ollama.promptTemplate || '{text}'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <button
                                        onClick={onEditConfig}
                                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                    >
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                            />
                                        </svg>
                                        Edit
                                    </button>
                                </div>
                                <div className="text-xs text-gray-500">
                                    Last updated: {new Date(metadata.lastUpdated || metadata.created).toLocaleString()}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="text-gray-500 mb-3">
                                    No embedding configuration set
                                </div>
                                <button
                                    onClick={onEditConfig}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                        />
                                    </svg>
                                    Set Embedding Engine
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
} 