"use client"

import { InfoCards } from "@/components/InfoCards"
import { CodeExamplesSection } from "@/components/CodeExamplesSection"

export function MainContentSection() {
    return (
        <section className="container py-12">
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column - Information */}
                <InfoCards />

                {/* Right Column - Code Examples */}
                <div className="flex flex-col">
                    <CodeExamplesSection />
                </div>
            </div>
        </section>
    )
} 