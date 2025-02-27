import { NextResponse } from "next/server";
import { createClient } from "redis";
import { cookies } from "next/headers";
import { RedisClient } from '@/app/lib/server/redis-client';

const REDIS_URL_COOKIE = 'redis_url';
// Single key for all embeddings using Redis Hash
const EMBEDDINGS_HASH_KEY = 'embeddings_cache';
const CACHE_CONFIG_KEY = "embedding_cache_config";
const CACHE_METADATA_KEY = "embedding_cache_metadata";

// Cache configuration interface
interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  useCache: boolean;
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000, // Maximum number of entries in the cache
  defaultTTL: 24 * 60 * 60, // 24 hours in seconds
  useCache: true, // Enable caching by default
};

// Cache metadata interface
interface CacheMetadata {
  entries: Record<string, { timestamp: number, ttl: number }>;
}

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
  const url = cookies().get(REDIS_URL_COOKIE)?.value;
  return url || null;
}

// Get the current cache configuration
async function getCacheConfig(): Promise<CacheConfig> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return DEFAULT_CACHE_CONFIG;
    }

    return await RedisClient.withConnection(url, async (client) => {
      const configStr = await client.get(CACHE_CONFIG_KEY);
      
      if (configStr) {
        // Ensure all required fields are present
        const parsedConfig = JSON.parse(configStr);
        return {
          ...DEFAULT_CACHE_CONFIG,
          ...parsedConfig
        };
      }
      
      // If no config exists, set the default and return it
      await client.set(CACHE_CONFIG_KEY, JSON.stringify(DEFAULT_CACHE_CONFIG));
      return DEFAULT_CACHE_CONFIG;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error getting cache config:", result.error);
        return DEFAULT_CACHE_CONFIG;
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error getting cache config:", error);
    return DEFAULT_CACHE_CONFIG;
  }
}

// Get cache metadata
async function getCacheMetadata(): Promise<CacheMetadata> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return { entries: {} };
    }

    return await RedisClient.withConnection(url, async (client) => {
      const metadataStr = await client.get(CACHE_METADATA_KEY);
      
      if (metadataStr) {
        return JSON.parse(metadataStr);
      }
      
      // If no metadata exists, create an empty one
      const emptyMetadata: CacheMetadata = { entries: {} };
      await client.set(CACHE_METADATA_KEY, JSON.stringify(emptyMetadata));
      return emptyMetadata;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error getting cache metadata:", result.error);
        return { entries: {} };
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error getting cache metadata:", error);
    return { entries: {} };
  }
}

// Update cache metadata
async function updateCacheMetadata(metadata: CacheMetadata): Promise<void> {
  try {
    const url = getRedisUrl();
    if (!url) {
      return;
    }

    await RedisClient.withConnection(url, async (client) => {
      await client.set(CACHE_METADATA_KEY, JSON.stringify(metadata));
      return true;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error updating cache metadata:", result.error);
      }
    });
  } catch (error) {
    console.error("[Cache] Error updating cache metadata:", error);
  }
}

