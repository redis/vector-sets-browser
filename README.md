# Vector Sets Browser

A modern web-based visualization and interaction tool for Redis Vector Sets. This application provides an intuitive interface for exploring and analyzing vector embeddings stored in Redis vector-sets.

## Overview

Vector Sets Browser is a Next.js application that provides real-time visualization of vector embeddings and their relationships. It features multiple visualization layouts including:

- Force-directed graph layout
- UMAP dimensionality reduction
- PCA (Principal Component Analysis) visualization
- 3D vector space visualization

## Prerequisites

- Node.js (Latest LTS version recommended)
- A Redis server with vector sets. (([Available in Beta with the latest Redis 8](https://hub.docker.com/_/redis)))
- (optional) OpenAI API key (for AI-assisted template generation)
- (optional) Ollama for embedding generation

## Installation

### Clone the repository:
```bash
git clone https://github.com/redis/vector-sets-browser.git
cd vector-sets-browser
```

## Running with Docker

You can run this project using the provided Dockerfile. This allows you to avoid building the project manually. To do so, follow these steps:

1. Build the Docker image:
   ```bash
   docker build -t vector-sets-browser .
   ```

2. Run the Docker container:
   ```bash
   docker run -p 3000:3000 vector-sets-browser
   ```

3. Open your browser and navigate to `http://localhost:3000`. If Redis is running at localhost, you'll need to configure the application to connecto to `host.docker.internal:6379`.

### Using a `.env` File

If you need to configure environment variables, you can create a `.env` file based on the provided `.env.example`. This file can be used to set variables such as `NEXT_PUBLIC_OLLAMA_URL`. It is important if Ollama cannot be reached directly from docker using the default localhost address.

## Running locally

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Create a `.env` file in the root directory
   - Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Features

- **Interactive Visualization**: Real-time visualization of vector embeddings with multiple layout algorithms
- **Multiple Projection Methods**:
  - UMAP for preserving both local and global structure
  - PCA for linear dimensionality reduction
  - Force-directed layout for graph visualization
- **AI-Assisted CSV Import**: Automatically generate optimal templates for CSV imports using OpenAI
- **Modern UI**: Built with modern React components and Tailwind CSS
- **Real-time Updates**: Live visualization updates as vector sets change
- **Flexible Integration**: Works with any vector embeddings stored in Redis vector-sets

## Technology Stack

- Next.js 14
- React 18
- Three.js for visualization
- Transformers.js (for built-in embedding models)
- Redis vector sets
- Tailwind CSS for styling
- Various data visualization libraries (D3.js, UMAP, PCA)

## Redis Vector Sets Integration

This browser requires a Redis instance running with vector sets. Vector sets provide high-performance vector similarity search capabilities. Make sure you have the latest version installed as it includes important features like:

- Proper node deletion with relinking
- 8-bit and binary quantization
- Threaded queries
- Filtered search with predicate callbacks

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
