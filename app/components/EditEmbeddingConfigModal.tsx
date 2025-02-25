import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { EmbeddingConfig, EmbeddingProvider, OpenAIModel } from '@/app/types/embedding';
import { Alert, AlertDescription } from "@/components/ui/alert"
import OllamaModelSelector from './OllamaModelSelector';

const DEFAULT_CONFIG: EmbeddingConfig = {
  provider: 'openai',
  openai: {
    apiKey: '',
    model: 'text-embedding-3-small',
    cacheTTL: 86400,
    batchSize: 100
  }
};

interface EditEmbeddingConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: EmbeddingConfig;
  onSave: (config: EmbeddingConfig) => void;
}

export default function EditEmbeddingConfigModal({ 
  isOpen, 
  onClose, 
  config = DEFAULT_CONFIG,
  onSave 
}: EditEmbeddingConfigModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<EmbeddingProvider>(config.provider);
  
  // OpenAI specific state
  const [openaiConfig, setOpenaiConfig] = useState({
    apiKey: config.openai?.apiKey ?? '',
    model: config.openai?.model ?? 'text-embedding-3-small' as OpenAIModel,
    cacheTTL: config.openai?.cacheTTL ?? 86400,
    batchSize: config.openai?.batchSize ?? 100
  });

  // Ollama specific state
  const [ollamaConfig, setOllamaConfig] = useState({
    apiUrl: config.ollama?.apiUrl ?? 'http://localhost:11434/api/embeddings',
    modelName: config.ollama?.modelName ?? 'llama2',
    promptTemplate: config.ollama?.promptTemplate ?? ''
  });

  // Update state when config changes
  useEffect(() => {
    if (config) {
      setProvider(config.provider);
      if (config.provider === 'openai' && config.openai) {
        setOpenaiConfig({
          apiKey: config.openai.apiKey ?? '',
          model: config.openai.model ?? 'text-embedding-3-small',
          cacheTTL: config.openai.cacheTTL ?? 86400,
          batchSize: config.openai.batchSize ?? 100
        });
      } else if (config.provider === 'ollama' && config.ollama) {
        setOllamaConfig({
          apiUrl: config.ollama.apiUrl ?? 'http://localhost:11434/api/embeddings',
          modelName: config.ollama.modelName ?? 'llama2',
          promptTemplate: config.ollama.promptTemplate ?? ''
        });
      }
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let newConfig: EmbeddingConfig;

    if (provider === 'openai') {
      if (!openaiConfig.apiKey) {
        setError('Please enter an OpenAI API key');
        return;
      }
      newConfig = {
        provider: 'openai',
        openai: openaiConfig
      };
    } else if (provider === 'ollama') {
      if (!ollamaConfig.apiUrl) {
        setError('Please enter an Ollama API URL');
        return;
      }
      newConfig = {
        provider: 'ollama',
        ollama: ollamaConfig
      };
    } else {
      // Handle 'none' provider case
      newConfig = {
        provider: 'none'
      };
    }

    onSave(newConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Edit Embedding Configuration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={provider}
              onValueChange={(value: EmbeddingProvider) => setProvider(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === 'openai' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">OpenAI API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={openaiConfig.apiKey}
                  onChange={(e) => setOpenaiConfig({ ...openaiConfig, apiKey: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model</Label>
                <Select
                  value={openaiConfig.model}
                  onValueChange={(value: OpenAIModel) => setOpenaiConfig({ ...openaiConfig, model: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text-embedding-3-small">text-embedding-3-small</SelectItem>
                    <SelectItem value="text-embedding-3-large">text-embedding-3-large</SelectItem>
                    <SelectItem value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cacheTTL">Cache TTL (seconds)</Label>
                <Input
                  id="cacheTTL"
                  type="number"
                  value={openaiConfig.cacheTTL}
                  onChange={(e) => setOpenaiConfig({ ...openaiConfig, cacheTTL: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  value={openaiConfig.batchSize}
                  onChange={(e) => setOpenaiConfig({ ...openaiConfig, batchSize: parseInt(e.target.value) })}
                />
              </div>
            </>
          ) : provider === 'ollama' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiUrl">Ollama API URL</Label>
                <Input
                  id="apiUrl"
                  type="text"
                  value={ollamaConfig.apiUrl}
                  onChange={(e) => setOllamaConfig({ ...ollamaConfig, apiUrl: e.target.value })}
                  placeholder="http://localhost:11434/api/embeddings"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelName">Model</Label>
                <OllamaModelSelector
                  value={ollamaConfig.modelName}
                  onChange={(value) => setOllamaConfig({ ...ollamaConfig, modelName: value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promptTemplate">Prompt Template (optional)</Label>
                <Input
                  id="promptTemplate"
                  type="text"
                  value={ollamaConfig.promptTemplate}
                  onChange={(e) => setOllamaConfig({ ...ollamaConfig, promptTemplate: e.target.value })}
                  placeholder="Use {text} as placeholder for input text"
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500 mt-4 p-4 bg-gray-50 rounded-md">
              No additional configuration needed. This provider will not generate embeddings.
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 