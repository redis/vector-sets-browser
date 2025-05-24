import { useState, useEffect } from 'react'

export type ColorScheme = 'thermal' | 'viridis' | 'classic'
export type ScalingMode = 'relative' | 'absolute'

interface VectorSettings {
    colorScheme: ColorScheme
    scalingMode: ScalingMode
}

const DEFAULT_SETTINGS: VectorSettings = {
    colorScheme: 'thermal',
    scalingMode: 'relative'
}

const STORAGE_KEY = 'vector-visualization-settings'

export function useVectorSettings() {
    const [settings, setSettings] = useState<VectorSettings>(DEFAULT_SETTINGS)

    // Load settings from localStorage
    const loadSettings = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                setSettings({ ...DEFAULT_SETTINGS, ...parsed })
            }
        } catch (error) {
            console.warn('Failed to load vector settings from localStorage:', error)
        }
    }

    // Load settings on mount
    useEffect(() => {
        loadSettings()
    }, [])

    // Listen for storage changes from other components/tabs
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                loadSettings()
            }
        }

        // Listen for changes from other components in the same tab
        const handleCustomStorageChange = () => {
            loadSettings()
        }

        window.addEventListener('storage', handleStorageChange)
        window.addEventListener('vector-settings-changed', handleCustomStorageChange)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('vector-settings-changed', handleCustomStorageChange)
        }
    }, [])

    // Save settings to localStorage whenever they change
    const updateSettings = (newSettings: Partial<VectorSettings>) => {
        const updated = { ...settings, ...newSettings }
        setSettings(updated)
        
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
            // Dispatch custom event to notify other components in the same tab
            window.dispatchEvent(new Event('vector-settings-changed'))
        } catch (error) {
            console.warn('Failed to save vector settings to localStorage:', error)
        }
    }

    return {
        settings,
        updateSettings,
        setColorScheme: (colorScheme: ColorScheme) => updateSettings({ colorScheme }),
        setScalingMode: (scalingMode: ScalingMode) => updateSettings({ scalingMode })
    }
} 