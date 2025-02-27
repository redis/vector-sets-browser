import * as tf from '@tensorflow/tfjs';
import * as mobilenetModule from '@tensorflow-models/mobilenet';
import { ImageConfig } from '@/app/types/embedding';

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {};
let isModelLoading = false;

// Check if code is running in browser environment
const isBrowser = typeof window !== 'undefined';

// Import node-specific packages conditionally
let Canvas: any;
let Image: any;

// Don't try to load tfjs-node directly, as it causes webpack issues
// We'll use dynamic imports instead when needed

if (!isBrowser) {
  try {
    // Dynamic import for node-canvas in server environment
    const canvas = require('canvas');
    Canvas = canvas.Canvas;
    Image = canvas.Image;
  } catch (error) {
    console.error('[TensorFlow.js] Failed to load canvas package:', error);
  }
}

/**
 * Load a TensorFlow.js image model
 */
export async function loadImageModel(config: ImageConfig): Promise<any> {
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
    console.log(`[TensorFlow.js] Loading image model: ${modelName}`);
    
    // Initialize TensorFlow.js
    await tf.ready();
    
    // Set the appropriate backend based on environment
    if (isBrowser) {
      // For browser, prefer WebGL if available
      if (tf.getBackend() !== 'webgl' && tf.ENV.getBool('HAS_WEBGL')) {
        console.log('[TensorFlow.js] Setting backend to WebGL for client-side processing');
        await tf.setBackend('webgl');
      }
    } else {
      // Server-side processing is not supported
      throw new Error(
        'Image processing in server components is not supported. ' +
        'Please use client components for image processing.'
      );
    }
    
    console.log(`[TensorFlow.js] Using backend: ${tf.getBackend()}`);
    
    // For now, we only support MobileNet
    // Use version 1 with alpha 1.0 for best compatibility
    const model = await mobilenetModule.load({
      version: 1,
      alpha: 1.0
    });
    
    // Cache the model
    modelCache[modelName] = model;
    
    console.log(`[TensorFlow.js] Image model loaded: ${modelName}`);
    return model;
  } catch (error) {
    console.error(`[TensorFlow.js] Error loading image model: ${modelName}`, error);
    throw error;
  } finally {
    isModelLoading = false;
  }
}

/**
 * Preprocess an image for the model
 */
export async function preprocessImage(imageData: string, config: ImageConfig): Promise<tf.Tensor3D> {
  try {
    // MobileNet expects 224x224 images
    const inputSize = 224;
    
    if (!isBrowser) {
      // Server-side processing is not supported
      throw new Error(
        'Image processing in server components is not supported. ' +
        'Please use client components for image processing.'
      );
    }
    
    // Remove data URL prefix if present for processing
    const base64Data = imageData.startsWith('data:image') 
      ? imageData 
      : `data:image/jpeg;base64,${imageData}`;
    
    // Client-side processing using browser APIs
    // Create an HTMLImageElement from the base64 data
    const image = new Image();
    const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
    });
    
    // Set crossOrigin to anonymous to avoid CORS issues with data URLs
    image.crossOrigin = 'anonymous';
    image.src = base64Data;
    await imagePromise;
    
    console.log('[TensorFlow.js] Image loaded successfully:', image.width, 'x', image.height);
    
    // Create a tensor from the image
    const tensor = tf.browser.fromPixels(image);
    console.log('[TensorFlow.js] Image tensor created with shape:', tensor.shape);
    
    // Resize to the expected input size
    const resized = tf.image.resizeBilinear(tensor, [inputSize, inputSize]);
    console.log('[TensorFlow.js] Image resized to:', resized.shape);
    
    // Convert to float and normalize to [-1, 1]
    const normalized = resized.toFloat().div(tf.scalar(127.5)).sub(tf.scalar(1));
    console.log('[TensorFlow.js] Image normalized with shape:', normalized.shape);
    
    // Clean up intermediate tensors
    tensor.dispose();
    resized.dispose();
    
    return normalized;
  } catch (error) {
    console.error('[TensorFlow.js] Error preprocessing image:', error);
    throw error;
  }
}

/**
 * Get embedding for an image using TensorFlow.js
 */
export async function getImageEmbedding(imageData: string, config: ImageConfig): Promise<number[]> {
  try {
    console.log('[TensorFlow.js] Starting image embedding generation');
    
    // Load the model
    const model = await loadImageModel(config);
    
    // Preprocess the image
    const tensor = await preprocessImage(imageData, config);
    
    console.log('[TensorFlow.js] Generating embedding with model:', config.model);
    
    // Get the internal model to access the penultimate layer
    // @ts-ignore - accessing internal property
    const internalModel = model.model;
    
    // Execute the model up to the penultimate layer
    // This gives us the feature vector (embedding) before classification
    const activationLayer = internalModel.execute(
      tensor, 
      ['global_average_pooling2d_1'] // This is the name of the penultimate layer in MobileNet v1
    );
    
    // Debug the tensor shape and values
    console.log('[TensorFlow.js] Embedding tensor shape:', activationLayer.shape);
    
    // Convert to array
    const embedding = Array.from(await activationLayer.data());
    
    // Debug the embedding
    console.log('[TensorFlow.js] Embedding sample (first 10 values):', embedding.slice(0, 10));
    console.log('[TensorFlow.js] Embedding length:', embedding.length);
    console.log('[TensorFlow.js] Embedding has zeros:', embedding.filter(v => v === 0).length);
    
    // Clean up the tensors
    tensor.dispose();
    activationLayer.dispose();
    
    return embedding;
  } catch (error) {
    console.error('[TensorFlow.js] Error generating image embedding:', error);
    throw error;
  }
} 