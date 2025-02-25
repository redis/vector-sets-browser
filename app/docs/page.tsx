"use client"

export default function DocsPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Vector Sets for Redis</h1>
            
            <section className="mb-8">
                <p className="text-gray-700 mb-4">
                    This module implements Vector Sets for Redis, a new Redis data type similar
                    to Sorted Sets but having string elements associated to a vector instead of
                    a score. The fundamental goal of Vector Sets is to make possible adding items,
                    and later get a subset of the added items that are the most similar to a
                    specified vector (often a learned embedding) of the most similar to the vector
                    of an element that is already part of the Vector Set.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Installation</h2>
                <p className="text-gray-700 mb-4">Build with:</p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">make</pre>
                
                <p className="text-gray-700 mb-4">
                    Then load the module with the following command line, or by inserting the needed directives in the &ldquo;redis.conf&rdquo; file.
                </p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">./redis-server --loadmodule vset.so</pre>
                
                <p className="text-gray-700 mb-4">To run tests, it is suggested to use:</p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">./redis-server --save &ldquo;&rdquo; --enable-debug-command yes</pre>
                
                <p className="text-gray-700 mb-4">Then execute the tests with:</p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">./test.py</pre>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Available Commands</h2>
                
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-medium mb-2">VADD: Add Items into a Vector Set</h3>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">VADD key [REDUCE dim] FP32|VALUES vector element [CAS] [NOQUANT] [BIN] [Q8] [EF build-exploration-factor]</pre>
                        <p className="text-gray-700 mb-4">
                            Add a new element into the vector set specified by the key.
                            The vector can be provided as FP32 blob of values, or as floating point
                            numbers as strings, prefixed by the number of elements:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">VADD mykey VALUES 3 0.1 1.2 0.5 my-element</pre>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li><strong>REDUCE:</strong> Implements random projection to reduce vector dimensionality</li>
                            <li><strong>CAS:</strong> Performs operation partially using threads</li>
                            <li><strong>NOQUANT:</strong> Forces vector creation without integer 8 quantization</li>
                            <li><strong>BIN:</strong> Forces binary quantization</li>
                            <li><strong>Q8:</strong> Forces signed 8 bit quantization (default)</li>
                            <li><strong>EF:</strong> Controls build exploration factor (default: 200)</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-2">VSIM: Return Elements by Vector Similarity</h3>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">VSIM key [ELE|FP32|VALUES] &lt;vector or element&gt; [WITHSCORES] [COUNT num] [EF search-exploration-factor]</pre>
                        <p className="text-gray-700 mb-4">
                            Returns similar vectors. Example using element comparison:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">VSIM word_embeddings ELE apple WITHSCORES COUNT 3</pre>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-2">Other Commands</h3>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li><strong>VDIM:</strong> Returns the dimension of vectors inside the vector set</li>
                            <li><strong>VCARD:</strong> Returns the number of elements in a vector set</li>
                            <li><strong>VREM:</strong> Removes elements from vector set</li>
                            <li><strong>VEMB:</strong> Returns the approximated vector of an element</li>
                            <li><strong>VLINKS:</strong> Shows neighbors for a node</li>
                            <li><strong>VINFO:</strong> Shows information about a vector set</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Known Bugs</h2>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>When VADD with REDUCE is replicated, random matrix should probably be sent to replicas for VEMB consistency</li>
                    <li>Replication code is largely untested and very vanilla (replicating commands verbatim)</li>
                </ul>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Implementation Details</h2>
                <p className="text-gray-700 mb-4">
                    Vector sets are based on the &ldquo;hnsw.c&rdquo; implementation of the HNSW data structure with extensions for speed and functionality.
                </p>
                <p className="text-gray-700">Main features:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Proper nodes deletion with relinking</li>
                    <li>8 bits quantization</li>
                    <li>Threaded queries</li>
                </ul>
            </section>
        </div>
    )
} 