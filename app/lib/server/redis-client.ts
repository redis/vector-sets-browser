import { createClient, RedisClientType } from 'redis';

// Types for Redis operations
export interface RedisVectorMetadata {
    data: string;
}

export interface VectorOperationResult {
    success: boolean;
    error?: string;
    result?: any;
}

export class RedisClient {
    private static async createConnection(url: string): Promise<RedisClientType> {
        const client = createClient({
            url,
            socket: {
                connectTimeout: 5000,
            }
        });

        client.on("error", (err) => console.error("Redis Client Error:", err));
        await client.connect();
        return client;
    }

    public static async withConnection<T>(url: string, operation: (client: RedisClientType) => Promise<T>): Promise<VectorOperationResult> {
        let client: RedisClientType | null = null;
        
        try {
            client = await RedisClient.createConnection(url);
            const result = await operation(client);
            return { success: true, result };
        } catch (error) {
            console.error("Operation failed:", error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : String(error)
            };
        } finally {
            if (client) {
                await client.quit().catch(console.error);
            }
        }
    }
}

// Vector operations
export async function scanVectorSets(url: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        console.log('Starting scanVectorSets operation');
        let cursor = "0";
        const vectorSets = new Set<string>();
        
        do {
            console.log('Scanning with cursor:', cursor);
            // First try FT._LIST to get all vector indexes
            try {
                const indexes = await client.sendCommand(['FT._LIST']) as string[];
                console.log('Found indexes:', indexes);
                
                // For each index, get its key prefix
                for (const index of indexes) {
                    try {
                        const info = await client.sendCommand(['FT.INFO', index]) as any[];
                        // Find the key prefix in the info array
                        const prefixIndex = info.indexOf('prefix');
                        if (prefixIndex !== -1 && prefixIndex + 1 < info.length) {
                            const prefix = info[prefixIndex + 1];
                            console.log('Found prefix for index:', index, 'prefix:', prefix);
                            vectorSets.add(prefix.replace(/[{}]/g, '')); // Remove Redis prefix/suffix markers
                        }
                    } catch (error) {
                        console.error('Error getting info for index:', index, error);
                    }
                }
                break; // Exit the do-while loop as we've found all indexes
            } catch (error) {
                console.log('FT._LIST not available, falling back to SCAN');
                // Fall back to SCAN if FT._LIST is not available
                const [nextCursor, keys] = await client.sendCommand([
                    "SCAN",
                    cursor,
                    "TYPE",
                    "vectorset"
                ]) as [string, string[]];
                
                console.log('SCAN results:', { nextCursor, keys });
                keys.forEach(key => vectorSets.add(key));
                cursor = nextCursor;
            }
        } while (cursor !== "0");

        const result = Array.from(vectorSets);
        console.log('Final vector sets found:', result);
        return result;
    });
}

export async function vadd(url: string, keyName: string, element: string, vector: number[]): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const args = ["VADD", keyName, "VALUES", String(vector.length), ...vector.map(String), element];
        return client.sendCommand(args);
    });
}

export async function vsim(
    url: string,
    keyName: string, 
    params: { searchVector?: number[], searchElement?: string, count: number }
): Promise<VectorOperationResult> {

    console.log("VSIM", url, keyName, params)
    if (!params.searchVector && !params.searchElement) {
        return { success: false, error: "Either searchVector or searchElement is required" };
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            const baseCommand = ["VSIM", keyName];
            
            if (params.searchVector) {
                baseCommand.push(
                    "VALUES",
                    String(params.searchVector.length),
                    ...params.searchVector.map(String)
                );
            } else if (params.searchElement) {
                baseCommand.push("ELE", params.searchElement);
            }
            
            baseCommand.push("WITHSCORES", "COUNT", String(params.count));
            //console.log('VSIM command:', baseCommand);
            
            const result = await client.sendCommand(baseCommand) as string[];
            
            if (!result || !Array.isArray(result)) {
                throw new Error('Invalid response from Redis VSIM command');
            }
            
            // Convert the flat array into pairs of [element, score]
            const pairs: [string, number][] = [];
            for (let i = 0; i < result.length; i += 2) {
                const element = result[i];
                const score = result[i + 1];
                
                if (!element || !score) {
                    console.warn(`Invalid pair at index ${i}:`, { element, score });
                    continue;
                }
                
                const numScore = parseFloat(score);
                if (isNaN(numScore)) {
                    console.warn(`Invalid score for element ${element}:`, score);
                    continue;
                }
                
                pairs.push([element, numScore]);
            }
            
            return pairs;
        } catch (error) {
            console.error('VSIM operation error:', error);
            throw error;
        }
    });
}

export async function vdim(url: string, keyName: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.sendCommand(["VDIM", keyName]);
    });
}

export async function vcard(url: string, keyName: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.sendCommand(["VCARD", keyName]);
    });
}

