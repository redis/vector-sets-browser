import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface FilterHelpDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export default function FilterHelpDialog({
    open,
    onOpenChange,
}: FilterHelpDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold">
                        Filter Expression Help
                    </DialogTitle>
                </DialogHeader>
                <div className="prose prose-sm">
                    <p className="mb-4">
                        Redis vector sets supports a simple but powerful
                        filtering syntax. The filter is applied to the
                        attributes of the vectors in the set.
                    </p>
                    <ul className="mb-4">
                        <li>
                            <strong>Arithmetic:</strong> +, -, *, /, %
                            (modulo), ** (exponentiation)
                        </li>
                        <li>
                            <strong>Comparison:</strong> &gt;, &gt;=, &lt;,
                            &lt;=, ==, !=
                        </li>
                        <li>
                            <strong>Logical:</strong> and/&&, or/||, !/not
                        </li>
                        <li>
                            <strong>Containment:</strong> in
                        </li>
                        <li>
                            <strong>Grouping:</strong> (...)
                        </li>
                    </ul>

                    <h3 className="text-lg font-bold">
                        Accessing Attributes
                    </h3>
                    <p className="mb-4">
                        Use dot notation to access attributes:{" "}
                        <code>.attributeName</code>
                    </p>
                    <p className="mb-4">
                        Only top-level attributes are accessible (nested
                        objects are not supported).
                    </p>

                    <h3 className="text-lg font-bold">Examples</h3>
                    <pre className="bg-gray-100 p-2 rounded">
                        <code>{`.year >= 1980 and .year < 1990
.genre == "action" and .rating > 8.0
.director in ["Spielberg", "Nolan"]
(.year - 2000) ** 2 < 100 and .rating / 2 > 4`}</code>
                    </pre>
                </div>
            </DialogContent>
        </Dialog>
    )
} 