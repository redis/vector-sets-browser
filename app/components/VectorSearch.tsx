"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface VectorSearchProps {
  onSearch: (searchVector: number[]) => void
  dimension: number | null
}

export default function VectorSearch({ onSearch, dimension }: VectorSearchProps) {
  const [searchVector, setSearchVector] = useState("")

  const handleSearch = () => {
    const searchVectorArray = searchVector.split(",").map(Number)
    if (searchVectorArray.some(isNaN)) {
      alert("Please enter valid numbers separated by commas")
      return
    }
    if (dimension && searchVectorArray.length !== dimension) {
      alert(`Search vector must have ${dimension} dimensions`)
      return
    }
    onSearch(searchVectorArray)
  }

  return (
    <div className="mb-4">
      <h2 className="text-2xl font-semibold mb-2">Search Vectors</h2>
      <div className="flex items-end gap-2">
        <div className="flex-grow">
          <Label htmlFor="search-input">Search Vector (comma-separated)</Label>
          <Input
            id="search-input"
            value={searchVector}
            onChange={(e) => setSearchVector(e.target.value)}
            placeholder={`e.g., ${Array(dimension || 3)
              .fill("0.1")
              .join(", ")}`}
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
      </div>
    </div>
  )
}

