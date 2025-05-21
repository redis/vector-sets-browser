/**
 * Utility functions for vector math operations
 */

/**
 * Enum for vector combination methods
 */
export enum VectorCombinationMethod {
  LINEAR = "linear",
  POWER_WEIGHTED = "power-weighted",
  WEIGHTED_AVERAGE = "weighted-average",
  ORTHOGONALIZE = "orthogonalize",
  COMPONENT_MAX = "component-max",
}

/**
 * Adds two vectors together
 * @param vec1 First vector
 * @param vec2 Second vector (must be same dimension as vec1)
 * @returns Sum of the two vectors
 */
export function addVectors(vec1: number[], vec2: number[]): number[] {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }
  
  return vec1.map((val, i) => val + vec2[i]);
}

/**
 * Multiplies a vector by a scalar
 * @param vec Vector to multiply
 * @param scalar Scalar value
 * @returns Vector with each element multiplied by the scalar
 */
export function multiplyVectorByScalar(vec: number[], scalar: number): number[] {
  return vec.map(val => val * scalar);
}

/**
 * Calculates the dot product between two vectors
 * @param vec1 First vector
 * @param vec2 Second vector (must be same dimension as vec1)
 * @returns Dot product value
 */
export function dotProduct(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }
  
  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

/**
 * Calculates the cosine similarity between two vectors
 * @param vec1 First vector
 * @param vec2 Second vector (must be same dimension as vec1)
 * @returns Cosine similarity value between -1 and 1
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have the same dimension");
  }
  
  const dot = dotProduct(vec1, vec2);
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  
  if (mag1 === 0 || mag2 === 0) {
    return 0; // Avoid division by zero
  }
  
  return dot / (mag1 * mag2);
}

/**
 * Combines multiple vectors with weights using the specified method
 * @param vectors Array of vectors (all must have same dimension)
 * @param weights Array of weights corresponding to each vector
 * @param method The combination method to use
 * @param powerFactor Optional power factor for power-weighted method
 * @returns Combined vector
 */
export function combineVectorsWithMethod(
  vectors: number[][], 
  weights: number[], 
  method: VectorCombinationMethod,
  powerFactor: number = 2
): number[] {
  switch (method) {
    case VectorCombinationMethod.LINEAR:
      return combineVectors(vectors, weights);
    case VectorCombinationMethod.POWER_WEIGHTED:
      return powerWeightedCombine(vectors, weights, powerFactor);
    case VectorCombinationMethod.WEIGHTED_AVERAGE:
      return weightedAverage(vectors, weights);
    case VectorCombinationMethod.ORTHOGONALIZE:
      return orthogonalizeCombine(vectors, weights);
    case VectorCombinationMethod.COMPONENT_MAX:
      return componentWiseMax(vectors, weights);
    default:
      return combineVectors(vectors, weights);
  }
}

/**
 * Combines multiple vectors with weights
 * @param vectors Array of vectors (all must have same dimension)
 * @param weights Array of weights corresponding to each vector
 * @returns Combined weighted vector
 */
export function combineVectors(vectors: number[][], weights: number[]): number[] {
  if (vectors.length === 0) {
    return [];
  }
  
  // Handle single vector case - just return it
  if (vectors.length === 1) {
    // If weight is not 1, apply it
    if (weights[0] !== 1) {
      return multiplyVectorByScalar(vectors[0], weights[0]);
    }
    return [...vectors[0]]; // Return a copy to avoid mutations
  }
  
  if (vectors.length !== weights.length) {
    throw new Error("Number of vectors must match number of weights");
  }
  
  // Filter out vectors with zero weights
  const filteredVectors: number[][] = [];
  const filteredWeights: number[] = [];
  
  for (let i = 0; i < vectors.length; i++) {
    if (weights[i] !== 0) {
      filteredVectors.push(vectors[i]);
      filteredWeights.push(weights[i]);
    }
  }
  
  // If all weights were zero, return the zero vector of the same dimension
  if (filteredVectors.length === 0) {
    return new Array(vectors[0].length).fill(0);
  }
  
  const dimension = filteredVectors[0].length;
  
  // Check that all vectors have the same dimension
  for (let i = 1; i < filteredVectors.length; i++) {
    if (filteredVectors[i].length !== dimension) {
      throw new Error(`Vector at index ${i} has different dimension (${filteredVectors[i].length}) than first vector (${dimension})`);
    }
  }
  
  // Initialize result vector with zeros
  const result = new Array(dimension).fill(0);
  
  // Apply weighted sum
  for (let i = 0; i < filteredVectors.length; i++) {
    for (let j = 0; j < dimension; j++) {
      result[j] += filteredVectors[i][j] * filteredWeights[i];
    }
  }
  
  return result;
}

/**
 * Combines vectors using power-weighted combination (weights raised to specified power)
 * @param vectors Array of vectors
 * @param weights Array of weights
 * @param power Power to raise weights to (default: 2)
 * @returns Power-weighted combination
 */
