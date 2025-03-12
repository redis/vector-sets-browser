"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { redisCommands } from "@/app/api/redis-commands"
import { Switch } from "@/components/ui/switch"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type AttributeType = "string" | "number" | "boolean"

interface Attribute {
    key: string
    type: AttributeType
    value: string | number | boolean
}

interface EditAttributesDialogProps {
    isOpen: boolean
    onClose: () => void
    keyName: string
    element: string
}

export default function EditAttributesDialog({
    isOpen,
    onClose,
    keyName,
    element,
}: EditAttributesDialogProps) {
    const [attributes, setAttributes] = useState<Attribute[]>([])
    const [error, setError] = useState<string | null>(null)
    const [newKey, setNewKey] = useState("")
    const [newType, setNewType] = useState<AttributeType>("string")
    const [newValue, setNewValue] = useState<string>("")
    const [originalAttributes, setOriginalAttributes] = useState<Attribute[]>(
        []
    )
    const [haveAttributesChanged, setHaveAttributesChanged] =
        useState<boolean>(false)
    const [rawJson, setRawJson] = useState<string>("")
    const [activeTab, setActiveTab] = useState<string>("edit-values")
    const [isRawJsonDirty, setIsRawJsonDirty] = useState(false)

    // Load existing attributes when dialog opens
    useEffect(() => {
        if (isOpen) {
            loadAttributes()
        } else {
            // Reset input fields when dialog closes
            setNewKey("")
            setNewType("string")
            setNewValue("")
            setError(null)
            setActiveTab("edit-values")
        }
    }, [isOpen, keyName, element])

    useEffect(() => {
        // compare whether attributes have changed

        setHaveAttributesChanged(attributes != originalAttributes)
    }, [attributes, originalAttributes, setHaveAttributesChanged])

    useEffect(() => {
        // Update raw JSON whenever attributes change, but only if we're not in the middle of editing it
        if (!isRawJsonDirty) {
            const attributesObject = attributes.reduce((acc, { key, value }) => {
                acc[key] = value
                return acc
            }, {} as Record<string, unknown>)
            setRawJson(JSON.stringify(attributesObject, null, 2))
        }
    }, [attributes, isRawJsonDirty])

    const loadAttributes = async () => {
        try {
            const response = await redisCommands.vgetattr(keyName, element)
            try {
                console.log("Attr: ", response)
                if (!response) {
                    console.log("No attributes ")
                    setAttributes([])
                    return
                }

                // Parse the JSON string from the API response
                const parsedAttributes = JSON.parse(response)
                // Convert the flat JSON object into our Attribute[] format
                console.log("Got attributes: response: ", response)
                const attributeArray = Object.entries(parsedAttributes).map(
                    ([key, value]) => {
                        // Ensure we handle all possible types correctly
                        let type: AttributeType = "string"
                        if (typeof value === "number") type = "number"
                        if (typeof value === "boolean") type = "boolean"

                        return {
                            key,
                            type,
                            value,
                        }
                    }
                ) as Attribute[] // Type assertion to fix the type error
                setAttributes(attributeArray)
                setOriginalAttributes(attributeArray)
            } catch (parseError) {
                console.error("Error parsing attributes:", parseError)
                setError("Invalid attribute data received")
                setAttributes([])
            }
        } catch (err) {
            console.error("Error loading attributes:", err)
            setError("Failed to load attributes")
            setAttributes([])
        }
    }

    const handleAddAttribute = () => {
        if (!newKey.trim()) {
            setError("Key cannot be empty")
            return
        }

        if (attributes.some((attr) => attr.key === newKey)) {
            setError("Key already exists")
            return
        }

        let parsedValue: string | number | boolean = newValue
        if (newType === "number") {
            parsedValue = Number(newValue)
            if (isNaN(parsedValue)) {
                setError("Invalid number value")
                return
            }
        } else if (newType === "boolean") {
            parsedValue = newValue.toLowerCase() === "true"
        }

        setAttributes([
            ...attributes,
            { key: newKey, type: newType, value: parsedValue },
        ])
        setNewKey("")
        setNewValue("")
        setError(null)
    }

    const handleRemoveAttribute = (key: string) => {
        setAttributes(attributes.filter((attr) => attr.key !== key))
    }

    const handleSave = async () => {
        try {
            let attributesToSave = attributes
            
            // If we're in raw JSON mode and it's been edited, validate and parse it
            if (activeTab === "raw-json" && isRawJsonDirty) {
                try {
                    const parsed = JSON.parse(rawJson)
                    attributesToSave = Object.entries(parsed).map(([key, value]) => {
                        let type: AttributeType = "string"
                        let typedValue: string | number | boolean = String(value)
                        
                        if (typeof value === "number") {
                            type = "number"
                            typedValue = value
                        } else if (typeof value === "boolean") {
                            type = "boolean"
                            typedValue = value
                        }
                        
                        return {
                            key,
                            type,
                            value: typedValue
                        }
                    })
                } catch (err) {
                    setError("Invalid JSON format")
                    return
                }
            }

            const attributesObject = attributesToSave.reduce(
                (acc, { key, value }) => {
                    acc[key] = value
                    return acc
                },
                {} as Record<string, unknown>
            )

            // Stringify the attributes object here in the component
            const attributesJson = JSON.stringify(attributesObject)
            await redisCommands.vsetattr(keyName, element, attributesJson)
            onClose()
        } catch (err) {
            setError("Failed to save attributes")
            console.error("Error saving attributes:", err)
        }
    }

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            handleAddAttribute()
        }
    }

    const handleRawJsonChange = (value: string) => {
        setRawJson(value)
        setIsRawJsonDirty(true)
        setHaveAttributesChanged(true)
        
        // Try to parse and update attributes if valid JSON
        try {
            const parsed = JSON.parse(value)
            const newAttributes = Object.entries(parsed).map(([key, value]) => {
                let type: AttributeType = "string"
                let typedValue: string | number | boolean = String(value)
                
                if (typeof value === "number") {
                    type = "number"
                    typedValue = value
                } else if (typeof value === "boolean") {
                    type = "boolean"
                    typedValue = value
                }
                
                return {
                    key,
                    type,
                    value: typedValue
                }
            })
            setAttributes(newAttributes)
            setError(null)
        } catch {
            // Ignore parse errors while typing
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit Attributes</DialogTitle>
                    <DialogDescription>
                        Add or modify attributes for this vector. These can be
                        used for filtering in vector similarity searches.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Tabs
                    value={activeTab}
                    onValueChange={(tab) => {
                        setActiveTab(tab)
                        if (tab === "raw-json") {
                            // When switching to raw JSON, update it with current attributes
                            const attributesObject = attributes.reduce((acc, { key, value }) => {
                                acc[key] = value
                                return acc
                            }, {} as Record<string, unknown>)
                            setRawJson(JSON.stringify(attributesObject, null, 2))
                            setIsRawJsonDirty(false)
                        }
                    }}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="edit-values">
                            Edit Values
                        </TabsTrigger>
                        <TabsTrigger value="raw-json">Raw JSON</TabsTrigger>
                    </TabsList>
                    <TabsContent
                        value="edit-values"
                        className="space-y-4 form-body"
                    >
                        {attributes.length > 0 ? (
                            <div className="space-y-4 p-2">
                                <div className="font-bold">
                                    Attributes ({attributes.length})
                                </div>

                                <div className="form-section">
                                    {attributes.map((attr, index) => (
                                        <div
                                            className="flex space-x-2"
                                            key={index}
                                        >
                                            <div className="form-item">
                                                <Label
                                                    className="grow text-sm text-gray-700"
                                                    htmlFor={attr.key}
                                                >
                                                    {attr.key}
                                                </Label>
                                                {attr.type === "boolean" ? (
                                                    <Switch
                                                        checked={
                                                            attr.value as boolean
                                                        }
                                                        onCheckedChange={(
                                                            checked
                                                        ) => {
                                                            const newAttributes =
                                                                [...attributes]
                                                            newAttributes[
                                                                index
                                                            ].value = checked
                                                            setAttributes(
                                                                newAttributes
                                                            )
                                                        }}
                                                        id={attr.key}
                                                    />
                                                ) : (
                                                    <Input
                                                        className="grow text-right border-none"
                                                        value={attr.value.toString()}
                                                        onChange={(e) => {
                                                            const newAttributes =
                                                                [...attributes]
                                                            newAttributes[
                                                                index
                                                            ].value =
                                                                attr.type ===
                                                                "number"
                                                                    ? Number(
                                                                          e
                                                                              .target
                                                                              .value
                                                                      )
                                                                    : e.target
                                                                          .value
                                                            setAttributes(
                                                                newAttributes
                                                            )
                                                        }}
                                                        type={
                                                            attr.type ===
                                                            "number"
                                                                ? "number"
                                                                : "text"
                                                        }
                                                    />
                                                )}
                                            </div>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() =>
                                                    handleRemoveAttribute(
                                                        attr.key
                                                    )
                                                }
                                            >
                                                X
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="">
                                <div className="p-4">
                                    <p className="font-bold pb-4">Add attributes to this vector.</p>
                                    <p>
                                        Attributes allow you to use the FILTER
                                        command to narrow down your vector
                                        search.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-end space-x-2 p-2">
                            <div className="">
                                <Label>Type</Label>
                                <Select
                                    value={newType}
                                    onValueChange={(value: AttributeType) =>
                                        setNewType(value)
                                    }
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="string">
                                            String
                                        </SelectItem>
                                        <SelectItem value="number">
                                            Number
                                        </SelectItem>
                                        <SelectItem value="boolean">
                                            Boolean
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label>Key</Label>
                                <Input
                                    value={newKey}
                                    className="bg-white"
                                    onChange={(e) => setNewKey(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Enter key"
                                />
                            </div>
                            <div className="flex-1">
                                <Label>Value</Label>
                                {newType === "boolean" ? (
                                    <Select
                                        value={newValue}
                                        onValueChange={setNewValue}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">
                                                True
                                            </SelectItem>
                                            <SelectItem value="false">
                                                False
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        value={newValue}
                                        className="bg-white"
                                        onChange={(e) =>
                                            setNewValue(e.target.value)
                                        }
                                        onKeyPress={handleKeyPress}
                                        type={
                                            newType === "number"
                                                ? "number"
                                                : "text"
                                        }
                                        placeholder={`Enter ${newType} value`}
                                    />
                                )}
                            </div>
                            <Button
                                onClick={handleAddAttribute}
                                className="w-fit"
                            >
                                Add
                            </Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="raw-json" className="h-[400px]">
                        <Textarea
                            value={rawJson}
                            onChange={(e) =>
                                handleRawJsonChange(e.target.value)
                            }
                            className="h-full font-mono"
                            placeholder="Enter JSON..."
                        />
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!haveAttributesChanged}
                    >
                        Save Changes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
