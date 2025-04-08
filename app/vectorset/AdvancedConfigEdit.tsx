import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useState } from "react"

interface AdvancedConfigEditProps {
    redisConfig: VectorSetMetadata
}

export default function AdvancedConfigEdit({
    redisConfig,
}: AdvancedConfigEditProps) {
    // Initialize state with the current redisConfig values
    const [config, setConfig] = useState({
        quantization: redisConfig.redisConfig?.quantization || "NOQUANT",
        reduceDimensions:
            redisConfig.redisConfig?.reduceDimensions?.toString() || "",
        defaultCAS: redisConfig.redisConfig?.defaultCAS || false,
        buildExplorationFactor:
            redisConfig.redisConfig?.buildExplorationFactor?.toString() || "",
    })

    // Update the parent's redisConfig when any value changes
    const handleChange = (key: string, value: string | boolean) => {
        const newConfig = { ...config, [key]: value }
        setConfig(newConfig)

        // Update the parent's redisConfig
        const updatedRedisConfig = { ...redisConfig }
        if (!updatedRedisConfig.redisConfig) {
            updatedRedisConfig.redisConfig = {}
        }

        // Handle each field type appropriately
        if (key === "quantization") {
            if (value === "NOQUANT") {
                delete updatedRedisConfig.redisConfig.quantization
            } else {
                updatedRedisConfig.redisConfig.quantization = value as
                    | "Q8"
                    | "BIN"
            }
        } else if (key === "reduceDimensions") {
            const numValue = typeof value === "string" ? parseInt(value) : null
            if (value === "" || numValue === null) {
                delete updatedRedisConfig.redisConfig.reduceDimensions
            } else {
                updatedRedisConfig.redisConfig.reduceDimensions = numValue
            }
        } else if (key === "defaultCAS") {
            if (!value) {
                delete updatedRedisConfig.redisConfig.defaultCAS
            } else {
                updatedRedisConfig.redisConfig.defaultCAS = value as boolean
            }
        } else if (key === "buildExplorationFactor") {
            const numValue = typeof value === "string" ? parseInt(value) : null
            if (value === "" || numValue === null) {
                delete updatedRedisConfig.redisConfig.buildExplorationFactor
            } else {
                updatedRedisConfig.redisConfig.buildExplorationFactor = numValue
            }
        }

        // If redisConfig is empty, remove it
        if (Object.keys(updatedRedisConfig.redisConfig).length === 0) {
            delete updatedRedisConfig.redisConfig
        }

        // Update the reference directly
        Object.assign(redisConfig, updatedRedisConfig)
    }

    return (
        <div className="w-full h-full">
            <div className="mb-6">
                <p className="text-gray-600 text-sm mb-4">
                    Customize how vectors are indexed and retrieved. Achieve the
                    best balance of performance, precision and storage size.
                </p>
            </div>

            <div className="form-body space-y-6">
                {/* Runtime configurable options */}
                <div className="space-y-2">
                    <div className="w-full flex items-center">
                        <h4 className="text-sm font-semibold grow">
                            Runtime Options
                        </h4>
                        <div className="text-gray-500 text-xs">
                            (You can change these settings later.)
                        </div>
                    </div>
                    <div className="form-section border-none">
                        <div className="border-none">
                            <div className="flex w-full space-x-2 items-center">
                                <label
                                    htmlFor="default-cas-input"
                                    className="flex-grow flex items-center cursor-pointer"
                                >
                                    <div>
                                        <span className="text-sm font-medium block">
                                            High performance multi-threading
                                        </span>
                                        <p className="text-xs text-gray-500">
                                            This controls the CAS option used
                                            with VADD command. When set, the CAS
                                            option will be used for all VADD
                                            calls
                                            <a
                                                href="/docs#cas-option"
                                                className="text-xs pl-2 whitespace-nowrap text-blue-500 hover:underline"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                Learn more
                                            </a>
                                        </p>
                                    </div>
                                </label>
                                <div className="w-auto">
                                    <Switch
                                        id="default-cas-input"
                                        checked={config.defaultCAS}
                                        onCheckedChange={(checked) =>
                                            handleChange("defaultCAS", checked)
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section border-none">
                        <div className="border-none">
                            <div className="flex w-full space-x-2 items-center">
                                <div>
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor="exploration-factor-input"
                                    >
                                        Build Exploration Factor
                                    </label>
                                    <p className="text-xs text-gray-500">
                                        Controls the EF option used with VSIM
                                        command. When set, the EF option will be
                                        used for all VSIM calls
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Higher values improve recall, but
                                        increase search time (default is 200,
                                        values between 100 and 1000)
                                        <a
                                            href="/docs#exploration-factor"
                                            className="pl-2 whitespace-nowrap text-xs text-blue-500 hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Learn more
                                        </a>
                                    </p>
                                </div>
                                <div className="grow"></div>
                                <Input
                                    id="exploration-factor-input"
                                    type="number"
                                    placeholder="200"
                                    className="text-right border-none w-48"
                                    value={config.buildExplorationFactor}
                                    onChange={(e) =>
                                        handleChange(
                                            "buildExplorationFactor",
                                            e.target.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Immutable options */}
                <div className="space-y-2 pt-4">
                    <div className="w-full flex items-center">
                        <h4 className="text-sm grow font-semibold">
                            Vector Options
                        </h4>
                        <div className="text-xs text-gray-500">
                            (Cannot be changed after the first vector is added)
                        </div>
                    </div>
                    <div className="form-section border-none">
                        <div className="border-none">
                            <div className="flex w-full space-x-2 items-center">
                                <div>
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor="quantization-input"
                                    >
                                        Vector Quantization
                                    </label>
                                    <p className="text-xs text-gray-500">
                                        Reduce storage size at the expense of
                                        precision
                                        <a
                                            href="/docs#vector-quantization"
                                            className="pl-2 whitespace-nowrap text-xs text-blue-500 hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Learn more
                                        </a>
                                    </p>
                                </div>
                                <div className="grow"></div>
                                <Select
                                    value={config.quantization}
                                    onValueChange={(value) =>
                                        handleChange("quantization", value)
                                    }
                                >
                                    <SelectTrigger
                                        id="quantization-input"
                                        className="w-48 text-right border-none"
                                    >
                                        <SelectValue placeholder="Select quantization" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NOQUANT">
                                            None (full precision)
                                        </SelectItem>
                                        <SelectItem value="Q8">
                                            8-bit quantization
                                        </SelectItem>
                                        <SelectItem value="BIN">
                                            Binary quantization
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="form-section border-none">
                        <div className="border-none">
                            <div className="flex w-full space-x-2 items-center">
                                <div>
                                    <label
                                        className="text-sm font-medium"
                                        htmlFor="reduce-dimensions-input"
                                    >
                                        Dimension Reduction
                                    </label>
                                    <p className="text-xs text-gray-500">
                                        Reduce dimensions for faster search,
                                        lower precision
                                        <a
                                            href="/docs#dimension-reduction"
                                            className="text-xs whitespace-nowrap pl-2 text-blue-500 hover:underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Learn more
                                        </a>
                                    </p>
                                </div>
                                <div className="grow"></div>
                                <Input
                                    id="reduce-dimensions-input"
                                    type="number"
                                    placeholder="Enter dimensions"
                                    className="text-right border-none w-48"
                                    value={config.reduceDimensions}
                                    onChange={(e) =>
                                        handleChange(
                                            "reduceDimensions",
                                            e.target.value
                                        )
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
