import { ArrowLeft } from "lucide-react"
import { UseFormReturn } from "react-hook-form"
import { z } from "zod"
import { FormField, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

// Define the schema type or import it
export const vectorSetSchema = z.object({
    name: z
        .string()
        .min(1, "Please enter a name for the vector set")
        .refine(
            (name) => !/\s/.test(name),
            "Vector name cannot contain spaces"
        ),
    dimensions: z.coerce.number(),
    customElement: z.string().optional(),
    customVector: z.string().optional(),
    quantization: z.enum(["Q8", "BIN", "NOQUANT"]).optional(),
    reduceDimensions: z.string().optional(),
    defaultCAS: z.boolean().optional(),
    buildExplorationFactor: z.string().optional(),
    loadSampleData: z.boolean().optional(),
    selectedDataset: z.string().optional(),
})

export type FormValues = z.infer<typeof vectorSetSchema>

interface AdvancedConfigurationPanelProps {
    form: UseFormReturn<FormValues>
    onBack: () => void
}

export default function AdvancedConfigurationPanel({
    form,
    onBack,
}: AdvancedConfigurationPanelProps) {
    return (
        <div className="w-full h-full">
            <div className="flex items-center mb-4 border-b pb-4">
                <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2"
                    onClick={onBack}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-xl font-semibold">
                    Advanced Configuration
                </h2>
            </div>

            <div className="mb-6">
                <h3 className="text-lg mb-2">Vector Index Options</h3>
                <p className="text-gray-600 text-sm mb-4">
                    Customize how vectors are indexed and retrieved
                </p>
            </div>

            <div className="form-body space-y-4">
                <div className="form-section border-none">
                    <FormField
                        control={form.control}
                        name="quantization"
                        render={({ field }) => (
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
                                            Reduce storage size at the expense
                                            of precision
                                        </p>
                                    </div>
                                    <div className="grow"></div>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value || "NOQUANT"}
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
                                <FormMessage />
                            </div>
                        )}
                    />
                </div>

                <div className="form-section border-none">
                    <FormField
                        control={form.control}
                        name="reduceDimensions"
                        render={({ field }) => (
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
                                            Reduce dimensions for faster search
                                        </p>
                                    </div>
                                    <div className="grow"></div>
                                    <Input
                                        id="reduce-dimensions-input"
                                        type="number"
                                        placeholder="Enter dimensions"
                                        className="text-right border-none w-48"
                                        {...field}
                                    />
                                </div>
                                <FormMessage />
                            </div>
                        )}
                    />
                </div>

                <div className="form-section border-none">
                    <FormField
                        control={form.control}
                        name="defaultCAS"
                        render={({ field }) => (
                            <div className="border-none">
                                <div className="flex w-full space-x-2 items-center">
                                    <label
                                        htmlFor="default-cas-input"
                                        className="flex-grow flex items-center cursor-pointer"
                                    >
                                        <div>
                                            <span className="text-sm font-medium block">
                                                Default CAS
                                            </span>
                                            <p className="text-xs text-gray-500">
                                                Use Content Addressable Storage
                                            </p>
                                        </div>
                                    </label>
                                    <div className="w-auto">
                                        <Switch
                                            id="default-cas-input"
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </div>
                                </div>
                                <FormMessage />
                            </div>
                        )}
                    />
                </div>

                <div className="form-section border-none">
                    <FormField
                        control={form.control}
                        name="buildExplorationFactor"
                        render={({ field }) => (
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
                                            Higher values improve recall, but increase search time
                                        </p>
                                    </div>
                                    <div className="grow"></div>
                                    <Input
                                        id="exploration-factor-input"
                                        type="number"
                                        placeholder="32"
                                        className="text-right border-none w-48"
                                        {...field}
                                    />
                                </div>
                                <FormMessage />
                            </div>
                        )}
                    />
                </div>
            </div>

            <div className="flex justify-end mt-6">
                <Button variant="default" onClick={onBack}>
                    Done
                </Button>
            </div>
        </div>
    )
}
