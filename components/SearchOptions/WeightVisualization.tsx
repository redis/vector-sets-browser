import { VectorInput, colorClasses, colorMap } from "./MultiVectorInputUtils"

interface WeightVisualizationProps {
    inputs: VectorInput[]
}

export default function WeightVisualization({ inputs }: WeightVisualizationProps) {
    // Only display visualization for inputs with data
    const nonEmptyInputs = inputs.filter((input) => !!input.vector.trim())

    if (nonEmptyInputs.length <= 1) return null

    // Separate positive and negative weights
    const positiveInputs = nonEmptyInputs.filter((input) => input.weight > 0)
    const negativeInputs = nonEmptyInputs.filter((input) => input.weight < 0)

    // Calculate total absolute weight to determine proportions
    const totalPositiveWeight = positiveInputs.reduce(
        (sum, input) => sum + input.weight,
        0
    )
    const totalNegativeWeight = negativeInputs.reduce(
        (sum, input) => sum + Math.abs(input.weight),
        0
    )

    return (
        <div className="mb-2 mt-1">
            <div className="text-xs text-gray-500 mb-1">
                Weight Distribution:
            </div>

            {/* Positive weights visualization */}
            {positiveInputs.length > 0 && (
                <div className="flex h-4 w-full rounded-full overflow-hidden mb-1">
                    {positiveInputs.map((input, index) => {
                        // Calculate width percentage based on weight proportion
                        const widthPercent =
                            (input.weight / totalPositiveWeight) * 100

                        // Generate a color based on index
                        const colorClass =
                            colorClasses[index % colorClasses.length]

                        return (
                            <div
                                key={input.id}
                                className={`${colorClass} relative group`}
                                style={{ width: `${widthPercent}%` }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1 py-0.5 transition-opacity">
                                    Vector {nonEmptyInputs.indexOf(input) + 1}:
                                    +{widthPercent.toFixed(1)}%
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Negative weights visualization */}
            {negativeInputs.length > 0 && (
                <div className="flex h-4 w-full rounded-full overflow-hidden">
                    {negativeInputs.map((input, index) => {
                        // Calculate width percentage based on weight proportion
                        const widthPercent =
                            (Math.abs(input.weight) / totalNegativeWeight) * 100

                        // Get color and create striped pattern for negatives
                        const colorIndex =
                            (positiveInputs.length + index) %
                            colorClasses.length
                        const colorClass = colorClasses[colorIndex]
                        const stripeColors = colorMap[colorClass] || {
                            light: "#60a5fa",
                            dark: "#3b82f6",
                        }

                        return (
                            <div
                                key={input.id}
                                className="relative group"
                                style={{
                                    width: `${widthPercent}%`,
                                    background: `repeating-linear-gradient(45deg, ${stripeColors.light}, ${stripeColors.light} 8px, ${stripeColors.dark} 8px, ${stripeColors.dark} 16px)`,
                                }}
                            >
                                <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1 py-0.5 transition-opacity">
                                    Vector {nonEmptyInputs.indexOf(input) + 1}:
                                    -{widthPercent.toFixed(1)}%
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <div className="text-xs text-gray-400 mt-1">
                {nonEmptyInputs.length > 1
                    ? `Combined from ${
                          nonEmptyInputs.length
                      } vectors with weights [${nonEmptyInputs
                          .map((i) => i.weight)
                          .join(", ")}]`
                    : "Enter multiple vectors to see weight distribution"}
            </div>
        </div>
    )
} 