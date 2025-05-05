"use client"

import { Button } from "@/components/ui/button"
import { ChevronRight } from "lucide-react"
import Link from "next/link"

export function CallToAction() {
    return (
        <section className="bg-primary/5 py-12 md:py-24">
            <div className="container">
                <div className="mx-auto flex max-w-[980px] flex-col items-center gap-4 text-center">
                    <h2 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
                        Ready to get started?
                    </h2>
                    <p className="max-w-[750px] text-lg text-muted-foreground">
                        Try Redis Vector Sets today and see how easy it is
                        to add vector search to your applications.
                    </p>
                    <Link href="/console" legacyBehavior>
                        <Button size="lg" className="mt-4">
                            Get Started
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </div>
            </div>
        </section>
    )
} 