import React, { useState, useEffect } from 'react';
import { VectorSetMetadata } from '../types/embedding';
import { formatBytes } from "@/app/utils/vectorSetMemory"
import { redisCommands } from '@/app/api/redis-commands';
import { vectorSets } from '@/app/api/vector-sets';
import { ApiError } from '@/app/api/client';
import { VinfoResponse } from '@/app/api/types';

interface VectorSetDetailsProps {
    vectorSetName: string | null;
}

export default function VectorSetDetails({ vectorSetName }: VectorSetDetailsProps) {
    const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
    const [metadata, setMetadata] = useState<VectorSetMetadata | null>(null);
    const [vectorInfo, setVectorInfo] = useState<VinfoResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMemoryUsage = async () => {
        if (!vectorSetName) return;
        
        try {
            const result = await vectorSets.getMemoryUsage(vectorSetName);
            setMemoryUsage(result.bytes);
        } catch (error) {
            console.error("Error fetching memory usage:", error);
            if (error instanceof ApiError) {
                setError(error.message);
            } else {
                setError("Failed to fetch memory usage");
            }
        }
    };

    const fetchMetadata = async () => {
        if (!vectorSetName) return;
        
        try {
            const result = await vectorSets.getMetadata(vectorSetName);
            setMetadata(result);
        } catch (error) {
            console.error("Error fetching metadata:", error);
            if (error instanceof ApiError) {
                setError(error.message);
            } else {
                setError("Failed to fetch metadata");
            }
        }
    };

    const fetchVectorInfo = async () => {
        if (!vectorSetName) return;
        
        try {
            const result = await redisCommands.vinfo(vectorSetName);
            setVectorInfo(result);
        } catch (error) {
            console.error("Error fetching vector info:", error);
            if (error instanceof ApiError) {
                setError(error.message);
            } else {
                setError("Failed to fetch vector info");
            }
        }
    };

    useEffect(() => {
        if (vectorSetName) {
            setLoading(true);
            setError(null);
            
            Promise.all([
                fetchMemoryUsage(),
                fetchMetadata(),
                fetchVectorInfo()
            ])
            .finally(() => {
                setLoading(false);
            });
        }
    }, [vectorSetName]);

    if (!vectorSetName) {
        return <div className="p-4">No vector set selected</div>;
    }

    if (loading) {
        return <div className="p-4">Loading vector set details...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-500">Error: {error}</div>;
    }

    return (
        <div className="p-4">
            <h2 className="text-xl font-bold mb-4">{vectorSetName}</h2>
            
            {memoryUsage !== null && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Memory Usage</h3>
                    <p>{formatBytes(memoryUsage)}</p>
                </div>
            )}
            
            {vectorInfo && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Vector Information</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(vectorInfo).map(([key, value]) => (
                            <div key={key} className="flex justify-between border-b pb-1">
                                <span className="font-medium">{key}:</span>
                                <span>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {metadata && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">Metadata</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(metadata).map(([key, value]) => (
                            <div key={key} className="flex justify-between border-b pb-1">
                                <span className="font-medium">{key}:</span>
                                <span>{typeof value === 'object' ? JSON.stringify(value) : value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
} 