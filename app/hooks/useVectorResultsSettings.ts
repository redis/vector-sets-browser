import { useState, useCallback, useEffect } from "react"
import { userSettings } from "@/app/api/userSettings"

export function useVectorResultsSettings() {
    const [showAttributes, setShowAttributes] = useState<boolean>(true)
    const [showOnlyFilteredAttributes, setShowOnlyFilteredAttributes] = useState<boolean>(true)

    const loadSettings = useCallback(async () => {
        try {
            const storedShowAttributes = await userSettings.get("vectorResults.showAttributes")
            if (typeof storedShowAttributes === "boolean") {
                setShowAttributes(storedShowAttributes)
            }

            const storedShowOnlyFiltered = await userSettings.get("vectorResults.showOnlyFilteredAttributes")
            if (typeof storedShowOnlyFiltered === "boolean") {
                setShowOnlyFilteredAttributes(storedShowOnlyFiltered)
            }
        } catch (error) {
            console.error("Error loading vector results settings:", error)
        }
    }, [])

    const saveShowAttributes = useCallback(async () => {
        try {
            await userSettings.set("vectorResults.showAttributes", showAttributes)
        } catch (error) {
            console.error("Error saving show attributes setting:", error)
        }
    }, [showAttributes])

    const saveShowOnlyFiltered = useCallback(async () => {
        try {
            await userSettings.set("vectorResults.showOnlyFilteredAttributes", showOnlyFilteredAttributes)
        } catch (error) {
            console.error("Error saving show only filtered setting:", error)
        }
    }, [showOnlyFilteredAttributes])

    // Load settings on mount
    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    // Save settings when they change
    useEffect(() => {
        saveShowAttributes()
    }, [showAttributes, saveShowAttributes])

    useEffect(() => {
        saveShowOnlyFiltered()
    }, [showOnlyFilteredAttributes, saveShowOnlyFiltered])

    return {
        showAttributes,
        setShowAttributes,
        showOnlyFilteredAttributes,
        setShowOnlyFilteredAttributes
    }
} 