import { ImageConfig, EmbeddingConfig, CLIP_MODELS } from "@/app/embeddings/types/embeddingModels"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { ChangeEvent, useEffect, useRef, useState } from "react"
import { X } from "lucide-react"

// Module references for lazy loading
let tf: any = null
let mobilenetModule: any = null
let tfInitialized = false

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {}
let isModelLoading = false

// Define a type for image file info
export interface ImageFileInfo {
    id: string;
    fileName: string;
    previewUrl: string;
    base64Data: string;
    embedding?: number[];
}

interface ImageUploaderProps {
    onImageSelect: (base64Data: string) => void
    onEmbeddingGenerated?: (embedding: number[]) => void
    onFileNameSelect?: (fileName: string) => void
    onImagesChange?: (images: ImageFileInfo[]) => void
    config?: EmbeddingConfig
    className?: string
    allowMultiple?: boolean
}

export default function ImageUploader({
    onImageSelect,
    onEmbeddingGenerated,
    onFileNameSelect,
    onImagesChange,
    config = { 
        provider: "clip", 
        clip: { 
            model: "clip-vit-base-patch32" 
        } 
    },
    className = "",
    allowMultiple = false,
}: ImageUploaderProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isProcessingEmbedding, setIsProcessingEmbedding] = useState(false)
    const [imageData, setImageData] = useState<string | null>(null)
    const [status, setStatus] = useState("")
    const fileInputRef = useRef<HTMLInputElement>(null)
    // Add state to track multiple images
    const [imageFiles, setImageFiles] = useState<ImageFileInfo[]>([])

    // Notify parent when images change
    useEffect(() => {
        if (onImagesChange && allowMultiple) {
            onImagesChange(imageFiles);
        }
    }, [imageFiles, onImagesChange, allowMultiple]);

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        if (allowMultiple) {
            // Process files in sequence
            processMultipleFiles(Array.from(files));
        } else {
            // Process only the first file
            processFile(files[0]);
        }
    }

    const processMultipleFiles = async (files: File[]) => {
        // Filter out non-image files
        const imageFiles = files.filter(file => file.type.startsWith("image/"));
        
        if (imageFiles.length === 0) {
            setStatus("No valid image files found");
            return;
        }
        
        setStatus(`Processing ${imageFiles.length} images...`);
        
        // Process each file and add it to our collection
        const newImages: ImageFileInfo[] = [];
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            setStatus(`Processing image ${i + 1} of ${imageFiles.length}: ${file.name}`);
            
            try {
                // Convert to base64
                const base64Data = await fileToBase64(file);
                
                // Create preview URL
                const objectUrl = URL.createObjectURL(file);
                
                // Add to our collection
                const imageInfo: ImageFileInfo = {
                    id: `img_${Date.now()}_${i}`,
                    fileName: file.name,
                    previewUrl: objectUrl,
                    base64Data: base64Data
                };
                
                newImages.push(imageInfo);
                
                // Generate embedding if needed
                if (onEmbeddingGenerated) {
                    setStatus(`Generating embedding for ${file.name}...`);
                    setIsProcessingEmbedding(true);
                    
                    try {
                        const embedding = await generateEmbeddingAndReturn(base64Data);
                        // Update the image info with embedding
                        imageInfo.embedding = embedding;
                    } catch (error) {
                        console.error("Error generating embedding:", error);
                    } finally {
                        setIsProcessingEmbedding(false);
                    }
                }
            } catch (error) {
                console.error(`Error processing image ${file.name}:`, error);
            }
        }
        
        // Update our imageFiles state
        setImageFiles(prev => [...prev, ...newImages]);
        
        // For single-image compatibility, update the main preview with the last image
        if (newImages.length > 0) {
            const lastImage = newImages[newImages.length - 1];
            setPreviewUrl(lastImage.previewUrl);
            setImageData(lastImage.base64Data);
            
            // Call the legacy callbacks for compatibility
            onImageSelect(lastImage.base64Data);
            if (onFileNameSelect) {
                onFileNameSelect(lastImage.fileName);
            }
            if (onEmbeddingGenerated && lastImage.embedding) {
                onEmbeddingGenerated(lastImage.embedding);
            }
        }
        
        setStatus(`Processed ${newImages.length} images successfully`);
    }

    const processFile = async (file: File) => {
        // Skip non-image files
        if (!file.type.startsWith("image/")) {
            setStatus(`Skipping non-image file: ${file.name}`);
            return;
        }
        
        try {
            setIsLoading(true);
            setStatus(`Processing: ${file.name}`);
            
            // Create preview URL
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            
            // Convert to base64
            const base64Data = await fileToBase64(file);
            setImageData(base64Data);
            onImageSelect(base64Data);
            
            // Create a single-image collection for consistency
            if (allowMultiple) {
                const imageInfo: ImageFileInfo = {
                    id: `img_${Date.now()}`,
                    fileName: file.name,
                    previewUrl: objectUrl,
                    base64Data: base64Data
                };
                setImageFiles([imageInfo]);
            }
            
            // Provide the file name if the callback exists
            if (onFileNameSelect) {
                onFileNameSelect(file.name);
            }
            
            // Generate embedding if handler is provided
            if (onEmbeddingGenerated) {
                setStatus(`Generating embedding for ${file.name}...`);
                setIsProcessingEmbedding(true);
                
                try {
                    const embedding = await generateEmbeddingAndReturn(base64Data);
                    
                    // Update the image info with embedding if in multiple mode
                    if (allowMultiple) {
                        setImageFiles(prev => 
                            prev.map(img => 
                                img.id === `img_${Date.now()}` 
                                    ? {...img, embedding} 
                                    : img
                            )
                        );
                    }
                } catch (error) {
                    console.error("Error generating embedding:", error);
                    setStatus(`Error with ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
                } finally {
                    setIsProcessingEmbedding(false);
                }
            }
        } catch (error) {
            console.error(`Error processing image ${file.name}:`, error);
            setStatus(`Error processing ${file.name}.`);
        } finally {
            setIsLoading(false);
        }
    }

    const processNextFile = async (files: File[], index: number) => {
        if (index >= files.length) return; // No more files to process
        
        const file = files[index];
        
        // Skip non-image files
        if (!file.type.startsWith("image/")) {
            setStatus(`Skipping non-image file: ${file.name}`);
            // Process next file after a short delay
            setTimeout(() => processNextFile(files, index + 1), 500);
            return;
        }
        
        try {
            setIsLoading(true);
            setStatus(`Processing ${index + 1} of ${files.length}: ${file.name}`);
            
            // Create preview URL (shows the most recent file)
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            
            // Convert to base64
            const base64Data = await fileToBase64(file);
            setImageData(base64Data);
            onImageSelect(base64Data);
            
            // Provide the file name if the callback exists
            if (onFileNameSelect) {
                onFileNameSelect(file.name);
            }
            
            // Generate embedding if handler is provided
            if (onEmbeddingGenerated) {
                setStatus(`Generating embedding for ${file.name}...`);
                setIsProcessingEmbedding(true);
                
                try {
                    await generateEmbeddingAndReturn(base64Data);
                } catch (error) {
                    console.error("Error generating embedding:", error);
                    setStatus(`Error with ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
                } finally {
                    setIsProcessingEmbedding(false);
                }
            }
            
            // Process next file after completion
            setTimeout(() => processNextFile(files, index + 1), 500);
        } catch (error) {
            console.error(`Error processing image ${file.name}:`, error);
            setStatus(`Error processing ${file.name}. Moving to next file...`);
            // Continue with next file even after error
            setTimeout(() => processNextFile(files, index + 1), 500);
        } finally {
            setIsLoading(false);
        }
    }

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.readAsDataURL(file)
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = (error) => reject(error)
        })
    }

    const handleButtonClick = () => {
        fileInputRef.current?.click()
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (allowMultiple) {
                // Process all dropped files at once
                processMultipleFiles(Array.from(e.dataTransfer.files));
            } else {
                // Process only the first file
                processFile(e.dataTransfer.files[0]);
            }
        }
    }

    // Modified function to both generate embedding and return it
    const generateEmbeddingAndReturn = async (dataToProcess?: string): Promise<number[]> => {
        const data = dataToProcess || imageData
        if (!data) throw new Error("No image data provided");

        let embedding: number[] = [] 

        try {
            setIsProcessingEmbedding(true)
            setStatus("Loading model...")

            // Check if we're using CLIP
            if (config.provider === "clip") {
                // Use the CLIPProvider
                const { CLIPProvider } = await import('@/app/embeddings/providers/clip')
                const clipProvider = new CLIPProvider()
                
                setStatus("Generating embedding using CLIP...")
                console.log("Generating embedding using CLIP...")

                const modelPath = config.clip?.model
                    ? CLIP_MODELS[config.clip.model].modelPath
                    : 'Xenova/clip-vit-base-patch32'

                embedding = await clipProvider.getImageEmbedding(data, modelPath)
                
    
            } else if (config.provider === "image") {

                // For MobileNet, continue with existing flow
                const model = await loadImageModel()

                setStatus("Processing image...")
                // Preprocess the image
                const tensor = await preprocessImage(data)

                setStatus("Generating embedding using TensorFlow MobileNet...")
                console.log("Generating embedding using TensorFlow MobileNet...")
                // Get the internal model to access the penultimate layer
                // @ts-ignore - accessing internal property
                const internalModel = model.model

                // Execute the model up to the penultimate layer
                // This gives us the feature vector (embedding) before classification
            
                let activationLayer;
            
                try {
                    // MobileNet v1 has a layer usually called 'global_average_pooling2d'
                    activationLayer = internalModel.execute(
                        tensor,
                        ["global_average_pooling2d"]
                    );
                } catch (e) {
                    console.log("Couldn't find global_average_pooling2d layer, using default model output");
                    // If we can't get the specific layer, just use the model directly
                    activationLayer = model.infer(tensor, true);
                }

                // Convert to array and check values
                embedding = Array.from(await activationLayer.data()) as number[]

                // Clean up the tensors
                tensor.dispose()
                activationLayer.dispose()
            }
            setStatus("Embedding generated successfully")
            
            // If there's a callback, call it
            if (onEmbeddingGenerated) {
                onEmbeddingGenerated(embedding)
            }
            
            return embedding;
            
        } catch (error) {
            console.error("Error generating embedding:", error)
            setStatus(
                `Error: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            )
            throw error;
        } finally {
            setIsProcessingEmbedding(false)
        }
    }

    /**
     * Load a TensorFlow.js image model
     */
    async function loadImageModel(): Promise<any> {
        // If using CLIP, we don't need to load MobileNet
        if (config.provider === "clip") {
            return null;
        }

        const modelName = "mobilenet"

        // Return cached model if available
        if (modelCache[modelName]) {
            return modelCache[modelName]
        }

        // Wait if model is already loading
        if (isModelLoading) {
            while (isModelLoading) {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
            if (modelCache[modelName]) {
                return modelCache[modelName]
            }
        }

        try {
            isModelLoading = true
            console.log(`Loading image model: ${modelName}`)

            // Lazy load TensorFlow.js and MobileNet
            if (!tf) {
                console.log("Dynamically importing TensorFlow.js")
                tf = await import("@tensorflow/tfjs")
            }

            if (!mobilenetModule) {
                console.log("Dynamically importing MobileNet")
                mobilenetModule = await import("@tensorflow-models/mobilenet")
            }

            // Initialize TensorFlow.js
            if (!tfInitialized) {
                console.log("Initializing TensorFlow.js")
                await tf.ready()
                tfInitialized = true
            }

            // Prefer WebGL if available
            if (tf.getBackend() !== "webgl" && tf.ENV.getBool("HAS_WEBGL")) {
                console.log("Setting backend to WebGL")
                await tf.setBackend("webgl")
            }

            console.log(`Using backend: ${tf.getBackend()}`)

            // For now, we only support MobileNet
            // Use version 1 with alpha 1.0 for best compatibility
            const model = await mobilenetModule.load({
                version: 1,
                alpha: 1.0,
            })

            // Cache the model
            modelCache[modelName] = model

            console.log(`Image model loaded: ${modelName}`)
            return model
        } catch (error) {
            console.error(`Error loading image model: ${modelName}`, error)
            throw error
        } finally {
            isModelLoading = false
        }
    }

    /**
     * Preprocess an image for the model
     */
    async function preprocessImage(imageData: string): Promise<any> {
        try {
            // Ensure TensorFlow.js is loaded
            if (!tf) {
                console.log(
                    "Dynamically importing TensorFlow.js for preprocessing"
                )
                tf = await import("@tensorflow/tfjs")

                if (!tfInitialized) {
                    console.log("Initializing TensorFlow.js")
                    await tf.ready()
                    tfInitialized = true
                }
            }

            // MobileNet expects 224x224 images
            const inputSize = 224

            // Create an HTMLImageElement from the base64 data
            const image = new window.Image()
            const imagePromise = new Promise<HTMLImageElement>(
                (resolve, reject) => {
                    image.onload = () => resolve(image)
                    image.onerror = (event) => reject(event instanceof Event ? event : new Error(String(event)))
                }
            )

            // Remove data URL prefix if present
            const base64Data = imageData.startsWith("data:image")
                ? imageData
                : `data:image/jpeg;base64,${imageData}`

            // Set crossOrigin to anonymous to avoid CORS issues with data URLs
            image.crossOrigin = "anonymous"
            image.src = base64Data
            await imagePromise

            console.log(
                "Image loaded successfully:",
                image.width,
                "x",
                image.height
            )

            // Create a tensor from the image
            const tensor = tf.browser.fromPixels(image)
            console.log("Image tensor created with shape:", tensor.shape)

            // Resize to the expected input size
            const resized = tf.image.resizeBilinear(tensor, [
                inputSize,
                inputSize,
            ])
            console.log("Image resized to:", resized.shape)

            // Convert to float and normalize to [-1, 1]
            const normalized = resized
                .toFloat()
                .div(tf.scalar(127.5))
                .sub(tf.scalar(1))
            console.log("Image normalized with shape:", normalized.shape)

            // Add batch dimension [1, height, width, channels]
            const batched = normalized.expandDims(0)
            console.log("Added batch dimension:", batched.shape)

            // Clean up intermediate tensors
            tensor.dispose()
            resized.dispose()
            normalized.dispose()

            return batched
        } catch (error) {
            console.error("Error preprocessing image:", error)
            throw error
        }
    }

    // Remove an image from the list
    const removeImage = (id: string) => {
        setImageFiles(prev => {
            const filtered = prev.filter(img => img.id !== id);
            
            // If we removed all images, clear the preview
            if (filtered.length === 0) {
                setPreviewUrl(null);
                setImageData(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
                
                // Call callback with empty string to indicate removal
                onImageSelect("");
            } 
            // Otherwise, set the preview to the last image
            else if (prev.length !== filtered.length) {
                const lastImage = filtered[filtered.length - 1];
                setPreviewUrl(lastImage.previewUrl);
                setImageData(lastImage.base64Data);
                onImageSelect(lastImage.base64Data);
                
                if (onFileNameSelect) {
                    onFileNameSelect(lastImage.fileName);
                }
                
                if (onEmbeddingGenerated && lastImage.embedding) {
                    onEmbeddingGenerated(lastImage.embedding);
                }
            }
            
            return filtered;
        });
    };

    return (
        <div className={`flex flex-col items-center space-y-4 ${className}`}>
            <div
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center p-4 cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden"
                onClick={handleButtonClick}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Show multiple images or single image */}
                {allowMultiple && imageFiles.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 p-2 w-full h-full overflow-y-auto">
                        {imageFiles.map(img => (
                            <div key={img.id} className="relative h-24 w-full rounded overflow-hidden group">
                                <Image 
                                    src={img.previewUrl} 
                                    alt={img.fileName}
                                    fill
                                    style={{ objectFit: "cover" }}
                                    className="rounded"
                                />
                                <button 
                                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(img.id);
                                    }}
                                >
                                    <X className="h-3 w-3 text-white" />
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                                    {img.fileName}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : previewUrl ? (
                    <div className="relative w-full h-full">
                        <Image
                            src={previewUrl}
                            alt="Preview"
                            fill
                            style={{ objectFit: "contain" }}
                        />
                    </div>
                ) : (
                    <>
                        <div className="text-gray-500 mb-2">
                            {isLoading || isProcessingEmbedding
                                ? isProcessingEmbedding 
                                    ? "Processing embedding..." 
                                    : "Processing image..."
                                : allowMultiple
                                    ? "Drag and drop one or more images here, or click to select"
                                    : "Drag and drop an image here, or click to select"}
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-12 w-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                        </svg>
                    </>
                )}
                
                {/* Show loading overlay if needed */}
                {(isLoading || isProcessingEmbedding) && (
                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                        <div className="bg-[white] px-4 py-2 rounded-lg">
                            {isProcessingEmbedding ? "Processing embedding..." : "Processing image..."}
                        </div>
                    </div>
                )}
            </div>

            <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={allowMultiple}
                onChange={handleFileChange}
                className="hidden"
            />

            <div className="flex flex-col sm:flex-row gap-2 w-full">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleButtonClick}
                    disabled={isLoading || isProcessingEmbedding}
                    className="flex-1"
                >
                    {isProcessingEmbedding 
                      ? "Processing..." 
                      : (allowMultiple && imageFiles.length > 0) 
                        ? "Add More Images" 
                        : previewUrl 
                          ? "Change Image" 
                          : "Select Image"}
                </Button>

                {allowMultiple && imageFiles.length > 0 && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setPreviewUrl(null)
                            setImageData(null)
                            setImageFiles([])
                            if (fileInputRef.current)
                                fileInputRef.current.value = ""
                            onImageSelect("")
                        }}
                        className="flex-1"
                    >
                        Clear All Images
                    </Button>
                )}
            </div>

            {status && (
                <div className="text-sm text-gray-600 w-full">
                    Status: {status}
                </div>
            )}
            
            {allowMultiple && imageFiles.length > 0 && (
                <div className="text-sm font-medium text-blue-600 w-full">
                    {imageFiles.length} {imageFiles.length === 1 ? 'image' : 'images'} ready to upload
                </div>
            )}
        </div>
    )
}
