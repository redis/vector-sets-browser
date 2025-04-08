# Vector Sets Browser

A modern web-based visualization and interaction tool for Redis Vector Sets. This application provides an intuitive interface for exploring and analyzing vector embeddings stored in Redis using the vector-sets module.

## Overview

Vector Sets Browser is a Next.js application that provides real-time visualization of vector embeddings and their relationships. It features multiple visualization layouts including:

- Force-directed graph layout
- UMAP dimensionality reduction
- PCA (Principal Component Analysis) visualization
- 3D vector space visualization

## Prerequisites

- Node.js (Latest LTS version recommended)
- Redis server with vector-sets module installed ([Installation instructions](https://github.com/antirez/vector-sets))
- OpenAI API key (for AI-assisted template generation)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/rowantrollope/vector-sets-browser.git
cd vector-sets-browser
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Create a `.env.local` file in the root directory
   - Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`

4. Build the application:
```bash
npm run build
```

## Running the Application

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to `http://localhost:3000`

## Features

- **Interactive Visualization**: Real-time visualization of vector embeddings with multiple layout algorithms
- **3D Vector Space**: Explore vector relationships in three dimensions
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
- Three.js for 3D visualization
- Transformers.js (for built-in embedding models)
- Redis vector-sets module
- Tailwind CSS for styling
- Various data visualization libraries (D3.js, UMAP, PCA)

## Redis Vector Sets Integration

This browser requires a Redis instance running with the vector-sets module installed. The vector-sets module provides high-performance vector similarity search capabilities. Make sure you have the latest version installed as it includes important features like:

- Proper node deletion with relinking
- 8-bit and binary quantization
- Threaded queries
- Filtered search with predicate callbacks

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Known Issues

- ?
