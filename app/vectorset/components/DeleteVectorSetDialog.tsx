"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useEffect, useState, useRef } from "react"

interface DeleteVectorSetDialogProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    vectorSetName: string
}

export default function DeleteVectorSetDialog({
    isOpen,
    onClose,
    onConfirm,
    vectorSetName,
}: DeleteVectorSetDialogProps) {
    const [confirmText, setConfirmText] = useState("")
    const [isConfirmEnabled, setIsConfirmEnabled] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // Reset the confirmation text when the dialog opens or the vector set name changes
    useEffect(() => {
        setConfirmText("")
        setIsConfirmEnabled(false)
        // Focus the input when the dialog opens
        if (isOpen) {
            // Small delay to ensure the dialog is fully mounted
            setTimeout(() => {
                inputRef.current?.focus()
            }, 0)
        }
    }, [isOpen, vectorSetName])

    // Check if the confirmation text matches the vector set name
    const handleConfirmTextChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const value = e.target.value
        setConfirmText(value)
        setIsConfirmEnabled(value === vectorSetName)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && isConfirmEnabled) {
            handleConfirm()
        }
    }

    const handleConfirm = () => {
        if (confirmText === vectorSetName) {
            onConfirm()
            onClose()
        }
    }

    return (
        <AlertDialog open={isOpen} onOpenChange={onClose}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Vector Set</AlertDialogTitle>
                    <AlertDialogDescription className="text-red-500 font-medium">
                        This action will permanently delete the vector set
                        &quot;{vectorSetName}&quot; and all its data. This
                        action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4">
                    <Label
                        htmlFor="confirm-text"
                        className="text-sm font-medium"
                    >
                        To confirm, type the name of the vector set:{" "}
                        <span className="font-bold">{vectorSetName}</span>
                    </Label>
                    <Input
                        ref={inputRef}
                        id="confirm-text"
                        value={confirmText}
                        onChange={handleConfirmTextChange}
                        onKeyDown={handleKeyDown}
                        placeholder={`Type "${vectorSetName}" to confirm`}
                        className="mt-2"
                        autoComplete="off"
                        autoFocus
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={!isConfirmEnabled}
                        className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
