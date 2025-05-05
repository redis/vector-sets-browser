import { useState, useCallback, useEffect } from "react"
import { userSettings } from "@/lib/storage/userSettings"

export function useVisualizationState() {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
        // Load the initial dark mode setting synchronously
        try {
            const storedScheme = userSettings.get("colorScheme")
            return storedScheme === "light" ? false : true // Default to dark mode if not found
        } catch (error) {
            console.error("Error loading initial color scheme:", error)
            return true // Default to dark mode if error
        }
    })
    const [showLines, setShowLines] = useState<boolean>(false)
    const [isCardPinned, setIsCardPinned] = useState<boolean>(false)

    // Load settings on component mount
    useEffect(() => {
        loadColorScheme()
        loadLineVisibility()
        loadCardPinState()
    }, [])

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

    const saveColorScheme = useCallback(() => {
        try {
            userSettings.set("colorScheme", isDarkMode ? "dark" : "light")
            console.log("Saved color scheme:", isDarkMode ? "dark" : "light")
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
        setIsDarkMode(prev => {
            const newValue = !prev
            // Immediately save the new value
            userSettings.set("colorScheme", newValue ? "dark" : "light")
            console.log("Toggled and saved dark mode:", newValue)
            return newValue
        })
    }, [])

    const toggleLineVisibility = useCallback(() => {
        setShowLines((prev) => !prev)
    }, [])

    const toggleCardPin = useCallback(() => {
        setIsCardPinned((prev) => !prev)
    }, [])

    const resetDarkMode = useCallback((defaultToDark = true) => {
        const newValue = defaultToDark;
        setIsDarkMode(newValue);
        userSettings.set("colorScheme", newValue ? "dark" : "light");
        console.log("Reset dark mode to:", newValue);
    }, []);

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
        resetDarkMode,
    }
} 