"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function OpenAIKeyManager() {
  const [apiKey, setApiKey] = useState<string>("");
  const [isSaved, setIsSaved] = useState<boolean>(false);
  
  useEffect(() => {
    // Load saved API key from localStorage on component mount
    const savedKey = localStorage.getItem("openai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
      setIsSaved(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("Please enter a valid API key");
      return;
    }
    
    // Save API key to localStorage
    localStorage.setItem("openai_api_key", apiKey);
    setIsSaved(true);
    toast.success("OpenAI API key saved successfully");
  };

  const handleClear = () => {
    localStorage.removeItem("openai_api_key");
    setApiKey("");
    setIsSaved(false);
    toast.success("OpenAI API key removed");
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">OpenAI API Key</h2>
      
      <p className="mb-4 text-gray-600 dark:text-gray-300">
        This API key is used for OpenAI embeddings and the AI Importer. 
        If not provided, the application will use the default key from environment variables.
      </p>
      
      <div className="mb-4">
        <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
          API Key
        </label>
        <input
          type="password"
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
        />
      </div>
      
      <div className="flex space-x-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Save Key
        </button>
        {isSaved && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Clear Key
          </button>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>
          Don't have an API key?{" "}
          <a 
            href="https://platform.openai.com/api-keys" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Get one from OpenAI
          </a>
        </p>
      </div>
    </div>
  );
} 