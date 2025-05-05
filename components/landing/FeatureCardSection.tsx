"use client"

import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card"

function FeatureCard({
    title,
    description,
}: {
    title: string
    description: string
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    )
}

export function FeatureCardSection() {
    return (
        <section className="container py-12 md:py-24">
            <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
                <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
                    Why Redis Vector Sets?
                </h2>
                <p className="max-w-[750px] text-lg text-muted-foreground">
                    Redis Vector Sets provide a powerful, yet simple way to
                    work with vector embeddings
                </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3 mt-12">
                <FeatureCard
                    title="Lightning Fast"
                    description="In-memory performance for real-time vector similarity searches"
                />
                <FeatureCard
                    title="Easy Integration"
                    description="Simple commands that work with your existing Redis setup"
                />
                <FeatureCard
                    title="Scalable"
                    description="Handle millions of vectors with consistent performance"
                />
                <FeatureCard
                    title="Multi-Modal"
                    description="Store text, image, audio, or any other vector embeddings"
                />
                <FeatureCard
                    title="Flexible"
                    description="Works with any embedding model or provider"
                />
                <FeatureCard
                    title="Production Ready"
                    description="Built on Redis's proven reliability and performance"
                />
            </div>
        </section>
    )
} 