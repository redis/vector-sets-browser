import { useState, useRef, ChangeEvent } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from 'next/image';
import * as tf from '@tensorflow/tfjs';
import * as mobilenetModule from '@tensorflow-models/mobilenet';
import { ImageConfig } from '@/app/types/embedding';

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {};
let isModelLoading = false;

interface ImageUploaderProps {
  onImageSelect: (base64Data: string) => void;
  onEmbeddingGenerated?: (embedding: number[]) => void;
  config?: ImageConfig;
  className?: string;
}

export default function ImageUploader({ 
  onImageSelect, 
  onEmbeddingGenerated,
  config = { model: 'mobilenet' },
  className = '' 
}: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingEmbedding, setIsProcessingEmbedding] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Create preview URL
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      
      // Convert to base64
      const base64Data = await fileToBase64(file);
      setImageData(base64Data);
      onImageSelect(base64Data);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (fileInputRef.current) {
        // Create a DataTransfer object to set the file input value
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
        
        // Trigger the change event manually
        const event = new Event('change', { bubbles: true });
        fileInputRef.current.dispatchEvent(event);
      }
    }
  };

  const generateEmbedding = async () => {
    if (!imageData || !onEmbeddingGenerated) return;
    
    try {
      setIsProcessingEmbedding(true);
      setStatus('Loading model...');
      
      // Load the model
      const model = await loadImageModel();
      
      setStatus('Processing image...');
      // Preprocess the image
      const tensor = await preprocessImage(imageData);
      
      setStatus('Generating embedding...');
      
      // Get the internal model to access the penultimate layer
      // @ts-ignore - accessing internal property
      const internalModel = model.model;
      
      // Execute the model up to the penultimate layer
      // This gives us the feature vector (embedding) before classification
      const activationLayer = internalModel.execute(
        tensor, 
        ['global_average_pooling2d_1'] // This is the name of the penultimate layer in MobileNet v1
      );
      
      // Convert to array and check values
      const embedding = Array.from(await activationLayer.data());
      console.log('Embedding sample (first 10 values):', embedding.slice(0, 10));
      console.log('Embedding length:', embedding.length);
      console.log('Embedding has zeros:', embedding.filter(v => v === 0).length);
      
      // Clean up the tensors
      tensor.dispose();
      activationLayer.dispose();
      
      setStatus('Embedding generated successfully');
      onEmbeddingGenerated(embedding);
    } catch (error) {
      console.error('Error generating embedding:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingEmbedding(false);
    }
  };

  /**
   * Load a TensorFlow.js image model
   */
  async function loadImageModel(): Promise<any> {
    const modelName = 'mobilenet';
    
    // Return cached model if available
    if (modelCache[modelName]) {
      return modelCache[modelName];
    }
    
    // Wait if model is already loading
    if (isModelLoading) {
      while (isModelLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (modelCache[modelName]) {
        return modelCache[modelName];
      }
    }
    
    try {
      isModelLoading = true;
      console.log(`Loading image model: ${modelName}`);
      
      // Initialize TensorFlow.js
      await tf.ready();
      
      // Prefer WebGL if available
      if (tf.getBackend() !== 'webgl' && tf.ENV.getBool('HAS_WEBGL')) {
        console.log('Setting backend to WebGL');
        await tf.setBackend('webgl');
      }
      
      console.log(`Using backend: ${tf.getBackend()}`);
      
      // For now, we only support MobileNet
      // Use version 1 with alpha 1.0 for best compatibility
      const model = await mobilenetModule.load({
        version: 1,
        alpha: 1.0
      });
      
      // Cache the model
      modelCache[modelName] = model;
      
      console.log(`Image model loaded: ${modelName}`);
      return model;
    } catch (error) {
      console.error(`Error loading image model: ${modelName}`, error);
      throw error;
    } finally {
      isModelLoading = false;
    }
  }

  /**
   * Preprocess an image for the model
   */
  async function preprocessImage(imageData: string): Promise<tf.Tensor3D> {
    try {
      // MobileNet expects 224x224 images
      const inputSize = 224;
      
      // Create an HTMLImageElement from the base64 data
      const image = new Image();
      const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = (err) => reject(err);
      });
      
      // Remove data URL prefix if present
      const base64Data = imageData.startsWith('data:image') 
        ? imageData 
        : `data:image/jpeg;base64,${imageData}`;
      
      // Set crossOrigin to anonymous to avoid CORS issues with data URLs
      image.crossOrigin = 'anonymous';  
      image.src = base64Data;
      await imagePromise;
      
      console.log('Image loaded successfully:', image.width, 'x', image.height);
      
      // Create a tensor from the image
      const tensor = tf.browser.fromPixels(image);
      console.log('Image tensor created with shape:', tensor.shape);
      
      // Resize to the expected input size
      const resized = tf.image.resizeBilinear(tensor, [inputSize, inputSize]);
      console.log('Image resized to:', resized.shape);
      
      // Convert to float and normalize to [-1, 1]
      const normalized = resized.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
      console.log('Image normalized with shape:', normalized.shape);
      
      // Clean up intermediate tensors
      tensor.dispose();
      resized.dispose();
      
      return normalized;
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  }

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      <div 
        className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={handleButtonClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {previewUrl ? (
          <div className="relative w-full h-full">
            <Image 
              src={previewUrl} 
              alt="Preview" 
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        ) : (
          <>
            <div className="text-gray-500 mb-2">
              {isLoading ? 'Processing...' : 'Drag and drop an image here, or click to select'}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </>
        )}
      </div>
      
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        <Button 
          type="button" 
          onClick={handleButtonClick}
          disabled={isLoading}
          className="flex-1"
        >
          {previewUrl ? 'Change Image' : 'Select Image'}
        </Button>
        
        {previewUrl && (
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setPreviewUrl(null);
              setImageData(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              onImageSelect('');
            }}
            className="flex-1"
          >
            Remove Image
          </Button>
        )}
        
        {previewUrl && onEmbeddingGenerated && (
          <Button 
            type="button" 
            variant="secondary"
            onClick={generateEmbedding}
            disabled={isProcessingEmbedding || !imageData}
            className="flex-1"
          >
            {isProcessingEmbedding ? 'Processing...' : 'Generate Embedding'}
          </Button>
        )}
      </div>
      
      {status && (
        <div className="text-sm text-gray-600 w-full">
          Status: {status}
        </div>
      )}
    </div>
  );
} 