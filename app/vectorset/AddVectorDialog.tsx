"use client"

import {
    VectorSetMetadata,
    isImageEmbedding,
    isTextEmbedding,
} from "@/app/embeddings/types/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Shuffle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import ImageUploader from "../components/ImageUploader"
import RedisCommandBox from "../components/RedisCommandBox"

// Import ImageFileInfo type 
import type { ImageFileInfo } from "../components/ImageUploader"

interface AddVectorModalProps {
    isOpen: boolean
    onClose: () => void
    onAdd: (
        element: string,
        elementData: string | number[],
        useCAS?: boolean
    ) => Promise<void>
    metadata: VectorSetMetadata | null
    dim: number | null
    vectorSetName?: string | null
}

export default function AddVectorModal({
    isOpen,
    onClose,
    onAdd,
    metadata,
    dim,
    vectorSetName = null,
}: AddVectorModalProps) {
    const [element, setElement] = useState("")
    const [elementData, setElementData] = useState("")
    const [imageData, setImageData] = useState("")
    const [imageEmbedding, setImageEmbedding] = useState<number[] | null>(null)
    const [activeTab, setActiveTab] = useState<string>("text")
    const [isRawVectorDetected, setIsRawVectorDetected] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [status, setStatus] = useState("")
    const [useCAS, setUseCAS] = useState(false)
    const [attemptedSubmit, setAttemptedSubmit] = useState(false)
    const [showRedisCommand, setShowRedisCommand] = useState(true)
    const [uploadImages, setUploadImages] = useState<ImageFileInfo[]>([])

    // Check if form is valid and button should be enabled
    const isFormValid = useMemo(() => {
        // Tab-specific validation
        if (activeTab === "image") {
            // For images, check if we have any images to upload
            if (uploadImages.length > 0) {
                return true;
            }
            // Fall back to original logic if needed
            return imageEmbedding !== null || imageData !== "";
        }
        
        // Use existing logic for other tabs
        // Element ID is required for all tabs
        if (!element.trim()) {
            return false;
        }

        if (activeTab === "text") {
            return elementData.trim() !== "";
        } else if (activeTab === "rawVector") {
            // Check if vector data is entered and has correct dimensions
            if (!elementData.trim()) {
                return false;
            }

            // Parse vector data and check dimensions if necessary
            const vectorValues = elementData
                .split(",")
                .map((v) => parseFloat(v.trim()))
                .filter((v) => !isNaN(v));

            // If dim is known, validate vector length
            if (dim && vectorValues.length !== dim) {
                return false;
            }

            // Ensure there's at least some valid vector data
            return vectorValues.length > 0;
        }

        return false;
    }, [element, elementData, activeTab, dim, imageEmbedding, imageData, uploadImages]);

    // Get validation status messages for raw vector data
    const getRawVectorValidationStatus = () => {
        if (!elementData.trim()) {
            return { isValid: false, message: "Please enter vector data" }
        }

        const vectorValues = elementData
            .split(",")
            .map((v) => parseFloat(v.trim()))
            .filter((v) => !isNaN(v))

        if (vectorValues.length === 0) {
            return { isValid: false, message: "No valid numbers found" }
        }

        if (dim && vectorValues.length !== dim) {
            return {
                isValid: false,
                message: `Vector has ${vectorValues.length} dimensions, expected ${dim}`,
            }
        }

        return {
            isValid: true,
            message: `Valid ${vectorValues.length}-dimensional vector`,
        }
    }

    // Determine if we're using an image embedding model using the helper function
    const useImageEmbedding = metadata?.embedding
        ? isImageEmbedding(metadata.embedding)
        : false
    const useTextEmbedding = metadata?.embedding
        ? isTextEmbedding(metadata.embedding)
        : true
    const supportsEmbeddings =
        metadata?.embedding.provider && metadata?.embedding.provider !== "none"

    const reduceDimensions = metadata?.redisConfig?.reduceDimensions
        ? metadata?.redisConfig?.reduceDimensions
        : undefined

    // Set the default active tab based on the embedding data format
    useEffect(() => {
        if (useImageEmbedding) {
            setActiveTab("image")
        } else if (useTextEmbedding) {
            setActiveTab("text")
        }
    }, [useImageEmbedding, useTextEmbedding])

    // Compute the placeholder text based on current searchType
    const embeddingPlaceholder = useMemo(() => {
        if (!supportsEmbeddings) {
            return "Enter text to be embedded"
        } else {
            return "Enter text to be embedded"
        }
    }, [supportsEmbeddings])

    const rawVectorPlaceholder =
        "Enter vector values (e.g., 0.1, 0.2, 0.3, ...)"

    // Function to generate a random vector of the specified dimension
    const generateRandomVector = () => {
        if (!dim) {
            setError(
                "Vector dimension is unknown. Cannot generate random vector."
            )
            return
        }

        // Generate random values between -1 and 1 with 4 decimal places
        const randomVector = Array.from({ length: dim }, () =>
            (Math.random() * 2 - 1).toFixed(4)
        )

        // Set as comma-separated string
        setElementData(randomVector.join(", "))
    }

    // Function to check if input looks like a vector
    const checkForVectorData = (input: string) => {
        const isRawVector =
            input.includes(",") &&
            input.split(",").every((v) => !isNaN(parseFloat(v.trim())))

        setIsRawVectorDetected(isRawVector && activeTab === "text")
        return isRawVector
    }

    // Update elementData handler to check for vector detection
    const handleElementDataChange = (
        e: React.ChangeEvent<HTMLTextAreaElement>
    ) => {
        const newValue = e.target.value
        setElementData(newValue)
        checkForVectorData(newValue)
    }

    // Add a function to handle multiple image uploads
    const handleMultipleImagesUpload = async () => {
        if (uploadImages.length === 0) {
            setError("Please upload at least one image");
            return;
        }

        setIsAdding(true);
        setStatus(`Adding ${uploadImages.length} vectors...`);
        setError(null);

        try {
            // Process each image one by one
            for (let i = 0; i < uploadImages.length; i++) {
                const img = uploadImages[i];
                const imgElement = img.fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
                
                setStatus(`Adding vector ${i + 1} of ${uploadImages.length}: ${imgElement}`);
                
                // Use embedding if available, otherwise use base64 data
                if (img.embedding) {
                    await onAdd(imgElement, img.embedding, useCAS);
                } else {
                    await onAdd(imgElement, img.base64Data, useCAS);
                }
            }
            
            setStatus(`Successfully added ${uploadImages.length} vectors!`);
            
            // Reset form
            setElement("");
            setElementData("");
            setImageData("");
            setImageEmbedding(null);
            setUploadImages([]);
            
            // Close modal
            onClose();
        } catch (err) {
            console.error("Error adding vectors:", err);
            
            // Extract error message
            let errorMessage = "Failed to add vectors";
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === "object" && err !== null) {
                if ("message" in err && typeof err.message === "string") {
                    errorMessage = err.message;
                } else if ("error" in err && typeof err.error === "string") {
                    errorMessage = err.error;
                } else if (
                    "data" in err &&
                    typeof err.data === "object" &&
                    err.data &&
                    "error" in err.data &&
                    typeof err.data.error === "string"
                ) {
                    errorMessage = err.data.error;
                }
            }
            
            setError(errorMessage);
            setStatus("Error adding vectors");
        } finally {
            setIsAdding(false);
        }
    };

    const handleImageSelect = (base64Data: string) => {
        setImageData(base64Data)
        // Reset embedding when a new image is selected
        setImageEmbedding(null)
    }

    const handleEmbeddingGenerated = (embedding: number[]) => {
        setImageEmbedding(embedding)
        setStatus(`Embedding generated: ${embedding.length} dimensions`)
    }

    // Handle changes to the collection of images
    const handleImagesChange = (images: ImageFileInfo[]) => {
        setUploadImages(images);
        
        // If we have images, update the preview
        if (images.length > 0) {
            // If there's only one image, use it to set the form element name
            if (images.length === 1 && (!element || element.startsWith("image_"))) {
                const nameWithoutExtension = images[0].fileName.replace(/\.[^/.]+$/, "");
                const cleanName = nameWithoutExtension.replace(/[^a-zA-Z0-9]/g, "_");
                setElement(cleanName);
            }
            
            // For compatibility, set the imageData and imageEmbedding from the last image
            const lastImage = images[images.length - 1];
            setImageData(lastImage.base64Data);
            if (lastImage.embedding) {
                setImageEmbedding(lastImage.embedding);
            }
        } else {
            // Clear data if no images
            setImageData("");
            setImageEmbedding(null);
        }
    };

    // Update the handleSubmit function to use the new multi-upload function
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setAttemptedSubmit(true);

        // For image tab with multiple images, use the dedicated function
        if (activeTab === "image" && uploadImages.length > 1) {
            await handleMultipleImagesUpload();
            return;
        }

        // Original logic for single uploads
        if (!element.trim()) {
            setError("Please enter an element ID");
            return;
        }

        if (
            (activeTab === "text" || activeTab === "rawVector") &&
            !elementData.trim()
        ) {
            setError("Please enter element data");
            return;
        }

        if (activeTab === "image" && !imageData) {
            setError("Please upload an image");
            return;
        }

        try {
            setIsAdding(true);
            setStatus("Adding vector...");
            setError(null);

            // Use the pre-generated embedding if available for images
            if (activeTab === "image" && imageEmbedding) {
                console.log("Adding image embedding:", imageEmbedding.length);
                await onAdd(element, imageEmbedding, useCAS);
                setStatus("Vector added successfully!");
            } else if (activeTab === "image") {
                await onAdd(element, imageData, useCAS);
                setStatus("Vector added successfully!");
            } else if (activeTab === "rawVector") {
                // Convert string of numbers to an actual number array
                const vectorValues = elementData
                    .split(",")
                    .map((v) => parseFloat(v.trim()))
                    .filter((v) => !isNaN(v));

                await onAdd(element, vectorValues, useCAS);
                setStatus("Vector added successfully!");
            } else {
                // Check if elementData contains comma-separated numbers
                const isRawVector = checkForVectorData(elementData);

                if (isRawVector && isRawVectorDetected) {
                    // Users have confirmed they want to add the vector directly
                    const vectorValues = elementData
                        .split(",")
                        .map((v) => parseFloat(v.trim()))
                        .filter((v) => !isNaN(v));

                    await onAdd(element, vectorValues, useCAS);
                } else {
                    // It's text to be embedded
                    await onAdd(element, elementData, useCAS);
                }
                setStatus("Vector added successfully!");
            }

            // Reset form
            setElement("");
            setElementData("");
            setImageData("");
            setImageEmbedding(null);
            setUploadImages([]);

            // Close modal
            onClose();
        } catch (err) {
            console.error("Error adding vector:", err);

            // Extract the most informative error message
            let errorMessage = "Failed to add vector";
            if (err instanceof Error) {
                errorMessage = err.message;
            } else if (typeof err === "object" && err !== null) {
                // Try to extract error message from various possible formats
                if ("message" in err && typeof err.message === "string") {
                    errorMessage = err.message;
                } else if ("error" in err && typeof err.error === "string") {
                    errorMessage = err.error;
                } else if (
                    "data" in err &&
                    typeof err.data === "object" &&
                    err.data &&
                    "error" in err.data &&
                    typeof err.data.error === "string"
                ) {
                    errorMessage = err.data.error;
                }
            }

            setError(errorMessage);
            setStatus("Error adding vector");
            // Keep the modal open so the user can see the error
        } finally {
            setIsAdding(false);
        }
    };

    // Add a new handler for file name selection
    const handleFileNameSelect = (fileName: string) => {
        // Only set the element name if it's empty or was auto-generated previously
        if (!element.trim() || element.startsWith("image_")) {
            // Remove file extension and use as element ID
            const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, "")
            // Clean up the name - replace spaces and special chars with underscores
            const cleanName = nameWithoutExtension.replace(/[^a-zA-Z0-9]/g, "_")
            setElement(cleanName)
        }
    }

    // Function to generate the VADD command preview
    const getVaddCommand = () => {
        if (
            !element ||
            (!elementData &&
                (activeTab === "text" || activeTab === "rawVector")) ||
            (!imageData && activeTab === "image")
        ) {
            return `VADD ${vectorSetName || "vector-set"} ${
                reduceDimensions ? `REDUCE ${reduceDimensions}` : ""
            } VALUES [vector values...] ${element || "element_id"} ${
                useCAS ? "CAS" : ""
            }`
        }

        let command = `VADD ${vectorSetName || "vector-set"} ${
            reduceDimensions ? `REDUCE ${reduceDimensions}` : ""
        }`

        // Add VALUES part
        if (activeTab === "rawVector") {
            // Format as vector values
            const vectorValues = elementData
                .split(",")
                .map((v) => parseFloat(v.trim()))
                .filter((v) => !isNaN(v))

            // Only include dimensions if we have them
            if (vectorValues.length > 0) {
                command += ` VALUES ${vectorValues.length} ${vectorValues.join(
                    " "
                )}`
            } else {
                command += ` VALUES [vector values...]`
            }
        } else if (activeTab === "text") {
            // For text, try to determine if it's raw vector data or text to embed
            const isRawVector = checkForVectorData(elementData)

            if (isRawVector && isRawVectorDetected) {
                // Format as vector values
                const vectorValues = elementData
                    .split(",")
                    .map((v) => parseFloat(v.trim()))
                    .filter((v) => !isNaN(v))

                // Only include dimensions if we have them
                if (vectorValues.length > 0) {
                    command += ` VALUES ${
                        vectorValues.length
                    } ${vectorValues.join(" ")}`
                } else {
                    command += ` VALUES [vector values...]`
                }
            } else {
                // It's text to be embedded
                command += ` VALUES [text to be embedded: "${elementData.substring(
                    0,
                    30
                )}${elementData.length > 30 ? "..." : ""}"]`
            }
        } else if (activeTab === "image") {
            if (imageEmbedding) {
                // Show with actual embedding dimensions
                command += ` VALUES ${imageEmbedding.length} [image embedding values...]`
            } else {
                // Show placeholder for image data without dimensions
                command += ` VALUES [image data will be embedded]`
            }
        }

        // Add element ID
        command += ` "${element}"`

        // Add CAS flag if enabled
        if (useCAS) {
            command += " CAS"
        }

        return command
    }

    // Memoize the command to prevent re-renders
    const vaddCommand = useMemo(
        () => getVaddCommand(),
        [
            element,
            elementData,
            imageData,
            imageEmbedding,
            activeTab,
            isRawVectorDetected,
            useCAS,
            vectorSetName,
            reduceDimensions,
            dim,
        ]
    )

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <h2 className="text-2xl font-bold mb-4">
                        Add Vector to {vectorSetName || "Vector Set"}
                    </h2>

                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-2"
                    >
                        <div className="mb-4">
                            <label
                                htmlFor="element"
                                className="block text-sm font-medium mb-1"
                            >
                                Element ID
                            </label>
                            <Input
                                id="element"
                                value={element}
                                onChange={(e) => setElement(e.target.value)}
                                placeholder="Enter a unique identifier for this vector"
                                disabled={activeTab === "image" && uploadImages.length > 1}
                            />
                            {activeTab === "image" && uploadImages.length > 1 && (
                                <p className="mt-1 text-xs text-blue-600">
                                    File names will be used as element IDs for multiple uploads
                                </p>
                            )}
                            {attemptedSubmit && element.trim() === "" && !(activeTab === "image" && uploadImages.length > 1) && (
                                <p className="mt-1 text-xs text-yellow-600">
                                    Element ID is required
                                </p>
                            )}
                        </div>
                        <div className="form-item w-full flex flex-col gap-2 items-start text-left">
                            <Label className="w-full text-left">
                                Vector Data
                            </Label>
                            <Tabs
                                value={activeTab}
                                onValueChange={setActiveTab}
                                className="mb-4 w-full"
                            >
                                <TabsList className="mb-2 w-full">
                                    <TabsTrigger
                                        value="text"
                                        disabled={!useTextEmbedding}
                                        className="w-full"
                                    >
                                        Text
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="rawVector"
                                        className="w-full"
                                    >
                                        Raw Vector Data
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="image"
                                        disabled={
                                            !useImageEmbedding &&
                                            useTextEmbedding
                                        }
                                        className="w-full"
                                    >
                                        Image
                                    </TabsTrigger>
                                    {/* <TabsTrigger
                                    value="image"
                                    disabled={
                                        !useImageEmbedding && useTextEmbedding
                                    }
                                    className="w-full"
                                >
                                    Audio
                                </TabsTrigger> */}
                                </TabsList>

                                <TabsContent value="text">
                                    <div>
                                        <Textarea
                                            id="elementData"
                                            value={elementData}
                                            onChange={handleElementDataChange}
                                            placeholder={embeddingPlaceholder}
                                            rows={5}
                                        />

                                        {isRawVectorDetected && (
                                            <div className="mt-2 text-xs p-2 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
                                                The text you've entered looks
                                                like vector data. Do you want
                                                to:
                                                <div className="mt-2 flex space-x-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() =>
                                                            setActiveTab(
                                                                "rawVector"
                                                            )
                                                        }
                                                    >
                                                        Add as raw vector
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setIsRawVectorDetected(
                                                                false
                                                            )
                                                        }
                                                    >
                                                        Embed as text
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="rawVector">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label
                                                htmlFor="rawVectorData"
                                                className="block text-sm font-medium"
                                            >
                                                Vector Data
                                            </label>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                className="flex items-center gap-1 h-8"
                                                onClick={generateRandomVector}
                                                disabled={!dim}
                                                title={
                                                    dim
                                                        ? `Generate a random ${dim}-dimensional vector`
                                                        : "Vector dimension unknown"
                                                }
                                            >
                                                <Shuffle className="h-4 w-4" />
                                                Generate Random Vector
                                            </Button>
                                        </div>
                                        <Textarea
                                            id="rawVectorData"
                                            value={elementData}
                                            onChange={(e) =>
                                                setElementData(e.target.value)
                                            }
                                            placeholder={rawVectorPlaceholder}
                                            rows={5}
                                        />

                                        {elementData.trim() !== "" && (
                                            <div
                                                className={`mt-2 text-sm ${
                                                    getRawVectorValidationStatus()
                                                        .isValid
                                                        ? "text-green-600"
                                                        : "text-yellow-600"
                                                }`}
                                            >
                                                {
                                                    getRawVectorValidationStatus()
                                                        .message
                                                }
                                            </div>
                                        )}

                                        <p className="mt-1 text-xs text-gray-500">
                                            Enter comma-separated numbers
                                            representing your vector values.
                                            {dim &&
                                                ` Expected dimension: ${dim}`}
                                        </p>
                                    </div>
                                </TabsContent>

                                <TabsContent value="image">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Image Upload
                                        </label>
                                        <ImageUploader
                                            onImageSelect={handleImageSelect}
                                            onEmbeddingGenerated={handleEmbeddingGenerated}
                                            onFileNameSelect={handleFileNameSelect}
                                            onImagesChange={handleImagesChange}
                                            config={metadata?.embedding?.image || { model: "mobilenet" }}
                                            allowMultiple={true}
                                        />
                                        {imageEmbedding && uploadImages.length <= 1 && (
                                            <div className="mt-2 text-sm text-green-600">
                                                ✓ Embedding generated ({imageEmbedding.length} dimensions)
                                            </div>
                                        )}
                                        {uploadImages.length > 1 && (
                                            <div className="mt-2 text-sm text-blue-600">
                                                <p>
                                                    <span className="font-medium">{uploadImages.length}</span> images selected. 
                                                    Each image will be added as a separate vector using the image filename as its element ID.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="py-2 flex items-center space-x-2 form-item">
                            <Label
                                htmlFor="cas-toggle"
                                className="cursor-pointer flex flex-col gap-1"
                            >
                                <div>Use Multi-threaded insert</div>
                                <div className="text-xs text-gray-500">
                                    Sets the CAS flag (Check and Set) which uses
                                    multi-threading when adding to the
                                    vectorset, improving performance.
                                </div>
                            </Label>
                            <Switch
                                id="cas-toggle"
                                checked={useCAS}
                                onCheckedChange={setUseCAS}
                            />
                        </div>

                        {error && (
                            <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded">
                                {error}
                            </div>
                        )}

                        {status && !error && (
                            <div className="mb-4 p-2 bg-blue-100 border border-blue-400 text-blue-700 rounded">
                                {status}
                            </div>
                        )}

                        {attemptedSubmit && !isFormValid && !error && (
                            <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-sm">
                                {!element.trim()
                                    ? "Please enter an Element ID"
                                    : activeTab === "text" &&
                                      !elementData.trim()
                                    ? "Please enter text to embed"
                                    : activeTab === "rawVector" &&
                                      !getRawVectorValidationStatus().isValid
                                    ? getRawVectorValidationStatus().message
                                    : activeTab === "image" && !imageData
                                    ? "Please upload an image"
                                    : "Please complete all required fields"}
                            </div>
                        )}

                        {/* Replace the Command Preview Box with RedisCommandBox */}
                        <div className="w-full py-2">
                            <Label className="w-full text-left">
                                Redis Command
                            </Label>
                            <RedisCommandBox
                                vectorSetName={vectorSetName || "vector-set"}
                                dim={dim}
                                executedCommand={vaddCommand}
                                searchQuery={elementData}
                                searchFilter=""
                                showRedisCommand={showRedisCommand}
                                setShowRedisCommand={setShowRedisCommand}
                            />
                        </div>

                        <div className="flex justify-end space-x-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={isAdding}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!isFormValid || isAdding}
                            >
                                {isAdding 
                                    ? "Adding..." 
                                    : activeTab === "image" && uploadImages.length > 1
                                        ? `Add ${uploadImages.length} Vectors`
                                        : "Add Vector"}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
