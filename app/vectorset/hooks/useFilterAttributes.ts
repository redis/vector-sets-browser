import { useEffect, useState } from "react"
import { VectorTuple } from "@/lib/redis-server/api"

export default function useFilterAttributes(
    results: VectorTuple[],
    filterValue: string
) {
    const [availableAttributes, setAvailableAttributes] = useState<string[]>([])

    useEffect(() => {
        const attrs = new Set<string>()

        results.forEach((result) => {
            const attrStr = result[3]
            if (attrStr) {
                try {
                    const obj = JSON.parse(attrStr)
                    if (obj && typeof obj === "object") {
                        Object.keys(obj).forEach((k) => attrs.add(k))
                    }
                } catch {
                    // ignore parse errors
                }
            }
        })

        const matches = filterValue.match(/\.([a-zA-Z_][a-zA-Z0-9_]*)/g) || []
        matches.forEach((m) => attrs.add(m.substring(1)))

        setAvailableAttributes(Array.from(attrs))
    }, [results, filterValue])

    return { availableAttributes, isLoadingAttributes: false }
}
