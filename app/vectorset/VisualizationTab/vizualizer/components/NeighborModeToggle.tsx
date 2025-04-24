"use client"

import { NeighborMode } from "../types"

interface NeighborModeToggleProps {
  mode: NeighborMode
  onModeChange: (mode: NeighborMode) => void
  disabled?: boolean
}

export function NeighborModeToggle({
  mode,
  onModeChange,
  disabled = false
}: NeighborModeToggleProps) {
  return (
    <div className="flex items-center space-x-2">
      <label className="text-sm font-medium">Neighbor Mode:</label>
      <select
        value={mode}
        onChange={(e) => onModeChange(e.target.value as NeighborMode)}
        className="select select-sm bg-background border-border"
        disabled={disabled}
      >
        <option value="vlink">VLINK (Structure-based)</option>
        <option value="vsim">VSIM (Similarity-based)</option>
      </select>
    </div>
  )
} 