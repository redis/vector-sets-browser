# Redis Vector Sets Browser

A Next.js web application for browsing and interacting with Redis Vector Sets.

## Overview

This browser application provides a user-friendly interface for exploring and managing vector sets in Redis. It allows you to visualize, search, and manipulate vector data through an intuitive web interface.

## Features

- Browse and search vector sets stored in Redis
- Visualize vector data and relationships
- Perform vector similarity searches
- Create, update, and delete vector sets
- Interactive query builder for complex vector operations (Coming soon)
- Native embedding engine support:
  - OpenAI Embeddings API
  - Ollama local embedding models
  - TensorFlow.js in-browser embeddings

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Redis server with Vector Sets capability

## Installation

Clone the repository and install dependencies:

git clone https://github.com/rowantrollope/vector-sets-browser.git
cd vector-sets-browser
npm install

## Configuration

### Embedding Models

The application supports multiple embedding providers:

1. **OpenAI**: Requires an API key from OpenAI. Supports models:
   - text-embedding-3-small
   - text-embedding-3-large
   - text-embedding-ada-002 (Legacy)

2. **Ollama**: For local embedding models. Requires Ollama to be installed and running.
   - Download from [Ollama's website](https://ollama.ai/)
   - Supports various models like nomic-embed-text, mxbai-embed-large, etc.

3. **TensorFlow.js**: Runs directly in the browser without any external dependencies.
   - Universal Sentence Encoder
   - Universal Sentence Encoder Lite
   - Universal Sentence Encoder Multilingual

## Development

To run the development server:

npm run dev


Open [http://localhost:3000](http://localhost:3000) in your browser to access the application.

## Building for Production

Build the application for production:

npm run build

Start the production server:

npm start

## Usage

1. Connect to your Redis instance using the connection form on the home page
2. Navigate through your vector sets using the sidebar
3. Use the search functionality to find specific vector data
4. Click on a vector set to visualize its contents and metadata
5. Use the built-in tools to perform vector operations and searches

### Using TensorFlow.js Embeddings

TensorFlow.js embeddings run directly in your browser:

1. When creating or editing a vector set, select "TensorFlow.js" as the embedding provider
2. Choose from available models (Universal Sentence Encoder variants)
3. Enable caching if desired to improve performance
4. The first use may take a moment as the model is downloaded to your browser

Benefits of TensorFlow.js embeddings:
- No API key required
- Works offline after initial model download
- No data sent to external services
- Consistent embedding results across sessions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- @Antirez for his powerful vector sets implementation
- @RauchG and Next.js team for the fantastic React framework
- TensorFlow.js team for the browser-based embedding models
