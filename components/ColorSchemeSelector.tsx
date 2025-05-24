import { ColorScheme } from "@/hooks/useVectorSettings"

interface ColorSchemeSelectorProps {
    value: ColorScheme
    onChange: (scheme: ColorScheme) => void
    className?: string
    showPreview?: boolean
}

export default function ColorSchemeSelector({ 
    value, 
    onChange, 
    className = "",
    showPreview = false 
}: ColorSchemeSelectorProps) {
    const colorSchemes = [
        { 
            value: 'thermal' as const, 
            label: 'Thermal', 
            description: 'Black → Purple → Red → Yellow → White',
            gradient: 'linear-gradient(to right, #000000, #400080, #ff0000, #ffa500, #ffff00, #ffffff)'
        },
        { 
            value: 'viridis' as const, 
            label: 'Viridis', 
            description: 'Purple → Blue → Green → Yellow',
            gradient: 'linear-gradient(to right, #440154, #440080, #31688e, #35b779, #fde725)'
        },
        { 
            value: 'classic' as const, 
            label: 'Classic', 
            description: 'Blue → White → Red',
            gradient: 'linear-gradient(to right, #6495ed, #ffffff, #dc1426)'
        }
    ]

    if (showPreview) {
        return (
            <div className={`space-y-2 ${className}`}>
                <label className="block text-sm font-medium">Color Scheme:</label>
                <div className="space-y-2">
                    {colorSchemes.map((scheme) => (
                        <button
                            key={scheme.value}
                            onClick={() => onChange(scheme.value as ColorScheme)}
                            className={`w-full text-left p-2 border rounded-lg transition-all ${
                                value === scheme.value 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            <div className="flex items-center space-x-3">
                                <div 
                                    className="w-12 h-6 rounded border"
                                    style={{ background: scheme.gradient }}
                                />
                                <div>
                                    <div className="font-medium">{scheme.label}</div>
                                    <div className="text-xs text-gray-600">{scheme.description}</div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            <label className="block text-sm font-medium mb-1">Color Scheme:</label>
            <select 
                value={value} 
                onChange={(e) => onChange(e.target.value as ColorScheme)}
                className="border rounded px-2 py-1 w-full"
            >
                {colorSchemes.map((scheme) => (
                    <option key={scheme.value} value={scheme.value}>
                        {scheme.label} ({scheme.description})
                    </option>
                ))}
            </select>
        </div>
    )
} 