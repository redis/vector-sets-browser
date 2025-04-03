"use client"

export default function DocsPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Vector Sets for Redis</h1>

            <section className="mb-8">
                <p className="text-gray-700 mb-4">
                    This module implements Vector Sets for Redis, a new Redis
                    data type similar to Sorted Sets but having string elements
                    associated to a vector instead of a score. The fundamental
                    goal of Vector Sets is to make possible adding items, and
                    later get a subset of the added items that are the most
                    similar to a specified vector (often a learned embedding) or
                    the most similar to the vector of an element that is already
                    part of the Vector Set.
                </p>
                <p className="text-gray-700 mb-4">
                    Moreover, Vector sets implement optional filtered search capabilities: it is possible to associate attributes to all or to a subset of elements in the set, and then, using the <code>FILTER</code> option of the <code>VSIM</code> command, to ask for items similar to a given vector but also passing a filter specified as a simple mathematical expression (Like <code>&quot;.year &gt; 1950&quot;</code> or similar). This means that <strong>you can have vector similarity and scalar filters at the same time</strong>.
                </p>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Installation</h2>
                <p className="text-gray-700 mb-4">Build with:</p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                    make
                </pre>

                <p className="text-gray-700 mb-4">
                    Then load the module with the following command line, or by
                    inserting the needed directives in the
                    &ldquo;redis.conf&rdquo; file.
                </p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                    ./redis-server --loadmodule vset.so
                </pre>

                <p className="text-gray-700 mb-4">
                    To run tests, it is suggested to use:
                </p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                    ./redis-server --save &ldquo;&rdquo; --enable-debug-command yes
                </pre>

                <p className="text-gray-700 mb-4">
                    Then execute the tests with:
                </p>
                <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                    ./test.py
                </pre>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">
                    Available Commands
                </h2>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-xl font-medium mb-2">
                            VADD: Add Items into a Vector Set
                        </h3>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                            VADD key [REDUCE dim] FP32|VALUES vector element [CAS] [NOQUANT | Q8 | BIN]
                            [EF build-exploration-factor] [SETATTR &lt;attributes&gt;] [M &lt;numlinks&gt;]
                        </pre>
                        <p className="text-gray-700 mb-4">
                            Add a new element into the vector set specified by
                            the key. The vector can be provided as FP32 blob of
                            values, or as floating point numbers as strings,
                            prefixed by the number of elements:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                            VADD mykey VALUES 3 0.1 1.2 0.5 my-element
                        </pre>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>REDUCE:</strong> Implements random projection to reduce vector dimensionality. Must be passed immediately before the vector.
                            </li>
                            <li>
                                <strong>CAS:</strong> Performs operation partially using threads in a check-and-set style.
                            </li>
                            <li>
                                <strong>NOQUANT:</strong> Forces vector creation without integer 8 quantization
                            </li>
                            <li>
                                <strong>BIN:</strong> Forces binary quantization for faster processing and less memory
                            </li>
                            <li>
                                <strong>Q8:</strong> Forces signed 8 bit quantization (default)
                            </li>
                            <li>
                                <strong>EF:</strong> Controls build exploration factor (default: 200)
                            </li>
                            <li>
                                <strong>SETATTR:</strong> Associates attributes to the newly created entry or updates existing attributes
                            </li>
                            <li>
                                <strong>M:</strong> Maximum number of connections per node (default: 16)
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-2">
                            VSIM: Return Elements by Vector Similarity
                        </h3>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                            VSIM key [ELE|FP32|VALUES] &lt;vector or element&gt; [WITHSCORES] [COUNT num] 
                            [EF search-exploration-factor] [FILTER expression] [FILTER-EF max-filtering-effort] 
                            [TRUTH] [NOTHREAD]
                        </pre>
                        <p className="text-gray-700 mb-4">
                            Returns similar vectors. Example using element comparison:
                        </p>
                        <pre className="bg-gray-100 p-4 rounded-lg mb-4 font-mono">
                            VSIM word_embeddings ELE apple WITHSCORES COUNT 3
                            1) "apple"
                            2) "0.9998867657923256"
                            3) "apples"
                            4) "0.8598527610301971"
                            5) "pear"
                            6) "0.8226882219314575"
                        </pre>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>EF:</strong> Exploration factor for better search results (50-1000)
                            </li>
                            <li>
                                <strong>TRUTH:</strong> Forces linear scan for perfect results
                            </li>
                            <li>
                                <strong>NOTHREAD:</strong> Executes search in main thread
                            </li>
                            <li>
                                <strong>FILTER:</strong> Applies scalar filters to results
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-xl font-medium mb-2">
                            Other Commands
                        </h3>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                            <li>
                                <strong>VDIM:</strong> Returns the dimension of vectors inside the vector set
                            </li>
                            <li>
                                <strong>VCARD:</strong> Returns the number of elements in a vector set
                            </li>
                            <li>
                                <strong>VREM:</strong> Removes elements from vector set with memory reclamation
                            </li>
                            <li>
                                <strong>VEMB:</strong> Returns the approximated vector of an element (with RAW option for internal representation)
                            </li>
                            <li>
                                <strong>VLINKS:</strong> Shows neighbors for a node at each level
                            </li>
                            <li>
                                <strong>VINFO:</strong> Shows information about a vector set
                            </li>
                            <li>
                                <strong>VSETATTR:</strong> Associates or removes JSON attributes of elements
                            </li>
                            <li>
                                <strong>VGETATTR:</strong> Retrieves the JSON attributes of elements
                            </li>
                            <li>
                                <strong>VRANDMEMBER:</strong> Returns random members from a vector set
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Implementation Details</h2>
                <p className="text-gray-700 mb-4">
                    Vector sets are based on the HNSW (Hierarchical Navigable Small World) data structure implementation with extensions for speed and functionality.
                </p>
                <p className="text-gray-700">Key features:</p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Proper nodes deletion with relinking</li>
                    <li>Multiple quantization options (8-bit, binary)</li>
                    <li>Threaded queries with optional main thread execution</li>
                    <li>Filtered search capabilities</li>
                    <li>Attribute support for elements</li>
                    <li>Dimension reduction through random projection</li>
                </ul>
            </section>
        </div>
    )
}
