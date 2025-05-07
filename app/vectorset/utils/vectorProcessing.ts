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
    onAddVector?: (element: string, embedding: number[]) => Promise<void>
): Promise<void> => {
    if (!onAddVector) {
        console.error("onAddVector function not provided");
        return;
    }

    try {
        // Convert to base64
        const base64Data = await fileToBase64(file);

        // Generate embedding using CLIP
        const config = {
            provider: "clip" as const,
            clip: {
                model: "clip-vit-base-patch32",
            },
        };

        const embedding = await clientEmbeddingService.getEmbedding(
            base64Data,
            config,
            true
        );

        // Use the file name as the element ID (without extension)
        const elementId = file.name
            .replace(/\.[^/.]+$/, "")
            .replace(/[^a-zA-Z0-9]/g, "_");

        // Add the vector
        await onAddVector(elementId, embedding);
    } catch (error) {
        console.error(`Error processing image ${file.name}:`, error);
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