export function powerWeightedCombine(vectors: number[][], weights: number[], power: number = 2): number[] {
  // Raise each weight to the specified power
  const powerWeights = weights.map(w => Math.pow(Math.max(0, w), power));
  
  // Use the standard combination with power-adjusted weights
  return combineVectors(vectors, powerWeights);
}

/**
 * Combines vectors using weighted average (normalizes by sum of weights)
 * @param vectors Array of vectors
 * @param weights Array of weights
 * @returns Weighted average vector
 */
export function weightedAverage(vectors: number[][], weights: number[]): number[] {
  // Get standard combination
  const combined = combineVectors(vectors, weights);
  
  // Calculate sum of weights (excluding zeros)
  const weightSum = weights.reduce((sum, w) => sum + (w > 0 ? w : 0), 0);
  
  // If sum of weights is zero or very small, return the combined vector
  if (weightSum <= 1e-10) {
    return combined;
  }
  
  // Divide by sum of weights
  return combined.map(val => val / weightSum);
}

/**
 * Combines vectors by making each subsequent vector orthogonal to previous ones
 * @param vectors Array of vectors
 * @param weights Array of weights
 * @returns Combined vector with orthogonalization
 */
export function orthogonalizeCombine(vectors: number[][], weights: number[]): number[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return multiplyVectorByScalar(vectors[0], weights[0]);
  
  const dimension = vectors[0].length;
  const orthogonalVectors: number[][] = [vectors[0]]; // First vector stays the same
  
  // Generate orthogonal versions of subsequent vectors
  for (let i = 1; i < vectors.length; i++) {
    const currentVector = [...vectors[i]];
    
    // Project out components in the direction of previous vectors
    for (let j = 0; j < i; j++) {
      const prevVector = orthogonalVectors[j];
      const scalarProj = dotProduct(currentVector, prevVector) / dotProduct(prevVector, prevVector);
      
      // Subtract the projection
      for (let k = 0; k < dimension; k++) {
        currentVector[k] -= scalarProj * prevVector[k];
      }
    }
    
    // Only add if the vector isn't too close to zero
    const magnitude = Math.sqrt(dotProduct(currentVector, currentVector));
    if (magnitude > 1e-10) {
      orthogonalVectors.push(currentVector);
    }
  }
  
  // Apply weights and combine
  const result = new Array(dimension).fill(0);
  for (let i = 0; i < orthogonalVectors.length; i++) {
    const weight = i < weights.length ? weights[i] : 0;
    for (let j = 0; j < dimension; j++) {
      result[j] += orthogonalVectors[i][j] * weight;
    }
  }
  
  return result;
}

/**
 * Combines vectors by taking the component-wise maximum (scaled by weights)
 * @param vectors Array of vectors
 * @param weights Array of weights
 * @returns Vector with component-wise maximum
 */
export function componentWiseMax(vectors: number[][], weights: number[]): number[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return multiplyVectorByScalar(vectors[0], weights[0]);
  
  const dimension = vectors[0].length;
  
  // Initialize result with first weighted vector
  const result = multiplyVectorByScalar(vectors[0], weights[0]);
  
  // Compare with remaining weighted vectors
  for (let i = 1; i < vectors.length; i++) {
    const weightedVector = multiplyVectorByScalar(vectors[i], weights[i]);
    
    for (let j = 0; j < dimension; j++) {
      // Take the max value for each component
      result[j] = Math.max(result[j], weightedVector[j]);
    }
  }
  
  return result;
}

/**
 * Combines multiple vectors with weights and normalizes the result to unit length
 * @param vectors Array of vectors (all must have same dimension)
 * @param weights Array of weights corresponding to each vector
 * @param method The combination method to use
 * @returns Combined and normalized vector
 */
export function combineAndNormalizeVectors(
  vectors: number[][], 
  weights: number[],
  method: VectorCombinationMethod = VectorCombinationMethod.LINEAR
): number[] {
  // First combine the vectors using the specified method
  const combined = combineVectorsWithMethod(vectors, weights, method);
  
  // Then normalize to unit length
  return normalizeVector(combined);
}

/**
 * Normalizes a vector to unit length
 * @param vec Vector to normalize
 * @returns Normalized vector
 */
export function normalizeVector(vec: number[]): number[] {
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  
  // Avoid division by zero
  if (magnitude === 0) {
    return [...vec];
  }
  
  return vec.map(val => val / magnitude);
}

/**
 * Parses a string representation of a vector into a number array
 * @param vectorStr String representation of vector (e.g., "0.1, 0.2, 0.3")
 * @returns Parsed vector as number array
 */
export function parseVectorString(vectorStr: string): number[] {
  if (!vectorStr) return [];

  return vectorStr
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseFloat(s))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Formats a vector to a string with specified precision
 * @param vec Vector to format
 * @param precision Number of decimal places (default: 6)
 * @returns Formatted string representation
 */
export function formatVector(vec: number[], precision: number = 6): string {
  return vec.map(v => v.toFixed(precision)).join(", ");
} 