export async function vrem(url: string, keyName: string, element: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.sendCommand(["VREM", String(keyName), String(element)]);
    });
}

export async function vemb(url: string, keyName: string, element: string): Promise<VectorOperationResult> {
    if (!keyName || !element) {
        console.error('Invalid VEMB parameters:', { keyName, element });
        return {
            success: false,
            error: `Invalid parameters: keyName=${keyName}, element=${element}`
        };
    }

    return RedisClient.withConnection(url, async (client) => {
        try {
            // Ensure arguments are strings for Redis command
            const args = ["VEMB", String(keyName), String(element)];
            console.log('VEMB command args:', args);
            const result = await client.sendCommand(args);
            
            if (!result || !Array.isArray(result)) {
                console.error('Invalid VEMB result:', result);
                throw new Error(`Failed to get vector for element ${element}`);
            }
            
            const vector = result.map(v => {
                const num = Number(v);
                if (isNaN(num)) {
                    console.warn(`Non-numeric value in vector for ${element}:`, v);
                    return 0;
                }
                return num;
            });
            
            return vector;
        } catch (error) {
            console.error('VEMB operation error:', error);
            throw new Error(`Failed to get vector for element ${element}: ${error.message}`);
        }
    });
}

export async function getRedisInfo(url: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        return client.info();
    });
}

export async function getMetadata(url: string, keyName: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const metadataKey = `${keyName}_metadata`;
        const storedData = await client.hGetAll(metadataKey);
        console.log("Stored data:", storedData);
        const metadata = storedData.data ? JSON.parse(storedData.data) : null;
        return metadata;  // Return metadata directly without wrapping
    });
}

export async function setMetadata(url: string, keyName: string, metadata: any): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const metadataKey = `${keyName}_metadata`;
        await client.hSet(metadataKey, { data: JSON.stringify(metadata) });
        return true;
    });
}

export async function getMemoryUsage(url: string, keyName: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        const memoryUsage = await client.sendCommand(["MEMORY", "USAGE", keyName]);
        
        if (memoryUsage === null || memoryUsage === undefined) {
            const keyType = await client.type(keyName);
            if (keyType === 'none') {
                throw new Error("Key does not exist");
            }
        }
        
        return memoryUsage || 0;
    });
}

export async function createVectorSet(
    url: string,
    keyName: string,
    dimensions: number,
    metadata?: any,
    customData?: { elementId: string; vector: number[] }
): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Check if key already exists
        console.log("Creating vector set:", { keyName, dimensions, metadata, customData });
        const exists = await client.sendCommand(["EXISTS", keyName]);
        if (exists) {
            throw new Error("Vector set already exists");
        }

        let effectiveDimensions = dimensions;

        // If dimensions is 0 and we have Ollama config, get dimensions from a test embedding
        if (dimensions === 0 && metadata?.embedding?.provider === 'ollama') {
            try {
                // Get a test embedding to determine dimensions
                const response = await fetch(metadata.embedding.apiUrl!, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: metadata.embedding.modelName,
                        prompt: 'test', // Simple test prompt
                    }),
                });
                console.log("Ollama response:", response);
                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.statusText}`);
                }

                const data = await response.json();
                effectiveDimensions = data.embedding.length;
            } catch (error) {
                throw new Error(`Failed to get dimensions from Ollama: ${error instanceof Error ? error.message : String(error)}`);
            }
        } else if (!dimensions || dimensions < 2) {
            throw new Error("Dimensions must be at least 2");
        }

        // Create the vector set with either the custom vector or a dummy vector
        const vector = customData?.vector || Array(effectiveDimensions).fill(0);
        const elementId = customData?.elementId || "dummy";
        console.log("Create dummy Vector:", vector);
        // Validate vector dimensions
        if (vector.length !== effectiveDimensions) {
            throw new Error(`Vector dimensions (${vector.length}) do not match specified dimensions (${effectiveDimensions})`);
        }

        // Create the vector set
        console.log("Create vector set command:", [
            "VADD",
            keyName,
            "VALUES",
            effectiveDimensions.toString(),
            ...vector.map(String),
            elementId
        ]);
        await client.sendCommand([
            "VADD",
            keyName,
            "VALUES",
            effectiveDimensions.toString(),
            ...vector.map(String),
            elementId
        ]);

        return "created";
    });
}

export async function deleteVectorSet(url: string, keyName: string): Promise<VectorOperationResult> {
    return RedisClient.withConnection(url, async (client) => {
        // Delete the key
        const deleteResult = await client.sendCommand(["DEL", keyName]) as number;
        
        if (deleteResult === 0) {
            throw new Error(`Failed to delete vector set '${keyName}'`);
        }

        // Also delete metadata
        const metadataKey = `${keyName}_metadata`;
        await client.del(metadataKey);

        return "deleted";
    });
}

export default RedisClient; 