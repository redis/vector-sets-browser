import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VectorSetMetadata, EmbeddingConfig } from "@/app/embeddings/types/config";
import ImportSampleData from "./ImportSampleData";
import { SampleDataSelect } from "./SampleDataSelect";
import { getDefaultEmbeddingConfig } from "@/app/utils/embeddingUtils";

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
  const [embeddingConfigs, setEmbeddingConfigs] = useState<Record<string, EmbeddingConfig>>({});
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[850px] w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Choose Sample Dataset</DialogTitle>
        </DialogHeader>
        
        <div className="p-6 pt-2 w-full overflow-visible">
          <SampleDataSelect
            onSelect={(dataset, embeddingConfig) => {
              onSelectDataset(dataset.name);
              // Also update the metadata with the appropriate embedding config
              if (metadata && onUpdateMetadata) {
                onUpdateMetadata({
                  ...metadata,
                  embedding: embeddingConfig
                });
              }
              onClose();
            }}
            onCancel={onClose}
            useCarousel={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 