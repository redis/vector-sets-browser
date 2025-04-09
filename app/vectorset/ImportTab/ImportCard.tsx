import { Card } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"

interface ImportCardProps {
    icon: LucideIcon
    title: string
    description: string
    iconColor: string
    onClick: () => void
}

export default function ImportCard({
    icon: Icon,
    title,
    description,
    iconColor,
    onClick,
}: ImportCardProps) {
    return (
        <Card
            className="p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={onClick}
        >
            <div className="flex flex-col items-center space-y-3">
                <Icon className={`h-8 w-8 ${iconColor}`} />
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-gray-500 text-center">
                    {description}
                </p>
            </div>
        </Card>
    )
} 