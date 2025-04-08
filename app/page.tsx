"use client"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { CodeBlock } from "@/components/ui/code-block"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronRight, Code, Github, Image, Mic } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export default function Home() {
    const [activeTab, setActiveTab] = useState("javascript")

    return (
        <div className="flex min-h-screen flex-col bg-[white]">
            {/* Hero Section */}
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
            {/* Main Content */}
            <section className="container py-12">
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left Column - Information */}
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
                                    <Image className="h-6 w-6 text-primary" alt="Image Embeddings" />
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

                    {/* Right Column - Code Examples */}
                    <div className="flex flex-col">
                        <Card className="flex-1">
                            <CardHeader>
                                <CardTitle>Simple Integration</CardTitle>
                                <CardDescription>
                                    Redis Vector Sets provide a simple API for
                                    storing and querying vector data
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Tabs
                                    value={activeTab}
                                    onValueChange={setActiveTab}
                                    className="w-full"
                                >
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="javascript">
                                            JavaScript
                                        </TabsTrigger>
                                        <TabsTrigger value="php">
                                            PHP
                                        </TabsTrigger>
                                        <TabsTrigger value="c">C</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="javascript">
                                        <CodeExample language="javascript" />
                                    </TabsContent>
                                    <TabsContent value="php">
                                        <CodeExample language="php" />
                                    </TabsContent>
                                    <TabsContent value="c">
                                        <CodeExample language="c" />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>
            {/* Features Section */}
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
            {/* CTA Section */}
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
        </div>
    )
}

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

