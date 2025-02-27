import { useState } from 'react';
import { Button } from "@/components/ui/button";
import ImageUploader from './ImageUploader';
import { VectorSetMetadata } from '@/app/types/embedding';

interface ImageSearchInputProps {
  onSearch: (imageData: string) => Promise<void>;
  isSearching: boolean;
  metadata: VectorSetMetadata | null;
}

export default function ImageSearchInput({ onSearch, isSearching, metadata }: ImageSearchInputProps) {
  const [imageData, setImageData] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Check if the current vector set supports image search
  const supportsImageSearch = metadata?.embedding?.provider === 'image';
  
  const handleSearch = async () => {
    setError(null);
    
    if (!imageData) {
      setError('Please select an image to search with');
      return;
    }
    
    try {
      await onSearch(imageData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    }
  };
  
  if (!supportsImageSearch) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800 mb-4">
        <p>Image search is only available for vector sets with an image embedding model.</p>
        <p className="text-sm mt-1">Current embedding provider: {metadata?.embedding?.provider || 'none'}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <h3 className="text-lg font-medium mb-2">Search by Image</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload an image to find similar images in this vector set
        </p>
        
        <ImageUploader 
          onImageSelect={setImageData}
          className="mb-4"
        />
        
        {error && (
          <div className="text-red-500 text-sm mb-2">
            {error}
          </div>
        )}
        
        <Button 
          onClick={handleSearch} 
          disabled={isSearching || !imageData}
          className="w-full"
        >
          {isSearching ? 'Searching...' : 'Search by Image'}
        </Button>
      </div>
    </div>
  );
}