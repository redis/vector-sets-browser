# Vector Sets for Redis

This module implements Vector Sets for Redis, a new Redis data type similar to Sorted Sets but having string elements associated to a vector instead of a score. The fundamental goal of Vector Sets is to make possible adding items, and later get a subset of the added items that are the most similar to a specified vector (often a learned embedding) or most similar to the vector of an element that is already part of the Vector Set.

## Installation

Build with:

```bash
make
```

Then load the module with the following command line, or by inserting the needed directives in the `redis.conf` file:

```bash
./redis-server --loadmodule vset.so
```

For testing, it's recommended to use:

```bash
./redis-server --save "" --enable-debug-command yes
```

Then execute the tests with:

```bash
./test.py
```

## Command Reference

### VADD: Add Items into a Vector Set

```
VADD key [REDUCE dim] FP32|VALUES vector element [CAS] [NOQUANT] [BIN] [Q8]
         [EF build-exploration-factor]
```

Add a new element into the vector set specified by the key. The vector can be provided as FP32 blob of values, or as floating point numbers as strings, prefixed by the number of elements:

```
VADD mykey VALUES 3 0.1 1.2 0.5 my-element
```

Options:
- `REDUCE`: Implements random projection to reduce vector dimensionality. The projection matrix is saved and reloaded with the vector set.
- `CAS`: Performs operation partially using threads in check-and-set style. Neighbor candidates collection runs in background.
- `NOQUANT`: Forces vector creation without integer 8 quantization (which is default).
- `BIN`: Uses binary quantization instead of int8. Faster and uses less memory, but impacts recall quality.
- `Q8`: Forces signed 8 bit quantization (default). Used to verify vector set format at insertion.
- `EF`: Sets build exploration factor for finding candidates when connecting new nodes (default: 200).

### VSIM: Return Elements by Vector Similarity

```
VSIM key [ELE|FP32|VALUES] <vector or element> [WITHSCORES] [COUNT num] [EF search-exploration-factor]
```

Returns similar vectors. Example using an existing element as reference:

```
> VSIM word_embeddings ELE apple
 1) "apple"
 2) "apples"
 3) "pear"
 4) "fruit"
 5) "berry"
 6) "pears"
 7) "strawberry"
 8) "peach"
 9) "potato"
10) "grape"
```

With scores and count limit:

```
> VSIM word_embeddings ELE apple WITHSCORES COUNT 3
1) "apple"
2) "0.9998867657923256"
3) "apples"
4) "0.8598527610301971"
5) "pear"
6) "0.8226882219314575"
```

The `EF` parameter (50-1000) controls search exploration factor: higher values give better results but slower performance.

### VDIM: Get Vector Dimension

```
VDIM keyname
```

Returns the dimension of vectors in the set:

```
> VDIM word_embeddings
(integer) 300
```

Note: For reduced vectors (via `REDUCE`), returns the projected dimension. Queries should still use full-size vectors.

### VCARD: Get Element Count

```
VCARD key
```

Returns the number of elements in the vector set:

```
> VCARD word_embeddings
(integer) 3000000
```

### VREM: Remove Elements

```
VREM key element
```

Example:

```
> VADD vset VALUES 3 1 0 1 bar
(integer) 1
> VREM vset bar
(integer) 1
> VREM vset bar
(integer) 0
```

VREM performs actual memory reclamation, not logical deletion, making it safe for long-running applications.

### VEMB: Get Approximated Vector

```
VEMB key element [RAW]
```

Returns the vector for an element:

```
> VEMB word_embeddings SQL
  1) "0.18208661675453186"
  2) "0.08535309880971909"
  3) "0.1365649551153183"
  4) "-0.16501599550247192"
  5) "0.14225517213344574"
  ... 295 more elements ...
```

The `RAW` option returns internal representation data:
1. Quantization type ("fp32", "bin", "q8")
2. Raw data blob
3. Pre-normalization L2 norm
4. Quantization range (for q8 only)

### VLINKS: Show Node Neighbors

```
VLINKS key element [WITHSCORES]
```

Shows neighbors for each level in the HNSW graph.

### VINFO: Show Vector Set Information

```
VINFO key
```

Example:

```
> VINFO word_embeddings
 1) quant-type
 2) int8
 3) vector-dim
 4) (integer) 300
 5) size
 6) (integer) 3000000
 7) max-level
 8) (integer) 12
 9) vset-uid
10) (integer) 1
11) hnsw-max-node-uid
12) (integer) 3000000
```

## Known Issues

* VADD with REDUCE replication should send random matrix to replicas for consistent VEMB readings
* Replication code needs more testing (currently uses verbatim command replication)

## Implementation Details

Vector sets use the `hnsw.c` implementation of the HNSW data structure with extensions for:

* Proper nodes deletion with relinking
* 8 bits quantization
* Threaded queries
