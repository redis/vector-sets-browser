import { useState, useCallback } from "react"
import { animate } from "framer-motion"

export function useVectorCount() {
    const [count, setCount] = useState<number>(0)

    const updateCount = useCallback(
        (newCount: number) => {
            // Animate from current count to new count
            animate(count, newCount, {
                duration: 1,
                onUpdate: (value) => setCount(Math.floor(value)),
            })
        },
        [count]
    )

    return { count, updateCount }
}
