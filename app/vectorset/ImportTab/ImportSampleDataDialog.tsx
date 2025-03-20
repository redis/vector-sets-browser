import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VectorSetMetadata } from "@/app/embeddings/types/config";
import ImportSampleData from "./ImportSampleData";

interface ImportSampleDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: VectorSetMetadata | null;
  vectorSetName: string;
  onUpdateMetadata: (metadata: VectorSetMetadata) => void;
  onSelectDataset: (datasetName: string) => void;
}

export default function ImportSampleDataDialog({
  isOpen,
  onClose,
  metadata,
  vectorSetName,
  onUpdateMetadata,
  onSelectDataset,
}: ImportSampleDataDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[850px] w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Choose Sample Dataset</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-2 w-full overflow-visible">
          <ImportSampleData
            onClose={onClose}
            metadata={metadata}
            vectorSetName={vectorSetName}
            onUpdateMetadata={onUpdateMetadata}
            selectionMode={true}
            onSelectDataset={onSelectDataset}
            useShadcnCarousel={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 