import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateVectorSetCommandBoxProps {
    command: string | null;
}

export default function CreateVectorSetCommandBox({ command }: CreateVectorSetCommandBoxProps) {
    if (!command) return null;

    return (
        <div className="flex gap-2 items-center w-full bg-gray-100 rounded-md p-2 mt-4">
            <div className="text-gray-600 font-mono text-sm grow overflow-x-auto whitespace-nowrap">
                <span className="text-blue-600 mr-2"># Preview:</span> {command}
            </div>
            <div className="flex-shrink-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-500"
                    onClick={() => {
                        navigator.clipboard.writeText(command);
                    }}
                    title="Copy command"
                >
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
} 