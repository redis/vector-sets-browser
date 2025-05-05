import { useEffect, useState } from "react"
import { VectorTuple, vgetattr_multi } from "@/lib/redis-server/api"

export default function useFilterAttributes(
    results: VectorTuple[],
    filterValue: string,
    vectorSetName?: string
) {
    const [availableAttributes, setAvailableAttributes] = useState<string[]>([])
    const [isLoadingAttributes, setIsLoadingAttributes] = useState(false)

    // Extract available attributes from search results
    useEffect(() => {
        const fetchAttributes = async () => {
            if (!results || results.length === 0 || !vectorSetName) {
                return
            }

            setIsLoadingAttributes(true)
            const attributes = new Set<string>()

            try {
                // Extract elements from results
                const elements = results.map((result) => result[0])

                // Fetch attributes using vgetattr_multi
                const response = await vgetattr_multi({
                    keyName: vectorSetName,
                    elements,
                    returnCommandOnly: false,
                })
                if (!response || !response.success) {
                    return
                }
                const attributesResults = response.result

                if (attributesResults && attributesResults.length > 0) {
                    // Process each attribute JSON string
                    attributesResults.forEach((attributeJson) => {
                        if (attributeJson) {
                            try {
                                const attributeObj = JSON.parse(attributeJson)

                                if (
                                    attributeObj &&
                                    typeof attributeObj === "object"
                                ) {
                                    Object.keys(attributeObj).forEach((key) => {
                                        attributes.add(key)
                                    })
                                }
                            } catch (error) {
                                console.error(
                                    "Error parsing attribute JSON:",
                                    error
                                )
                            }
                        }
                    })
                }
            } catch (error) {
                console.error("Error fetching attributes:", error)
                // Fallback: try to extract from the results directly
                extractAttributesFromResults(results, attributes)
            }

            // Add manually discovered attributes from filter input
            const filterMatches =
                filterValue.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)/g) || []
            filterMatches.forEach((match) => {
                const attr = match.substring(1) // Remove the leading dot
                attributes.add(attr)
            })

            const attributesArray = Array.from(attributes)
            setAvailableAttributes(attributesArray)
            setIsLoadingAttributes(false)
        }

        fetchAttributes()
    }, [results, filterValue, vectorSetName])

    return { availableAttributes, isLoadingAttributes }
}

// Helper function to extract attributes from results directly (fallback)
function extractAttributesFromResults(
    results: VectorTuple[],
    attributes: Set<string>
) {
    results.forEach((result) => {
        // VectorTuple format: [element, score, vector?, attributes?]
        // The attributes are in the 4th position (index 3)
        if (result && result.length >= 4) {
            const attributesData = result[3]

            if (typeof attributesData === "string") {
                try {
                    const attributesObj = JSON.parse(attributesData)

                    if (
                        attributesObj &&
                        typeof attributesObj === "object"
                    ) {
                        Object.keys(attributesObj).forEach((key) => {
                            attributes.add(key)
                        })
                    }
                } catch (error) {
                    console.error("Error parsing attributes string:", error)

                    // If JSON parsing fails, try to extract attributes using regex
                    try {
                        const attrRegex = /['"]([\w\d_]+)['"]:\s*([^,}]+)/g
                        let match

                        while (
                            (match = attrRegex.exec(attributesData)) !==
                            null
                        ) {
                            const [_, key] = match
                            attributes.add(key)
                        }
                    } catch (regexError) {
                        console.error(
                            "Regex extraction failed:",
                            regexError
                        )
                    }
                }
            } else if (
                typeof attributesData === "object" &&
                attributesData !== null
            ) {
                if (attributesData && typeof attributesData === "object") {
                    Object.keys(attributesData).forEach((key) => {
                        attributes.add(key)
                    })
                }
            }
        }
    })
} 