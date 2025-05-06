"use client"

import { useState } from "react"
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

interface DeleteVectorDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  vectorName: string
  isMultiDelete?: boolean
  vectorCount?: number
}

export function DeleteVectorDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  vectorName,
  isMultiDelete = false,
  vectorCount = 0,
}: DeleteVectorDialogProps) {
  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {isMultiDelete ? "Vectors" : "Vector"}</AlertDialogTitle>
          <AlertDialogDescription>
            {isMultiDelete 
              ? `Are you sure you want to delete these ${vectorCount} vectors?` 
              : "Are you sure you want to delete this vector?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 