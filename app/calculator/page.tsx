"use client"

import { Card } from "@/components/ui/card"
import VectorSetCalculator from "./VectorSetCalculator"

export default function CalculatorPage() {
    return (
        <div className="container mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">Vector Set Size Calculator</h1>
            <Card className="p-6">
                <VectorSetCalculator />
            </Card>
        </div>
    )
} 