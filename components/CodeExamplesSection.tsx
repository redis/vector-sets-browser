"use client"

import { useState } from "react"
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeBlock } from "@/components/ui/code-block"

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

export function CodeExamplesSection() {
    const [activeTab, setActiveTab] = useState("javascript")
    
    return (
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
    )
} 