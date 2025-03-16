"use client";

import CacheManager from "../components/CacheManager";
import OpenAIKeyManager from "../components/OpenAIKeyManager";

export default function ConfigPage() {
  return (
    <div className="container mx-auto py-10 space-y-8">
      <h1 className="text-3xl font-bold">Configuration</h1>
      
      <div className="grid grid-cols-1 gap-8">
        <OpenAIKeyManager />
        <CacheManager />
        
        {/* Add more configuration sections here as needed */}
      </div>
    </div>
  );
} 