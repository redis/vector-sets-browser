import { EmbeddingConfig, VectorSetMetadata } from '../types/embedding';

// Base API response type
export interface ApiResponse<T = unknown> {
    success: boolean;
    result?: T;
    error?: string;
}

// Redis command request/response types
export interface VinfoRequest {
    keyName: string;
}

export interface VinfoResponse {
    dimension: number;
    count: number;
    type: string;
    memory_usage: number;
    [key: string]: string | number; // For other vinfo fields
}

export interface VdimRequest {
    keyName: string;
}

export interface VcardRequest {
    keyName: string;
}

export interface VremRequest {
    keyName: string;
    element: string;
}

export interface VembRequest {
    keyName: string;
    element: string;
}

export interface VaddRequest {
    keyName: string;
    element: string;
    vector: number[];
    attributes?: string;
}

export interface VlinkRequest {
    keyName: string;
    element: string;
    count?: number;
    withEmbeddings?: boolean;
}

export interface VsimRequest {
    keyName: string;
    searchVector?: number[];
    searchElement?: string;
    count: number;
    withEmbeddings?: boolean;
    filter?: string;
}

// Common response types
export type VectorTuple = [string, number, number[] | null, string]; // [element, score, vector?, attributes?]
export type VectorTupleLevel = VectorTuple[];
export type VectorTupleLevels = VectorTupleLevel[];

// Vector set management types
export type VectorSetMetadataResponse = VectorSetMetadata;

export interface MemoryUsageResponse {
    bytes: number;
}

// Vector set operations
export interface VectorSetOperationRequest {
    keyName: string;
    element: string;
}

export interface VectorSetCreateRequest {
    dimensions: number;
    metadata?: VectorSetMetadata;
    customData?: { element: string; vector: number[] };
}

export interface VectorSetListResponse {
    success: boolean;
    result: string[];
    error?: string;
}

// Embedding API types
export interface EmbeddingRequest {
    text?: string;
    imageData?: string;
    config: EmbeddingConfig;
}

export type EmbeddingResponse = number[];

export interface VsetAttrRequest {
    keyName: string;
    element: string;
    attributes: string;  // Changed to string since we'll pass raw JSON string
}

export interface VgetAttrRequest {
    keyName: string;
    element?: string;
    elements?: string[];
}
