"use client"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Code, Image, Mic } from "lucide-react"

export function InfoCards() {
    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Code className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Text Embeddings</CardTitle>
                        <CardDescription>
                            Store and search text vector embeddings
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Redis Vector Sets make it easy to store text
                        embeddings from any source. You can
                        seamlessly and easily store and query your
                        text embeddings with simple commands.
                        Perfect for semantic search, recommendation
                        systems, and natural language processing
                        applications.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Image className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Image Embeddings</CardTitle>
                        <CardDescription>
                            Visual similarity search made simple
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Store image embeddings in Redis Vector Sets
                        to enable powerful visual similarity
                        searches. Perfect for content-based image
                        retrieval, duplicate detection, and visual
                        recommendation systems. Redis Vector Sets
                        handle high-dimensional image embeddings
                        with exceptional performance.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                        <Mic className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Audio Embeddings</CardTitle>
                        <CardDescription>
                            Audio fingerprinting and similarity
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Redis Vector Sets excel at storing and
                        querying audio embeddings. Use them for
                        audio fingerprinting, voice recognition,
                        music recommendation, and sound
                        classification. With Redis{`'`}s in-memory
                        performance, your audio similarity searches
                        will be lightning fast.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
} 