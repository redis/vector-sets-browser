import { VectorSetAdvancedConfig } from "@/app/types/vectorSetMetaData"
import { vadd_multi } from "../redis-server/api"

interface VectorElement {
    element: string
    vector: number[]
    attributes?: Record<string, string | number | boolean>
}

/**
 * Imports vector data into Redis in chunks using VADD_MULTI and SETATTRIB
 */
export async function importVectorData(
    vectorSetName: string,
    data: VectorElement[],
    config?: VectorSetAdvancedConfig,
    chunkSize: number = 100
) {
    const chunks = chunkArray(data, chunkSize)

    for (const chunk of chunks) {
        // Prepare VADD_MULTI payload
        const elements = chunk.map((item) => item.element)
        const vectors = chunk.map((item) => item.vector)
        const attributes = chunk.map((item) => item.attributes || {}) 

        const response = await vadd_multi({
            keyName: vectorSetName,
            elements,
            vectors,
            attributes,
            reduceDimensions: config?.reduceDimensions,
            useCAS: config?.defaultCAS,
            ef: config?.buildExplorationFactor,
        })

        if (!response) {
            throw new Error('Failed to import vectors')
        }
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

/**
 * Creates a VectorElement object with the given parameters
 */
export function buildVectorElement(
    element: string,
    vector: number[],
    attributes?: Record<string, string | number | boolean>
): VectorElement {
    return {
        element,
        vector,
        ...(attributes && { attributes })
    }
}

/**
 * Saves an array of VectorElements to a JSON file via the API
 * @returns The public URL path where the file was saved
 */
export async function saveVectorData(
    filename: string,
    data: VectorElement[]
): Promise<{ success: boolean; filePath: string }> {
    console.log(`[importUtils] Saving ${data.length} vectors to ${filename}`)
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/vector2json`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data, filename }),
    });

    const result = await response.json();

    if (!response.ok) {
        console.error('[importUtils] Failed to save vector data:', result);
        throw new Error(`Failed to save vector data: ${result.error || 'Unknown error'}${result.details ? `: ${result.details}` : ''}`);
    }

    console.log('[importUtils] Successfully saved vector data:', result);
    return result;
}

/**
 * Reads vector data from a JSON file and imports it into Redis
 */
export async function importVectorDataFromFile(
    filename: string,
    vectorSetName: string,
    config: VectorSetAdvancedConfig,
    chunkSize?: number
): Promise<void> {
    try {
        const response = await fetch(`/${filename}`);
        if (!response.ok) {
            throw new Error('Failed to read vector data file');
        }
        const vectorData = await response.json() as VectorElement[];
        
        if (!Array.isArray(vectorData)) {
            throw new Error('File content must be an array of vector elements');
        }
        
        await importVectorData(vectorSetName, vectorData, config, chunkSize);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to import vector data from file: ${error.message}`);
        }
        throw error;
    }
}
