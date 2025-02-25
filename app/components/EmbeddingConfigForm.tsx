import { useState, useEffect } from 'react';
import { EmbeddingConfig, EmbeddingProvider, OpenAIModel } from '@/app/types/embedding';

interface EmbeddingConfigFormProps {
  config: EmbeddingConfig;
  onChange: (config: EmbeddingConfig) => void;
}

export default function EmbeddingConfigForm({ config, onChange }: EmbeddingConfigFormProps) {
  const [provider, setProvider] = useState<EmbeddingProvider>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [modelName, setModelName] = useState(config.modelName || '');
  const [apiUrl, setApiUrl] = useState(config.apiUrl || '');
  const [promptTemplate, setPromptTemplate] = useState(config.promptTemplate || '');

  useEffect(() => {
    const newConfig: EmbeddingConfig = {
      provider,
      modelName,
      ...(provider === 'openai' && { apiKey }),
      ...(provider === 'ollama' && { 
        apiUrl: apiUrl || 'http://localhost:11434/api/embeddings',
        promptTemplate: promptTemplate || '{text}',
        modelName: modelName || 'mxbai-embed-large'
      })
    };
    onChange(newConfig);
  }, [provider, apiKey, modelName, apiUrl, promptTemplate, onChange]);

  // Set default values when provider changes to Ollama
  useEffect(() => {
    if (provider === 'ollama') {
      if (!apiUrl) setApiUrl('http://localhost:11434/api/embeddings');
      if (!promptTemplate) setPromptTemplate('{text}');
      if (!modelName) setModelName('mxbai-embed-large');
    }
  }, [provider]);

  return (
      <div className="space-y-4">
          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Provider
              </label>
              <select
                  value={provider}
                  onChange={(e) =>
                      setProvider(e.target.value as EmbeddingProvider)
                  }
                  className="w-full p-2 border rounded"
              >
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama</option>
                  <option value="none">None</option>
              </select>
          </div>

          {provider === "openai" && (
              <>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          API Key
                      </label>
                      <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="sk-..."
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Model
                      </label>
                      <select
                          value={modelName}
                          onChange={(e) =>
                              setModelName(e.target.value as OpenAIModel)
                          }
                          className="w-full p-2 border rounded"
                      >
                          <option value="">Select a model</option>
                          <option value="text-embedding-3-small">
                              text-embedding-3-small
                          </option>
                          <option value="text-embedding-3-large">
                              text-embedding-3-large
                          </option>
                          <option value="text-embedding-ada-002">
                              text-embedding-ada-002
                          </option>
                      </select>
                  </div>
              </>
          )}

          {provider === "ollama" && (
              <>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Ollama API URL (default:
                          http://localhost:11434/api/embeddings)
                      </label>
                      <input
                          type="text"
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="http://localhost:11434/api/embeddings"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Model Name
                      </label>
                      <input
                          type="text"
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="mxbai-embed-large"
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                          Prompt Template
                      </label>
                      <input
                          type="text"
                          value={promptTemplate}
                          onChange={(e) => setPromptTemplate(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="{text}"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                          Use {"{text}"} as a placeholder for the input text
                      </p>
                  </div>
              </>
          )}
      </div>
  )
} 