// Set the cache configuration
async function setCacheConfig(config: Partial<CacheConfig>): Promise<CacheConfig> {
  try {
    const url = getRedisUrl();
    if (!url) {
      throw new Error("No Redis connection available");
    }

    return await RedisClient.withConnection(url, async (client) => {
      // Get current config first
      const currentConfigStr = await client.get(CACHE_CONFIG_KEY);
      const currentConfig = currentConfigStr 
        ? { ...DEFAULT_CACHE_CONFIG, ...JSON.parse(currentConfigStr) } 
        : DEFAULT_CACHE_CONFIG;
      
      // Merge with new config
      const newConfig = { ...currentConfig, ...config };
      
      // Save to Redis
      await client.set(CACHE_CONFIG_KEY, JSON.stringify(newConfig));
      return newConfig;
    }).then(result => {
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error setting cache config:", error);
    throw error;
  }
}

// Get the current cache size (number of entries)
async function getCacheSize() {
  try {
    const url = getRedisUrl();
    if (!url) {
      return 0;
    }

    return await RedisClient.withConnection(url, async (client) => {
      // Get the number of fields in the hash
      const size = await client.hLen(EMBEDDINGS_HASH_KEY);
      return size;
    }).then(result => {
      if (!result.success) {
        console.error("[Cache] Error getting cache size:", result.error);
        return 0;
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error getting cache size:", error);
    return 0;
  }
}

// Clear all cache entries
async function clearCache() {
  try {
    const url = getRedisUrl();
    if (!url) {
      throw new Error("No Redis connection available");
    }

    return await RedisClient.withConnection(url, async (client) => {
      // Get the number of fields before deletion for reporting
      const size = await client.hLen(EMBEDDINGS_HASH_KEY);
      
      // Delete the hash and metadata
      await client.del(EMBEDDINGS_HASH_KEY);
      
      // Reset the metadata
      const emptyMetadata: CacheMetadata = { entries: {} };
      await client.set(CACHE_METADATA_KEY, JSON.stringify(emptyMetadata));
      
      return { cleared: size };
    }).then(result => {
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.result;
    });
  } catch (error) {
    console.error("[Cache] Error clearing cache:", error);
    throw error;
  }
}

// Enforce the cache size limit by removing oldest entries
async function enforceCacheSizeLimit() {
  try {
    const url = getRedisUrl();
    if (!url) {
      return { removed: 0 };
    }

    const config = await getCacheConfig();
    const metadata = await getCacheMetadata();
    
    // Get all entries and sort by timestamp (oldest first)
    const entries = Object.entries(metadata.entries);
    
    if (entries.length <= config.maxSize) {
      return { removed: 0 };
    }
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Calculate how many entries to remove
    const toRemove = entries.length - config.maxSize;
    const fieldsToRemove = entries.slice(0, toRemove).map(entry => entry[0]);
    
    if (fieldsToRemove.length > 0) {
      await RedisClient.withConnection(url, async (client) => {
        // Remove fields from the hash
        if (fieldsToRemove.length > 0) {
          await client.hDel(EMBEDDINGS_HASH_KEY, fieldsToRemove);
        }
        
        // Update metadata by removing the entries
        fieldsToRemove.forEach(field => {
          delete metadata.entries[field];
        });
        
        await updateCacheMetadata(metadata);
        return true;
      });
    }
    
    return { removed: fieldsToRemove.length };
  } catch (error) {
    console.error("[Cache] Error enforcing cache size limit:", error);
    return { removed: 0 };
  }
}

export async function GET() {
  try {
    const url = getRedisUrl();
    if (!url) {
      return NextResponse.json(
        { error: "No Redis connection available" },
        { status: 401 }
      );
    }

    const config = await getCacheConfig();
    const size = await getCacheSize();
    
    return NextResponse.json({
      success: true,
      config,
      size,
    });
  } catch (error) {
    console.error("[Cache] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const url = getRedisUrl();
    if (!url) {
      return NextResponse.json(
        { error: "No Redis connection available" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, params } = body;
    
    if (!action) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    
    switch (action) {
      case "getConfig":
        const config = await getCacheConfig();
        return NextResponse.json({ success: true, config });
        
      case "setConfig":
        if (!params || typeof params !== "object") {
          return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
        }
        
        const currentConfig = await getCacheConfig();
        const newConfig = await setCacheConfig(params);
        
        // If the max size was reduced, enforce the new limit
        if (params.maxSize && params.maxSize < currentConfig.maxSize) {
          await enforceCacheSizeLimit();
        }
        
        return NextResponse.json({ success: true, config: newConfig });
        
      case "getSize":
        const size = await getCacheSize();
        return NextResponse.json({ success: true, size });
        
      case "clear":
        const result = await clearCache();
        return NextResponse.json({ success: true, ...result });
        
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Cache] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 