"use client"

export default function DocsPage() {
    return (

        <section id="gettingstarted" className="mb-8 p-4 bg-[white]">
                <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
                <div className="space-y-4">
                    <div>
                        <h3 className="text-xl font-medium mb-2">Step 1: Download Redis Vector Sets</h3>
                        <p className="text-gray-700 mb-4">
                            Clone the Redis Vector Sets repository from GitHub:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">git clone https://github.com/redis/redis-vector-sets.git
cd redis-vector-sets</pre>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-medium mb-2">Step 2: Build the Module</h3>
                        <p className="text-gray-700 mb-4">
                            Compile the Vector Sets module:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">make</pre>
                        <p className="text-gray-700 mb-4">
                            This will generate the <code>vset.so</code> shared library file.
                        </p>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-medium mb-2">Step 3: Load the Module</h3>
                        <p className="text-gray-700 mb-4">
                            Start Redis server with the Vector Sets module:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">./redis-server --loadmodule vset.so</pre>
                        <p className="text-gray-700 mb-4">
                            Alternatively, you can add the following line to your <code>redis.conf</code> file:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">loadmodule /path/to/vset.so</pre>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-medium mb-2">Step 4: Connect to Redis</h3>
                        <p className="text-gray-700 mb-4">
                            Connect to your Redis server using the Redis CLI or any Redis client:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">redis-cli</pre>
                        <p className="text-gray-700 mb-4">
                            Verify the module is loaded correctly:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">127.0.0.1:6379> MODULE LIST</pre>
                    </div>
                    
                    <div>
                        <h3 className="text-xl font-medium mb-2">Next Steps</h3>
                        <p className="text-gray-700 mb-4">
                            Return to the <a href="/" className="text-blue-600 hover:underline">home page</a> to connect to your Redis server and start using Vector Sets.
                        </p>
                        <p className="text-gray-700 mb-4">
                            Check the <a href="#" className="text-blue-600 hover:underline">Available Commands</a> section above to learn how to use Vector Sets.
                        </p>
                    </div>
                </div>
        </section>
    )
} 