function CodeExample({ language }: { language: string }) {
    if (language === "javascript") {
        return (
            <div className="space-y-4">
                <div>
                    <CodeBlock
                        title="Adding vectors with VADD"
                        language="javascript"
                        code={`// Connect to Redis
const redis = require('redis');
const client = redis.createClient();

// Create a vector set and add vectors
async function addVectors() {
  // Create a text embedding vector set
  await client.sendCommand([
    'VADD', 'product_descriptions', 
    'product:1002', 'VALUES', '5', '1.0', '0.2', '0.5', '0.8', '0.1'
  ]);
  
  // Add another vector to the set
  await client.sendCommand([
    'VADD', 'product_descriptions',
    'product:1002', 'VALUES', '5', '0.9', '0.3', '0.4', '0.7', '0.2'
  ]);
  
  console.log('Vectors added successfully!');
}`}
                    />
                </div>

                <div>
                    <CodeBlock
                        title="Finding similar vectors with VSIM"
                        language="javascript"
                        code={`// Find similar vectors
async function findSimilarProducts() {
  // Search for products similar to product:1001
  const results = await client.sendCommand([
    'VSIM', 'product_descriptions', 'ELE','product:1001', 'WITHSCORES'
  ]);
  
  // Results include product IDs and similarity scores
  console.log('Similar products:', results);
  
  // Search using a vector directly
  const queryVector = [0.95, 0.25, 0.45, 0.75, 0.15];
  const directResults = await client.sendCommand([
    'VSIM', 'product_descriptions', 'VALUES', '5', 
    ...queryVector, "WITHSCORES"
  ]);
  
  console.log('Direct vector search results:', directResults);
}`}
                    />
                </div>
            </div>
        )
    }

    if (language === "php") {
        return (
            <div className="space-y-4">
                <div>
                    <CodeBlock
                        title="Adding vectors with VADD"
                        language="php"
                        code={`<?php
// Connect to Redis
$redis = new Redis();
$redis->connect('127.0.0.1', 6379);

// Create a vector set and add vectors
function addVectors($redis) {
    // Create an image embedding vector set
    $redis->rawCommand(
        'VADD', 'image_embeddings', 
        'image:1001', 'VALUES', '5', '0.7', '0.3', '0.5', '0.2', '0.9'
    );
    
    // Add another vector to the set
    $redis->rawCommand(
        'VADD', 'image_embeddings',
        'image:1002', 'VALUES', '5', '0.6', '0.4', '0.5', '0.3', '0.8'
    );
    
    // Add multiple vectors in a batch operation
    $vectors = [
        ['id' => 'image:1003', 'vector' => [0.5, 0.5, 0.6, 0.2, 0.7]],
        ['id' => 'image:1004', 'vector' => [0.4, 0.6, 0.5, 0.3, 0.8]],
        ['id' => 'image:1005', 'vector' => [0.3, 0.7, 0.4, 0.4, 0.9]]
    ];
    
    foreach ($vectors as $item) {
        $params = array_merge(
            ['VADD', 'image_embeddings', $item['id'], 'VALUES', '5'],
            $item['vector']
        );
        $redis->rawCommand(...$params);
    }
    
    echo "Vectors added successfully!\\n";
}

addVectors($redis);
?>`}
                    />
                </div>

                <div>
                    <CodeBlock
                        title="Finding similar vectors with VSIM"
                        language="php"
                        code={`<?php
// Find similar vectors
function findSimilarImages($redis) {
    // Search for images similar to image:1001
    $results = $redis->rawCommand(
        'VSIM', 'image_embeddings', 'ELEMENT', 'image:1001', 'WITHSCORES'
    );
    
    // Results include image IDs and similarity scores
    echo "Similar images: " . print_r($results, true) . "\\n";
    
    // Search using a vector directly
    $queryVector = [0.65, 0.35, 0.55, 0.25, 0.85];
    $params = array_merge(
        ['VSIM', 'image_embeddings', 'VALUES', '5'],
        $queryVector,
        ['WITHSCORES', 'LIMIT', '0', '3']
    );
    $directResults = $redis->rawCommand(...$params);
    
    echo "Direct vector search results: " . print_r($directResults, true) . "\\n";
}

findSimilarImages($redis);
?>`}
                    />
                </div>

                <div>
                    <CodeBlock
                        title="Advanced Vector Operations"
                        language="php"
                        code={`<?php
// Advanced vector operations
function advancedVectorOperations($redis) {
    // Get vector information
    $info = $redis->rawCommand('VINFO', 'image_embeddings');
    echo "Vector set info: " . print_r($info, true) . "\\n";
    
    // Get a specific vector
    $vector = $redis->rawCommand('VGET', 'image_embeddings', 'image:1001');
    echo "Vector for image:1001: " . print_r($vector, true) . "\\n";
    
    // Delete a vector
    $redis->rawCommand('VDEL', 'image_embeddings', 'image:1005');
    echo "Deleted vector for image:1005\\n";
    
    // Find similar vectors with distance metric
    $results = $redis->rawCommand(
        'VSIM', 'image_embeddings', 'ELEMENT', 'image:1001', 
        'DISTANCE', 'COSINE', 'WITHSCORES'
    );
    echo "Cosine distance results: " . print_r($results, true) . "\\n";
    
    // Find similar vectors with KNN
    $knnResults = $redis->rawCommand(
        'VSIM', 'image_embeddings', 'ELEMENT', 'image:1001',
        'KNN', '3', 'WITHSCORES'
    );
    echo "KNN results: " . print_r($knnResults, true) . "\\n";
}

advancedVectorOperations($redis);
?>`}
                    />
                </div>
            </div>
        )
    }

    if (language === "c") {
        return (
            <div className="space-y-4">
                <div>
                    <CodeBlock
                        title="Adding vectors with VADD"
                        language="c"
                        code={`#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "hiredis.h"

int main() {
    // Connect to Redis
    redisContext *c = redisConnect("127.0.0.1", 6379);
    if (c == NULL || c->err) {
        if (c) {
            printf("Error: %s\\n", c->errstr);
            redisFree(c);
        } else {
            printf("Cannot allocate redis context\\n");
        }
        return 1;
    }
    
    // Create an audio embedding vector set
    redisReply *reply;
    reply = redisCommand(c, "VADD audio_embeddings audio:1001 0.4 0.6 0.3 0.7 0.2");
    if (reply) freeReplyObject(reply);
    
    // Add another vector to the set
    reply = redisCommand(c, "VADD audio_embeddings audio:1002 0.5 0.5 0.4 0.6 0.3");
    if (reply) freeReplyObject(reply);
    
    printf("Vectors added successfully!\\n");
    
    // Clean up
    redisFree(c);
    return 0;
}`}
                    />
                </div>

                <div>
                    <CodeBlock
                        title="Finding similar vectors with VSIM"
                        language="c"
                        code={`// Find similar vectors
int find_similar_audio(redisContext *c) {
    redisReply *reply;
    
    // Search for audio similar to audio:1001
    reply = redisCommand(c, "VSIM audio_embeddings audio:1001 3");
    if (reply) {
        printf("Similar audio files:\\n");
        for (int i = 0; i < reply->elements; i += 2) {
            printf("  ID: %s, Score: %s\\n", 
                   reply->element[i]->str, 
                   reply->element[i+1]->str);
        }
        freeReplyObject(reply);
    }
    
    // Search using a vector directly
    reply = redisCommand(c, 
        "VSIMDIRECT audio_embeddings 5 0.45 0.55 0.35 0.65 0.25 3");
    if (reply) {
        printf("Direct vector search results:\\n");
        for (int i = 0; i < reply->elements; i += 2) {
            printf("  ID: %s, Score: %s\\n", 
                   reply->element[i]->str, 
                   reply->element[i+1]->str);
        }
        freeReplyObject(reply);
    }
    
    return 0;
}`}
                    />
                </div>
            </div>
        )
    }

    return null
}
