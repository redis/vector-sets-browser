import { CompactResultsTableProps } from "./CompactResultsTable"
import CompactResultsTable from "./CompactResultsTable"
import DropZone from "./DropZone"
import { VectorSetMetadata } from "@/lib/types/vectors"
import { UploadCloud } from "lucide-react"
import DropzoneFooter from "./DropzoneFooter"
import { useEffect, useState } from "react"

interface DropzoneResultsTableProps extends CompactResultsTableProps {
  handleAddVector: (element: string, embedding: number[]) => Promise<void>
  vectorSetName: string
  metadata?: VectorSetMetadata | null
}

export default function DropzoneResultsTable({
  handleAddVector,
  vectorSetName,
  metadata,
  ...compactResultsTableProps
}: DropzoneResultsTableProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Create a custom overlay that fits within the table container
  const customDropOverlay = (dragState: boolean) => {
    setIsDragging(dragState);
    return (
    <div className="absolute inset-0 bg-blue-50 bg-opacity-90 z-10 transition-all duration-200 flex items-center justify-center">
      <div className="flex flex-col items-center px-4 py-6 text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-blue-100 p-2 rounded-full">
            <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="mx-3">
            <svg className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
          <div className="bg-blue-100 p-2 rounded-full">
            <svg className="h-8 w-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
        </div>
        <div className="text-lg font-semibold text-blue-700 mb-1">
          Drop files to add to vectors
        </div>
        <div className="text-sm text-blue-500">
          Files will be encoded into vectors
        </div>
      </div>
    </div>
  )};

  // Custom wrapper for the onAddVector callback that also resets the isDragging state
  const handleAddVectorWrapper = async (element: string, embedding: number[]) => {
    try {
      await handleAddVector(element, embedding);
    } finally {
      // Make sure isDragging is reset regardless of success or failure
      setIsDragging(false);
    }
  };

  return (
    <DropZone
      onAddVector={handleAddVectorWrapper}
      metadata={metadata}
      className="w-full"
      renderDropOverlay={customDropOverlay}
    >
      <div className="flex flex-col">
        <CompactResultsTable {...compactResultsTableProps} />
        <DropzoneFooter isDragging={isDragging} metadata={metadata} />
      </div>
    </DropZone>
  );
} 