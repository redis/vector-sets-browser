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
- Native embedding engine support

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- Redis server with Vector Sets capability

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/rowantrollope/vector-sets-browser.git
cd vector-sets-browser
npm install
```

## Configuration

If you want to use Ollama embedding models, be sure to download and run ollama and the models you want.  Otherwise you can use OpanAI embedding models

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
