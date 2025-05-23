export interface UserSettingsResponse<T = any> {
    value: T
}

// Configuration constants
export const WITHATTRIBS_SETTING_KEY = 'vsim-use-withattribs'

export const userSettings = {
    get<T = any>(key: string): T | null {
        try {
            if (typeof window === "undefined") {
                return null
            }
            const value = localStorage.getItem(`user-settings:${key}`)
            if (!value) {
                return null
            }
            return JSON.parse(value) as T
        } catch (error) {
            console.error("Error getting setting:", error)
            throw error
        }
    },

    set<T = any>(key: string, value: T): void {
        try {
            if (typeof window === "undefined") {
                return
            }
            localStorage.setItem(`user-settings:${key}`, JSON.stringify(value))
        } catch (error) {
            console.error("Error setting value:", error)
            throw error
        }
    },

    delete(key: string): void {
        try {
            if (typeof window === "undefined") {
                return
            }
            localStorage.removeItem(`user-settings:${key}`)
        } catch (error) {
            console.error("Error deleting setting:", error)
            throw error
        }
    },

    // Helper function to get WITHATTRIBS setting with default
    getUseWithAttribs(): boolean {
        return this.get<boolean>(WITHATTRIBS_SETTING_KEY) ?? true // Default to true to use the new feature
    },

    // Helper function to set WITHATTRIBS setting
    setUseWithAttribs(value: boolean): void {
        this.set(WITHATTRIBS_SETTING_KEY, value)
    },
}
