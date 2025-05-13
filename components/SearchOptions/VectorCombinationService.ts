import { VectorSetMetadata } from "@/lib/types/vectors"
import {
    combineAndNormalizeVectors,
    combineVectorsWithMethod,
    formatVector,
    parseVectorString,
    VectorCombinationMethod,
} from "@/lib/vector/vectorUtils"
import { clientEmbeddingService } from "@/lib/embeddings/client/embeddingService"
import { VectorInput } from "./MultiVectorInputUtils"

/**
 * Service to handle vector combination operations
 */
export class VectorCombinationService {
    /**
     * Combines vectors from input fields with specified weights and method
     */
    static async combineVectors(
        vectorInputs: VectorInput[],
        metadata: VectorSetMetadata | null,
        normalizeVector: boolean,
        combinationMethod: VectorCombinationMethod
    ): Promise<number[] | null> {
        const parsedVectors: number[][] = []
        const weights: number[] = []

        console.log("=============================================")
        console.log("VECTOR COMBINATION DETAILS:")
        console.log("=============================================")
        console.log(`Combination Method: ${combinationMethod}`)
        console.log(`Normalize: ${normalizeVector}`)
        console.log("Input vectors:")

        // Process each input
        for (const input of vectorInputs) {
            // Skip empty inputs
            if (!input.vector.trim()) {
                console.log(`- Vector ${input.id}: EMPTY (skipping)`)
                continue
            }

            try {
                // Check if the input is a comma-separated vector or text
                const potentialVector = parseVectorString(input.vector)

                // If it parsed as a valid vector with more than a few elements and no NaN values
                if (
                    potentialVector.length > 5 &&
                    !potentialVector.some(isNaN)
                ) {
                    console.log(
                        `- Vector ${input.id}: [${potentialVector
                            .slice(0, 5)
                            .join(", ")}${
                            potentialVector.length > 5 ? "..." : ""
                        }] (${potentialVector.length} dims, weight: ${
                            input.weight
                        })`
                    )
                    parsedVectors.push(potentialVector)
                    weights.push(input.weight)
                }
                // Handle as text that needs embedding
                else if (
                    metadata?.embedding &&
                    metadata.embedding.provider !== "none"
                ) {
                    console.log(
                        `- Vector ${
                            input.id
                        }: Converting text to embedding: "${input.vector.substring(
                            0,
                            30
                        )}${input.vector.length > 30 ? "..." : ""}"`
                    )

                    try {
                        // Generate embedding for the text
                        const embedding =
                            await clientEmbeddingService.getEmbedding(
                                input.vector,
                                metadata.embedding,
                                false // not an image
                            )

                        console.log(
                            `  ✓ Generated embedding with ${embedding.length} dimensions`
                        )
                        parsedVectors.push(embedding)
                        weights.push(input.weight)
                    } catch (err) {
                        console.error(
                            `  ✗ Failed to generate embedding for text: ${err}`
                        )
                    }
                } else {
                    console.log(
                        `- Vector ${input.id}: INVALID (not a vector and no embedding model available)`
                    )
                }
            } catch (err) {
                console.error(`Error processing vector ${input.id}: ${err}`)
            }
        }

        // If we have at least one valid vector
        if (parsedVectors.length > 0) {
            try {
                // If there's only one vector, just pass it through directly
                // without applying weights - helps with single vector use cases
                let result: number[]

                if (parsedVectors.length === 1) {
                    result = parsedVectors[0]
                    console.log(
                        "USING SINGLE VECTOR: Single vector mode, passing through without weight modification"
                    )
                } else {
                    // Multiple vectors - combine them with specified method and weights
                    if (normalizeVector) {
                        // Use normalize version with the selected method
                        result = combineAndNormalizeVectors(
                            parsedVectors,
                            weights,
                            combinationMethod
                        )
                        console.log(
                            `COMBINED AND NORMALIZED ${parsedVectors.length} VECTORS with method ${combinationMethod}`
                        )
                    } else {
                        // Use selected combination method without normalization
                        result = combineVectorsWithMethod(
                            parsedVectors,
                            weights,
                            combinationMethod
                        )
                        console.log(
                            `COMBINED ${parsedVectors.length} VECTORS with method ${combinationMethod}`
                        )
                    }
                }

                console.log("RESULT VECTOR:")
                console.log(
                    `[${result.slice(0, 10).join(", ")}${
                        result.length > 10 ? "..." : ""
                    }] (${result.length} dimensions)`
                )
                console.log("=============================================")

                return result
            } catch (error) {
                console.error("ERROR combining vectors:", error)
            }
        } else {
            console.log("NO VALID VECTORS TO COMBINE")
            console.log("=============================================")
        }

        return null
    }

    /**
     * Generates an embedding from input text
     */
    static async generateEmbedding(
        text: string, 
        metadata: VectorSetMetadata | null
    ): Promise<number[] | null> {
        if (!metadata?.embedding || metadata.embedding.provider === "none") {
            return null
        }

        try {
            const embedding = await clientEmbeddingService.getEmbedding(
                text,
                metadata.embedding,
                false // not an image
            )
            
            return embedding
        } catch (error) {
            console.error("Error generating embedding:", error)
            return null
        }
    }

    /**
     * Formats a vector as a string for display
     */
    static formatVector(vector: number[]): string {
        return formatVector(vector)
    }
} 