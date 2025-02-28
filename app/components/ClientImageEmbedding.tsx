'use client';

import { useState, useEffect } from 'react';
// Remove static imports
// import * as tf from '@tensorflow/tfjs';
// import * as mobilenetModule from '@tensorflow-models/mobilenet';
import { ImageConfig } from '@/app/types/embedding';

// Module references for lazy loading
let tf: any = null;
let mobilenetModule: any = null;
let tfInitialized = false;

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {};
let isModelLoading = false;

interface ClientImageEmbeddingProps {
  imageData: string;
  config: ImageConfig;
  onEmbeddingGenerated: (embedding: number[]) => void;
  onError: (error: string) => void;
  onStatusChange: (status: string) => void;
}

export default function ClientImageEmbedding({
  imageData,
  config,
  onEmbeddingGenerated,
  onError,
  onStatusChange
}: ClientImageEmbeddingProps) {
  const [setIsProcessing] = useState(false);

  useEffect(() => {
    if (!imageData) return;
    
    const generateEmbedding = async () => {
      try {
        setIsProcessing(true);
        onStatusChange('Loading model...');
        
        // Load the model
        const model = await loadImageModel(config);
        
        onStatusChange('Processing image...');
        // Preprocess the image
        const tensor = await preprocessImage(imageData);
        
        onStatusChange('Generating embedding...');
        
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
        
        // Clean up the tensors
        tensor.dispose();
        activationLayer.dispose();
        
        onStatusChange('Embedding generated successfully');
        onEmbeddingGenerated(embedding);
      } catch (error) {
        console.error('[Client] Error generating image embedding:', error);
        onError(error instanceof Error ? error.message : 'Unknown error generating embedding');
        onStatusChange('Error generating embedding');
      } finally {
        setIsProcessing(false);
      }
    };
    
    generateEmbedding();
  }, [imageData, config, onEmbeddingGenerated, onError, onStatusChange]);

  return null; // This is a non-visual component
}

/**
 * Load a TensorFlow.js image model
 */
async function loadImageModel(config: ImageConfig): Promise<any> {
  const modelName = config.model;
  
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
    console.log(`[Client] Loading image model: ${modelName}`);
    
    // Lazy load TensorFlow.js and MobileNet
    if (!tf) {
      console.log('[Client] Dynamically importing TensorFlow.js');
      tf = await import('@tensorflow/tfjs');
    }
    
    if (!mobilenetModule) {
      console.log('[Client] Dynamically importing MobileNet');
      mobilenetModule = await import('@tensorflow-models/mobilenet');
    }
    
    // Initialize TensorFlow.js
    if (!tfInitialized) {
      console.log('[Client] Initializing TensorFlow.js');
      await tf.ready();
      tfInitialized = true;
    }
    
    // Prefer WebGL if available
    if (tf.getBackend() !== 'webgl' && tf.ENV.getBool('HAS_WEBGL')) {
      console.log('[Client] Setting backend to WebGL');
      await tf.setBackend('webgl');
    }
    
    console.log(`[Client] Using backend: ${tf.getBackend()}`);
    
    // For now, we only support MobileNet
    // Use version 1 with alpha 1.0 for best compatibility
    const model = await mobilenetModule.load({
      version: 1,
      alpha: 1.0
    });
    
    // Cache the model
    modelCache[modelName] = model;
    
    console.log(`[Client] Image model loaded: ${modelName}`);
    return model;
  } catch (error) {
    console.error(`[Client] Error loading image model: ${modelName}`, error);
    throw error;
  } finally {
    isModelLoading = false;
  }
}

/**
 * Preprocess an image for the model
 */
async function preprocessImage(imageData: string): Promise<any> {
  try {
    // Ensure TensorFlow.js is loaded
    if (!tf) {
      console.log('[Client] Dynamically importing TensorFlow.js for preprocessing');
      tf = await import('@tensorflow/tfjs');
      
      if (!tfInitialized) {
        console.log('[Client] Initializing TensorFlow.js');
        await tf.ready();
        tfInitialized = true;
      }
    }
    
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
    
    console.log('[Client] Image loaded successfully:', image.width, 'x', image.height);
    
    // Create a tensor from the image
    const tensor = tf.browser.fromPixels(image);
    console.log('[Client] Image tensor created with shape:', tensor.shape);
    
    // Resize to the expected input size
    const resized = tf.image.resizeBilinear(tensor, [inputSize, inputSize]);
    console.log('[Client] Image resized to:', resized.shape);
    
    // Convert to float and normalize to [-1, 1]
    const normalized = resized.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
    console.log('[Client] Image normalized with shape:', normalized.shape);
    
    // Clean up intermediate tensors
    tensor.dispose();
    resized.dispose();
    
    return normalized;
  } catch (error) {
    console.error('[Client] Error preprocessing image:', error);
    throw error;
  }
} 