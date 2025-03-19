import { useState, useCallback } from "react"
import { userSettings } from "@/app/utils/userSettings"

export function useVisualizationState() {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(true)
    const [showLines, setShowLines] = useState<boolean>(false)
    const [isCardPinned, setIsCardPinned] = useState<boolean>(false)

    const loadColorScheme = useCallback(async () => {
        try {
            const storedScheme = userSettings.get("colorScheme")
            if (storedScheme === "light" || storedScheme === "dark") {
                setIsDarkMode(storedScheme === "dark")
            }
        } catch (error) {
            console.error("Error loading color scheme:", error)
        }
    }, [])

    const saveColorScheme = useCallback(async () => {
        try {
            userSettings.set("colorScheme", isDarkMode ? "dark" : "light")
        } catch (error) {
            console.error("Error saving color scheme:", error)
        }
    }, [isDarkMode])

    const loadLineVisibility = useCallback(async () => {
        try {
            const storedVisibility = userSettings.get("showLines")
            if (typeof storedVisibility === "boolean") {
                setShowLines(storedVisibility)
            }
        } catch (error) {
            console.error("Error loading line visibility:", error)
        }
    }, [])

    const saveLineVisibility = useCallback(async () => {
        try {
            userSettings.set("showLines", showLines)
        } catch (error) {
            console.error("Error saving line visibility:", error)
        }
    }, [showLines])

    const loadCardPinState = useCallback(async () => {
        try {
            const storedPinState = userSettings.get("isCardPinned")
            if (typeof storedPinState === "boolean") {
                setIsCardPinned(storedPinState)
            }
        } catch (error) {
            console.error("Error loading card pin state:", error)
        }
    }, [])

    const saveCardPinState = useCallback(async () => {
        try {
            userSettings.set("isCardPinned", isCardPinned)
        } catch (error) {
            console.error("Error saving card pin state:", error)
        }
    }, [isCardPinned])

    const toggleDarkMode = useCallback(() => {
        setIsDarkMode((prev) => !prev)
    }, [])

    const toggleLineVisibility = useCallback(() => {
        setShowLines((prev) => !prev)
    }, [])

    const toggleCardPin = useCallback(() => {
        setIsCardPinned((prev) => !prev)
    }, [])

    return {
        isDarkMode,
        showLines,
        isCardPinned,
        loadColorScheme,
        saveColorScheme,
        loadLineVisibility,
        saveLineVisibility,
        loadCardPinState,
        saveCardPinState,
        toggleDarkMode,
        toggleLineVisibility,
        toggleCardPin,
    }
} 