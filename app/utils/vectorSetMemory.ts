// HNSW parameters (kept constant as in C version)
const P = 0.25;
const M = 16;
const M0 = 32;
const MAX_THREADS = 128;
const MAX_LEVELS = 16;

enum QuantizationType {
    FP32 = 0,  // 4 bytes/dim, NOQUANT
    Q8 = 1,    // 1 byte/dim + small overhead (Default)
    BIN = 2,   // 1 bit/dim
}

function estimateHNSWMemoryUsagePerNode(storeDim: number, quantType: QuantizationType): number {
    // 1) Node struct base overhead
    const nodeStructOverhead = (
        4 * MAX_THREADS +  // visited_epoch array
        4 +               // uid
        4 +               // level
        4 * MAX_LEVELS +  // num_neighbors array
        8 * MAX_LEVELS    // neighbors pointer array
    );

    // 2) Average number of levels and pointers
    const avgLevels = 1.0 + (P / (1.0 - P));
    const effectiveUpperLayers = Math.max(avgLevels - 1.0, 0.0);
    const avgPointers = M0 + effectiveUpperLayers * M;
    const pointerBytes = avgPointers * 8.0;

    // 3) Vector storage based on quantization
    let vectorBytes = 0.0;
    switch (quantType) {
        case QuantizationType.FP32:
            vectorBytes = 4.0 * storeDim;
            break;
        case QuantizationType.Q8:
            vectorBytes = storeDim + 8.0;  // 1 byte per dim + 8 bytes for range
            break;
        case QuantizationType.BIN:
            vectorBytes = Math.ceil(storeDim / 8.0);
            break;
        default:
            vectorBytes = 4.0 * storeDim;
    }

    return Math.floor(nodeStructOverhead + pointerBytes + vectorBytes + 0.5);
}

export function estimateVectorSetMemoryUsage(
    vectorCount: number,
    originalDim: number,
    storeDim: number = originalDim,
    quantType: QuantizationType = QuantizationType.Q8,
    useProjection: boolean = false
): number {
    // 1) Per-node usage
    const perNode = estimateHNSWMemoryUsagePerNode(storeDim, quantType);
    
    // 2) Total for all N nodes
    let total = perNode * vectorCount;

    // 3) If we keep the projection matrix in memory, add it
    if (useProjection && storeDim < originalDim) {
        const matrixBytes = originalDim * storeDim * 4;
        total += matrixBytes;
    }

    return total;
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${sizes[i]}`;
} 