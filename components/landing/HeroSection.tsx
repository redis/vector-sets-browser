"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight, Github } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
    return (
        <section className="container py-6 md:py-12 lg:py-14">
            <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
                <h1 className="text-3xl font-bold text-center leading-tight tracking-tighter md:text-5xl lg:text-6xl lg:leading-[1.1]">
                    Store, Search, and Retrieve{" "}
                    <span className="text-red-500">Vector Data</span> with
                    Redis
                </h1>
                <p className="max-w-[750px] text-lg text-muted-foreground md:text-xl">
                    Seamlessly integrate vector search capabilities into
                    your applications with Redis Vector Sets. Fast,
                    scalable, and easy to use for text, image, and audio
                    embeddings.
                </p>
                <p className="max-w-[750px] text-lg md:text-xl">
                    The Speed you need, the API you love.
                </p>
                <div className="flex flex-col gap-4 sm:flex-row">
                    <Link href="/console" legacyBehavior>
                        <Button size="lg">
                            Get Started
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                    <Link
                        href="https://github.com/redis/redis-vector-sets"
                        legacyBehavior
                    >
                        <Button variant="outline" size="lg">
                            <Github className="mr-2 h-4 w-4" />
                            View on GitHub
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
} 