import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService";
import { fileToBase64 } from "@/lib/embeddings/client/imageProcessingService";
import { VectorSetMetadata } from "@/lib/types/vectors";

// Helper function to get element ID from text content
export const getElementIdFromText = (text: string): string => {
    const words = text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0);
    if (words.length >= 2) {
        return `Text: ${words[0]} ${words[1]}`;
    } else if (words.length === 1) {
        return `Text: ${words[0]}`;
    } else {
        return `Text: unknown`;
    }
};

// List of recognized text file MIME types
export const textMimeTypes = [
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/csv",
    "text/markdown",
    "text/xml",
    "application/json",
    "application/xml",
    "application/javascript",
];

// List of recognized text file extensions
export const textExtensions = [
    ".txt",
    ".md",
    ".markdown",
    ".json",
    ".csv",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".yaml",
    ".yml",
    ".toml",
    ".ini",
    ".cfg",
    ".conf",
    ".py",
    ".rb",
    ".java",
    ".c",
    ".cpp",
    ".h",
    ".cs",
    ".go",
    ".rs",
    ".php",
    ".sql",
    ".sh",
    ".bat",
    ".log",
];

// Check if a file is a text file
export const isTextFile = (file: File): boolean => {
    // Check by MIME type
    if (textMimeTypes.includes(file.type)) {
        return true;
    }

    // Check by file extension
    const fileName = file.name.toLowerCase();
    return textExtensions.some((ext) => fileName.endsWith(ext));
};

// Process text content and generate embedding
export const processTextContent = async (
    text: string,
    metadata: VectorSetMetadata,
    fileName?: string,
    onAddVector?: (element: string, embedding: number[]) => Promise<void>
): Promise<void> => {
    if (!onAddVector) {
        console.error("onAddVector function not provided");
        return;
    }

    try {
        // Use the embedding configuration from the vectorset metadata
        if (!metadata?.embedding) {
            console.error("No embedding configuration in metadata");
            return;
        }

        const embedding = await clientEmbeddingService.getEmbedding(
            text,
            metadata.embedding
        );

        // Use either the file name or generate ID from text content
        const elementId = fileName ? fileName : getElementIdFromText(text);

        // Add the vector
        await onAddVector(elementId, embedding);
    } catch (error) {
        console.error(`Error processing text:`, error);
    }
};

// Process image file and generate embedding
export const processImageFile = async (
    file: File,
    metadata: VectorSetMetadata,
    onAddVector?: (element: string, embedding: number[]) => Promise<void>,
    onError?: (message: string) => void
): Promise<void> => {
    if (!onAddVector) {
        console.error("onAddVector function not provided");
        return;
    }

    try {
        // Check file size before processing
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            const errorMsg = `Image ${file.name} is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 10MB.`;
            console.error(errorMsg);
            if (onError) onError(errorMsg);
            return;
        }

        // Check image MIME type
        if (!file.type.startsWith("image/")) {
            const errorMsg = `File ${file.name} is not a supported image format.`;
            console.error(errorMsg);
            if (onError) onError(errorMsg);
            return;
        }

        // Use the embedding configuration from metadata
        if (!metadata?.embedding) {
            const errorMsg = "No embedding configuration in metadata";
            console.error(errorMsg);
            if (onError) onError(errorMsg);
            return;
        }

        try {
            // Convert to base64
            const base64Data = await fileToBase64(file);

            // Generate embedding using the model from metadata
            const embedding = await clientEmbeddingService.getEmbedding(
                base64Data,
                metadata.embedding,
                true
            );

            // Use the file name as the element ID (without extension)
            const elementId = file.name
                .replace(/\.[^/.]+$/, "")
                .replace(/[^a-zA-Z0-9]/g, "_");

            // Add the vector
            await onAddVector(elementId, embedding);
        } catch (processingError) {
            let errorMessage = processingError instanceof Error 
                ? processingError.message 
                : `Unknown error processing image ${file.name}`;
            
            // Provide more specific guidance for common errors
            if (errorMessage.includes("offset is out of bounds") || 
                errorMessage.includes("memory limitations")) {
                errorMessage = `Image ${file.name} could not be processed. The image may be too large or complex. Try using a smaller or simpler image.`;
            }
            
            console.error(`Error processing image ${file.name}:`, processingError);
            
            if (onError) {
                onError(errorMessage);
            }
            
            throw new Error(errorMessage); // re-throw to signal failure to caller
        }
    } catch (error) {
        const errorMessage = error instanceof Error 
            ? error.message 
            : `Unknown error processing image ${file.name}`;
            
        console.error(`Error processing image ${file.name}:`, error);
        
        if (onError) {
            onError(errorMessage);
        }
    }
};

// Check if a drag event contains valid items (images or text)
export const containsValidItems = (items: DataTransferItemList): boolean => {
    return Array.from(items).some(
        (item) =>
            (item.kind === "file" &&
                (item.type.startsWith("image/") ||
                    item.type === "text/plain")) ||
            (item.kind === "string" && item.type === "text/plain")
    );
}; 