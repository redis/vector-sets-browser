"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import VectorVisualization from "./VectorVisualization"
import VectorList from "./VectorList"
import VectorSearch from "./VectorSearch"
import * as RedisService from "../services/redis"

interface Vector {
  id: string
  values: number[]
  similarity?: number
}

export default function VectorBrowser() {
  const [vectors, setVectors] = useState<Vector[]>([])
  const [inputVector, setInputVector] = useState("")
  const [searchResults, setSearchResults] = useState<Vector[]>([])
  const [dimension, setDimension] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDimension() {
      try {
        const dim = await RedisService.vdim()
        setDimension(dim)
      } catch (error) {
        console.error("Error fetching dimension:", error)
        setError(`Error fetching dimension: ${error.message}`)
      }
    }
    fetchDimension()
  }, [])

  const handleAddVector = async () => {
    setError(null)
    const newVector = inputVector.split(",").map(Number)
    if (newVector.some(isNaN)) {
      setError("Please enter valid numbers separated by commas")
      return
    }
    if (dimension && newVector.length !== dimension) {
      setError(`Vector must have ${dimension} dimensions`)
      return
    }
    try {
      const id = `vector_${Date.now()}`
      await RedisService.vadd(newVector, id)
      setVectors([...vectors, { id, values: newVector }])
      setInputVector("")
    } catch (error) {
      console.error("Error adding vector:", error)
      setError(`Failed to add vector: ${error.message}`)
    }
  }

  const handleSearchResults = async (searchVector: number[]) => {
    setError(null)
    try {
      const results = await RedisService.vsim("vectorset", searchVector, 5)
      
      // Only fetch vectors if we need to visualize them
      const needVisualization = true // This is a simple component, so we always need visualization
      
      if (needVisualization) {
        const vectorResults = await Promise.all(
          results.map(async ([id, similarity]) => {
            const values = await RedisService.vemb("vectorset", id)
            return { id, values, similarity }
          }),
        )
        setSearchResults(vectorResults)
      } else {
        // Just use IDs and scores without fetching vectors
        const resultsWithoutVectors = results.map(([id, similarity]) => 
          ({ id, values: [], similarity })
        )
        setSearchResults(resultsWithoutVectors)
      }
    } catch (error) {
      console.error("Error searching vectors:", error)
      setError(`Failed to search vectors: ${error.message}`)
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {error && (
        <Alert variant="destructive" className="col-span-full">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div>
        <h2 className="text-2xl font-semibold mb-2">Add Vector</h2>
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-grow">
            <Label htmlFor="vector-input">Vector (comma-separated)</Label>
            <Input
              id="vector-input"
              value={inputVector}
              onChange={(e) => setInputVector(e.target.value)}
              placeholder={`e.g., ${Array(dimension || 3)
                .fill("0.1")
                .join(", ")}`}
            />
          </div>
          <Button onClick={handleAddVector}>Add</Button>
        </div>
        <VectorSearch onSearch={handleSearchResults} dimension={dimension} />
        <VectorList vectors={vectors} searchResults={searchResults} />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-2">Visualization</h2>
        <VectorVisualization vectors={vectors} searchResults={searchResults} />
      </div>
    </div>
  )
}

