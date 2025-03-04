'use client';

import { useState, useEffect } from 'react';
import { ImageConfig } from '@/app/types/embedding';
import ClientImageEmbedding from './ClientImageEmbedding';

interface ImageEmbeddingWrapperProps {
  imageData: string;
  config: ImageConfig;
  onEmbeddingGenerated: (embedding: number[]) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: string) => void;
}

export default function ImageEmbeddingWrapper({
  imageData,
  config,
  onEmbeddingGenerated,
  onError = () => {},
  onStatusChange = () => {}
}: ImageEmbeddingWrapperProps) {
  const [useClientSide, setUseClientSide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Try server-side embedding first
  useEffect(() => {
    if (!imageData || useClientSide) return;
    
    const getServerEmbedding = async () => {
      try {
        onStatusChange('Getting embedding from server...');
        
        const response = await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: imageData,
            config: config,
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to get image embedding');
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to get image embedding');
        }
        
        onStatusChange('Embedding received from server');
        onEmbeddingGenerated(data.embedding);
      } catch (error) {
        console.error('[Embedding] Server-side embedding failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(errorMessage);
        
        // Check if this is a server-side limitation error
        if (errorMessage.includes('server-side') || 
            errorMessage.includes('canvas') || 
            errorMessage.includes('Image is not defined') ||
            errorMessage.includes('webpack')) {
          console.log('[Embedding] Falling back to client-side embedding');
          setUseClientSide(true);
        } else {
          onError(errorMessage);
        }
      }
    };
    
    getServerEmbedding();
  }, [imageData, config, onEmbeddingGenerated, onError, onStatusChange, useClientSide]);
  
  if (useClientSide) {
    return (
      <ClientImageEmbedding
        imageData={imageData}
        config={config}
        onEmbeddingGenerated={onEmbeddingGenerated}
        onError={onError}
        onStatusChange={onStatusChange}
      />
    );
  }
  
  return null; // Non-visual component
} 