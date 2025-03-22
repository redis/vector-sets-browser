export const COLORS_REDIS_LIGHT = {
    NODE: {
        DEFAULT: 0x1a3b4c, // Default blue color for nodes
        SELECTED: 0xff4438, // Red color for selected nodes
        NEIGHBOR: 0xff918a, // Pink color for neighbor nodes
        HOVER_HIGHLIGHT: 0xd6ff18, // Red color for hover highlight effect
    },
    EDGE: {
        DEFAULT: 0x4a90e2, // Default blue color for edges
    },
    BACKGROUND: "#f5f5f5", // Light gray background color
} as const

export const COLORS_REDIS_DARK = {
    NODE: {
        DEFAULT: 0xffffff, // Default white color for nodes
        SELECTED: 0xd6ff18, // lime color for selected nodes
        NEIGHBOR: 0xe4ff6a, // lime color for neighbor nodes
        HOVER_HIGHLIGHT: 0xd6ff18, // Red color for hover highlight effect
    },
    EDGE: {
        DEFAULT: 0xf3ffbb, // Default blue color for edges
    },
    BACKGROUND: "#0d1e26", // Light gray background color
} as const

export type ColorScheme = typeof COLORS_REDIS_DARK | typeof COLORS_REDIS_LIGHT

// Maximum number of nodes to show labels for
export const MAX_LABELED_NODES = 50

// Force simulation constants
export const FORCE_SIMULATION_CONSTANTS = {
    REPULSION: 1.0,
    SPRING_LENGTH: 3.0,
    SPRING_COEFFICIENT: 0.1,
    TIMESTEP: 0.1,
    ITERATIONS_PER_FRAME: 10,
} as const 