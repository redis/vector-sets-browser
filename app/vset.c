/* Redis implementation for vector sets. The data structure itself
 * is implemented in hnsw.c.
 *
 * Copyright(C) 2024 Salvatore Sanfilippo.
 * All Rights Reserved.
 */

#define _DEFAULT_SOURCE
#define _USE_MATH_DEFINES
#define _POSIX_C_SOURCE 200809L

#include "redismodule.h"
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>
#include <string.h>
#include <strings.h>
#include <stdint.h>
#include <math.h>
#include <pthread.h>
#include "hnsw.h"

static RedisModuleType *VectorSetType;
static uint64_t VectorSetTypeNextId = 0;

// Default EF value if not specified during creation.
#define VSET_DEFAULT_C_EF 200

// Default EF value if not specified during search.
#define VSET_DEFAULT_SEARCH_EF 100

// Default num elements returned by VSIM.
#define VSET_DEFAULT_COUNT 10

/* ========================== Internal data structure  ====================== */

/* Our abstract data type needs a dual representation similar to Redis
 * sorted set: the proximity graph, and also a element -> graph-node map
 * that will allow us to perform deletions and other operations that have
 * as input the element itself. */
struct vsetObject {
    HNSW *hnsw;                 // Proximity graph.
    RedisModuleDict *dict;      // Element -> node mapping.
    float *proj_matrix;         // Random projection matrix, NULL if no projection
    uint32_t proj_input_size;     // Input dimension after projection.
                                  // Output dimension is implicit in
                                  // hnsw->vector_dim.
    pthread_rwlock_t in_use_lock; // Lock needed to destroy the object safely.
    uint64_t id;                // Unique ID used by threaded VADD to know the
                                // object is still the same.
};

/* Create a random projection matrix for dimensionality reduction.
 * Returns NULL on allocation failure. Matrix is scaled by 1/sqrt(input_dim). */
float *createProjectionMatrix(uint32_t input_dim, uint32_t output_dim) {
    float *matrix = RedisModule_Alloc(sizeof(float) * input_dim * output_dim);
    if (!matrix) return NULL;

    const float scale = 1.0f / sqrt(input_dim);
    for (uint32_t i = 0; i < input_dim * output_dim; i++) {
        /* Box-Muller transform for normal distribution */
        float u1 = (float)rand() / RAND_MAX;
        float u2 = (float)rand() / RAND_MAX;
        float r = sqrt(-2.0f * log(u1));
        float theta = 2.0f * M_PI * u2;
        matrix[i] = r * cos(theta) * scale;
    }
    return matrix;
}

/* Apply random projection to input vector. Returns new allocated vector or NULL. */
float *applyProjection(const float *input, const float *proj_matrix,
                      uint32_t input_dim, uint32_t output_dim)
{
    float *output = RedisModule_Alloc(sizeof(float) * output_dim);
    if (!output) return NULL;

    for (uint32_t i = 0; i < output_dim; i++) {
        const float *row = &proj_matrix[i * input_dim];
        float sum = 0.0f;
        for (uint32_t j = 0; j < input_dim; j++) {
            sum += row[j] * input[j];
        }
        output[i] = sum;
    }
    return output;
}

/* Create the vector as HNSW+Dictionary combined data structure. */
struct vsetObject *createVectorSetObject(unsigned int dim, uint32_t quant_type) {
    struct vsetObject *o;
    o = RedisModule_Alloc(sizeof(*o));
    if (!o) return NULL;

    o->id = VectorSetTypeNextId++;
    o->hnsw = hnsw_new(dim,quant_type);
    if (!o->hnsw) {
        RedisModule_Free(o);
        return NULL;
    }

    o->dict = RedisModule_CreateDict(NULL);
    if (!o->dict) {
        hnsw_free(o->hnsw,NULL);
        RedisModule_Free(o);
        return NULL;
    }

    o->proj_matrix = NULL;
    o->proj_input_size = 0;
    pthread_rwlock_init(&o->in_use_lock,NULL);

    return o;
}

void vectorSetReleaseNodeValue(void *v) {
    RedisModule_FreeString(NULL,v);
}

/* Free the vector set object. */
void vectorSetReleaseObject(struct vsetObject *o) {
    if (!o) return;
    if (o->hnsw) hnsw_free(o->hnsw,vectorSetReleaseNodeValue);
    if (o->dict) RedisModule_FreeDict(NULL,o->dict);
    if (o->proj_matrix) RedisModule_Free(o->proj_matrix);
    pthread_rwlock_destroy(&o->in_use_lock);
    RedisModule_Free(o);
}

/* Return a string representing the quantization type name of a vector set. */
const char *vectorSetGetQuantName(struct vsetObject *o) {
    switch(o->hnsw->quant_type) {
    case HNSW_QUANT_NONE: return "f32";
    case HNSW_QUANT_Q8: return "int8";
    case HNSW_QUANT_BIN: return "bin";
    default: return "unknown";
    }
}

/* Insert the specified element into the Vector Set.
 * If update is '1', the existing node will be updated.
 *
 * Returns 1 if the element was added, or 0 if the element was already there
 * and was just updated. */
int vectorSetInsert(struct vsetObject *o, float *vec, int8_t *qvec, float qrange, RedisModuleString *val, int update, int ef)
{
    hnswNode *node = RedisModule_DictGet(o->dict,val,NULL);
    if (node != NULL) {
        if (update) {
            void *old_val = node->value;
            /* Pass NULL as value-free function. We want to reuse
             * the old value. */
            hnsw_delete_node(o->hnsw, node, NULL);
            node = hnsw_insert(o->hnsw,vec,qvec,qrange,0,old_val,ef);
            RedisModule_DictReplace(o->dict,val,node);
        }
        return 0;
    }

    node = hnsw_insert(o->hnsw,vec,qvec,qrange,0,val,ef);
    if (!node) return 0;
    RedisModule_DictSet(o->dict,val,node);
    return 1;
}

/* Parse vector from FP32 blob or VALUES format, with optional REDUCE.
 * Format: [REDUCE dim] FP32|VALUES ...
 * Returns allocated vector and sets dimension in *dim.
 * If reduce_dim is not NULL, sets it to the requested reduction dimension.
 * Returns NULL on parsing error. */
float *parseVector(RedisModuleString **argv, int argc, int start_idx,
                  size_t *dim, uint32_t *reduce_dim, int *consumed_args)
{
    int consumed = 0; // Argumnets consumed

    /* Check for REDUCE option first */
    if (reduce_dim) *reduce_dim = 0;
    if (reduce_dim && argc > start_idx + 2 &&
        !strcasecmp(RedisModule_StringPtrLen(argv[start_idx],NULL),"REDUCE"))
    {
        long long rdim;
        if (RedisModule_StringToLongLong(argv[start_idx+1],&rdim) != REDISMODULE_OK
            || rdim <= 0) return NULL;
        if (reduce_dim) *reduce_dim = rdim;
        start_idx += 2;  // Skip REDUCE and its argument
        consumed += 2;
    }

    /* Now parse the vector format as before */
    float *vec = NULL;

    if (!strcasecmp(RedisModule_StringPtrLen(argv[start_idx],NULL),"FP32")) {
        if (argc < start_idx + 2) return NULL;  // Need FP32 + vector + value
        size_t vec_raw_len;
        const char *blob = RedisModule_StringPtrLen(argv[start_idx+1],&vec_raw_len);
        if (vec_raw_len % 4 || vec_raw_len < 4) return NULL;
        *dim = vec_raw_len/4;
        vec = RedisModule_Alloc(vec_raw_len);
        if (!vec) return NULL;
        memcpy(vec,blob,vec_raw_len);
        consumed += 2;
    } else if (!strcasecmp(RedisModule_StringPtrLen(argv[start_idx],NULL),"VALUES")) {
        if (argc < start_idx + 2) return NULL;  // Need at least dimension.
        long long vdim;
        if (RedisModule_StringToLongLong(argv[start_idx+1],&vdim) != REDISMODULE_OK
            || vdim < 1) return NULL;

        // Check that all the arguments are available.
        if (argc < start_idx + 2 + vdim) return NULL;

        *dim = vdim;
        vec = RedisModule_Alloc(sizeof(float) * vdim);
        if (!vec) return NULL;

        for (int j = 0; j < vdim; j++) {
            double val;
            if (RedisModule_StringToDouble(argv[start_idx+2+j],&val) != REDISMODULE_OK) {
                RedisModule_Free(vec);
                return NULL;
            }
            vec[j] = val;
        }
        consumed += vdim + 2;
    } else {
        return NULL;  // Unknown format
    }

    if (consumed_args) *consumed_args = consumed;
    return vec;
}

/* ========================== Commands implementation ======================= */

/* VADD thread handling the "CAS" version of the command, that is
 * performed blocking the client, accumulating here, in the thread, the
 * set of potential candidates, and later inserting the element in the
 * key (if it still exists, and if it is still the *same* vector set)
 * in the Reply callback. */
void *VADD_thread(void *arg) {
    pthread_detach(pthread_self());

    void **targ = (void**)arg;
    RedisModuleBlockedClient *bc = targ[0];
    struct vsetObject *vset = targ[1];
    float *vec = targ[3];
    RedisModuleString *val = targ[4];
    int ef = (uint64_t)targ[6];

    /* Look for candidates... */
    InsertContext *ic = hnsw_prepare_insert(vset->hnsw, vec, NULL, 0, 0, val, ef);
    targ[5] = ic; // Pass the context to the reply callback.

    /* Unblock the client so that our read reply will be invoked. */
    pthread_rwlock_unlock(&vset->in_use_lock);
    RedisModule_UnblockClient(bc,targ); // Use targ as privdata.
    return NULL;
}

/* Reply callback for CAS variant of VADD. */
int VADD_CASReply(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    (void)argc;
    RedisModule_AutoMemory(ctx); /* Use automatic memory management. */

    int retval = REDISMODULE_OK;
    void **targ = (void**)RedisModule_GetBlockedClientPrivateData(ctx);
    uint64_t vset_id = (unsigned long) targ[2];
    float *vec = targ[3];
    RedisModuleString *val = targ[4];
    InsertContext *ic = targ[5];
    int ef = (uint64_t)targ[6];
    RedisModule_Free(targ);

    /* Open the key: there are no guarantees it still exists, or contains
     * a vector set, or even the SAME vector set. */
    RedisModuleKey *key = RedisModule_OpenKey(ctx,argv[1],
        REDISMODULE_READ|REDISMODULE_WRITE);
    int type = RedisModule_KeyType(key);
    struct vsetObject *vset = NULL;

    if (type != REDISMODULE_KEYTYPE_EMPTY &&
        RedisModule_ModuleTypeGetType(key) == VectorSetType)
    {
        vset = RedisModule_ModuleTypeGetValue(key);
        // Same vector set?
        if (vset->id != vset_id) vset = NULL;

        /* Also, if the element was already inserted, we just pretend
         * the other insert won. We don't even start a threaded VADD
         * if this was an udpate, since the deletion of the element itself
         * in order to perform the update would invalidate the CAS state. */
        if (RedisModule_DictGet(vset->dict,val,NULL) != NULL) vset = NULL;
    }

    if (vset == NULL) {
        /* If the object does not match the start of the operation, we
         * just pretend the VADD was performed BEFORE the key was deleted
         * or replaced. We return success but don't do anything. */
        hnsw_free_insert_context(ic);
    } else {
        /* Otherwise try to insert the new element with the neighbors
         * collected in background. If we fail, do it synchronously again
         * from scratch. */
        hnswNode *newnode;
        if ((newnode = hnsw_try_commit_insert(vset->hnsw, ic)) == NULL) {
            newnode = hnsw_insert(vset->hnsw, vec, NULL, 0, 0, val, ef);
        }
        RedisModule_DictSet(vset->dict,val,newnode);
        val = NULL; // Don't free it later.

        RedisModule_ReplicateVerbatim(ctx);
    }

    // Whatever happens is a success... :D
    RedisModule_ReplyWithLongLong(ctx,1);
    if (val) RedisModule_FreeString(ctx,val); // Not added? Free it.
    RedisModule_Free(vec);
    return retval;
}

/* VADD key [REDUCE dim] FP32|VALUES vector value [CAS] [NOQUANT] */
int VADD_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx); /* Use automatic memory management. */

    if (argc < 5) return RedisModule_WrongArity(ctx);

    /* Parse vector with optional REDUCE */
    size_t dim = 0;
    uint32_t reduce_dim = 0;
    int consumed_args;
    int cas = 0; // Threaded check-and-set style insert.
    long long ef = VSET_DEFAULT_C_EF; // HNSW creation time EF for new nodes.
    float *vec = parseVector(argv, argc, 2, &dim, &reduce_dim, &consumed_args);
    if (!vec)
        return RedisModule_ReplyWithError(ctx,"ERR invalid vector specification");

    /* Missing element string at the end? */
    if (argc-2-consumed_args < 1) return RedisModule_WrongArity(ctx);

    /* Parse options after the element string. */
    uint32_t quant_type = HNSW_QUANT_Q8; // Default quantization type.

    for (int j = 2 + consumed_args + 1; j < argc; j++) {
        const char *opt = RedisModule_StringPtrLen(argv[j], NULL);
        if (!strcasecmp(opt, "CAS")) {
            cas = 1;
        } else if (!strcasecmp(opt, "EF") && j+1 < argc) {
            if (RedisModule_StringToLongLong(argv[j+1], &ef)
                != REDISMODULE_OK || ef <= 0 || ef > 1000000)
            {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx, "ERR invalid EF");
            }
            j++; // skip EF argument.
        } else if (!strcasecmp(opt, "NOQUANT")) {
            quant_type = HNSW_QUANT_NONE;
        } else if (!strcasecmp(opt, "BIN")) {
            quant_type = HNSW_QUANT_BIN;
        } else if (!strcasecmp(opt, "Q8")) {
            quant_type = HNSW_QUANT_Q8;
        } else {
            RedisModule_Free(vec);
            return RedisModule_ReplyWithError(ctx,"ERR invalid option after element");
        }
    }

    /* Drop CAS if this is a replica and we are getting the command from the
     * replication link: we want to add/delete items in the same order as
     * the master, while with CAS the timing would be different.
     *
     * Also for Lua scripts and MULTI/EXEC, we want to run the command
     * on the main thread. */
    if (RedisModule_GetContextFlags(ctx) &
            (REDISMODULE_CTX_FLAGS_REPLICATED|
             REDISMODULE_CTX_FLAGS_LUA|
             REDISMODULE_CTX_FLAGS_MULTI))
    {
        cas = 0;
    }

    /* Open/create key */
    RedisModuleKey *key = RedisModule_OpenKey(ctx,argv[1],
        REDISMODULE_READ|REDISMODULE_WRITE);
    int type = RedisModule_KeyType(key);
    if (type != REDISMODULE_KEYTYPE_EMPTY &&
        RedisModule_ModuleTypeGetType(key) != VectorSetType)
    {
        RedisModule_Free(vec);
        return RedisModule_ReplyWithError(ctx,REDISMODULE_ERRORMSG_WRONGTYPE);
    }

    /* Get the correct value argument based on format and REDUCE */
    RedisModuleString *val = argv[2 + consumed_args];

    /* Create or get existing vector set */
    struct vsetObject *vset;
    if (type == REDISMODULE_KEYTYPE_EMPTY) {
        cas = 0; /* Do synchronous insert at creation, otherwise the
                  * key would be left empty until the threaded part
                  * does not return. It's also pointless to try try
                  * doing threaded first elemetn insertion. */
        vset = createVectorSetObject(reduce_dim ? reduce_dim : dim, quant_type);

        /* Initialize projection if requested */
        if (reduce_dim) {
            vset->proj_matrix = createProjectionMatrix(dim, reduce_dim);
            vset->proj_input_size = dim;

            /* Project the vector */
            float *projected = applyProjection(vec, vset->proj_matrix,
                                            dim, reduce_dim);
            RedisModule_Free(vec);
            vec = projected;
        }
        RedisModule_ModuleTypeSetValue(key,VectorSetType,vset);
    } else {
        vset = RedisModule_ModuleTypeGetValue(key);

        if (vset->hnsw->quant_type != quant_type) {
            RedisModule_Free(vec);
            return RedisModule_ReplyWithError(ctx,
                "ERR use the same quantization of the existing vector set");
        }

        if ((vset->proj_matrix == NULL && vset->hnsw->vector_dim != dim) ||
            (vset->proj_matrix && vset->hnsw->vector_dim != reduce_dim))
        {
            RedisModule_Free(vec);
            return RedisModule_ReplyWithErrorFormat(ctx,
                "ERR Vector dimension mismatch - got %d but set has %d",
                (int)dim, (int)vset->hnsw->vector_dim);
        }

        /* Check REDUCE compatibility */
        if (reduce_dim) {
            if (!vset->proj_matrix) {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx,
                    "ERR cannot add projection to existing set without projection");
            }
            if (reduce_dim != vset->hnsw->vector_dim) {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx,
                    "ERR projection dimension mismatch with existing set");
            }
        }

        /* Apply projection if needed */
        if (vset->proj_matrix) {
            float *projected = applyProjection(vec, vset->proj_matrix,
                                            vset->proj_input_size, dim);
            RedisModule_Free(vec);
            vec = projected;
        }
    }

    /* Don't do CAS updates. For how things work now, the CAS state would
     * be invalidated by the detetion before adding back. */
    if (cas && RedisModule_DictGet(vset->dict,val,NULL) != NULL)
        cas = 0;

    /* Here depending on the CAS option we directly insert in a blocking
     * way, or use a thread to do candidate neighbors selection and only
     * later, in the reply callback, actually add the element. */

    if (!cas) {
        /* Insert vector synchronously. */
        int added = vectorSetInsert(vset,vec,NULL,0,val,1,ef);
        if (added) RedisModule_RetainString(ctx,val);
        RedisModule_Free(vec);

        RedisModule_ReplyWithLongLong(ctx,added);
        if (added) RedisModule_ReplicateVerbatim(ctx);
        return REDISMODULE_OK;
    } else {
        /* Make sure the key does not get deleted during the background
         * operation. See VSIM implementation for more information. */
        pthread_rwlock_rdlock(&vset->in_use_lock);

        RedisModuleBlockedClient *bc = RedisModule_BlockClient(ctx,VADD_CASReply,NULL,NULL,0);
        pthread_t tid;
        void **targ = RedisModule_Alloc(sizeof(void*)*7);
        targ[0] = bc;
        targ[1] = vset;
        targ[2] = (void*)(unsigned long)vset->id;
        targ[3] = vec;
        targ[4] = val;
        targ[5] = NULL; // Used later for insertion context.
        targ[6] = (void*)(unsigned long)ef;
        RedisModule_RetainString(ctx,val);
        if (pthread_create(&tid,NULL,VADD_thread,targ) != 0) {
            pthread_rwlock_unlock(&vset->in_use_lock);
            RedisModule_AbortBlock(bc);
            RedisModule_FreeString(ctx, val);
            RedisModule_Free(vec);
            RedisModule_Free(targ);
            return RedisModule_ReplyWithError(ctx,"-ERR Can't start thread");
        }
        return REDISMODULE_OK;
    }
}

/* Common path for the execution of the VSIM command both threaded and
 * not threaded. Note that 'ctx' may be normal context of a thread safe
 * context obtained from a blocked client. The locking that is specific
 * to the vset object is handled by the caller, however the function
 * handles the HNSW locking explicitly. */
void VSIM_execute(RedisModuleCtx *ctx, struct vsetObject *vset,
    float *vec, unsigned long count, float epsilon, unsigned long withscores,
    unsigned long ef)
{
    /* In our scan, we can't just collect 'count' elements as
     * if count is small we would explore the graph in an insufficient
     * way to provide enough recall.
     *
     * If the user didn't asked for a specific exploration, we use
     * VSET_DEFAULT_SEARCH_EF as minimum, or we match count if count
     * is greater than that. Otherwise the minumim will be the specified
     * EF argument. */
    if (ef == 0) ef = VSET_DEFAULT_SEARCH_EF;
    if (count > ef) ef = count;

    /* Perform search */
    hnswNode **neighbors = RedisModule_Alloc(sizeof(hnswNode*)*ef);
    float *distances = RedisModule_Alloc(sizeof(float)*ef);
    int slot = hnsw_acquire_read_slot(vset->hnsw);
    unsigned int found = hnsw_search(vset->hnsw, vec, ef, neighbors, distances, slot, 0);
    hnsw_release_read_slot(vset->hnsw,slot);
    RedisModule_Free(vec);

    /* Return results */
    if (withscores)
        RedisModule_ReplyWithMap(ctx, REDISMODULE_POSTPONED_LEN);
    else
        RedisModule_ReplyWithArray(ctx, REDISMODULE_POSTPONED_LEN);
    long long arraylen = 0;

    for (unsigned int i = 0; i < found && i < count; i++) {
        if (distances[i] > epsilon) break;
        RedisModule_ReplyWithString(ctx, neighbors[i]->value);
        arraylen++;
        if (withscores) {
            /* The similarity score is provided in a 0-1 range. */
            RedisModule_ReplyWithDouble(ctx, 1.0 - distances[i]/2.0);
        }
    }

    if (withscores)
        RedisModule_ReplySetMapLength(ctx, arraylen);
    else
        RedisModule_ReplySetArrayLength(ctx, arraylen);

    RedisModule_Free(neighbors);
    RedisModule_Free(distances);
}

/* VSIM thread handling the blocked client request. */
void *VSIM_thread(void *arg) {
    pthread_detach(pthread_self());

    // Extract arguments.
    void **targ = (void**)arg;
    RedisModuleBlockedClient *bc = targ[0];
    struct vsetObject *vset = targ[1];
    float *vec = targ[2];
    unsigned long count = (unsigned long)targ[3];
    float epsilon = *((float*)targ[4]);
    unsigned long withscores = (unsigned long)targ[5];
    unsigned long ef = (unsigned long)targ[6];
    RedisModule_Free(targ[4]);
    RedisModule_Free(targ);

    // Accumulate reply in a thread safe context: no contention.
    RedisModuleCtx *ctx = RedisModule_GetThreadSafeContext(bc);

    // Run the query.
    VSIM_execute(ctx, vset, vec, count, epsilon, withscores, ef);

    // Cleanup.
    RedisModule_FreeThreadSafeContext(ctx);
    pthread_rwlock_unlock(&vset->in_use_lock);
    RedisModule_UnblockClient(bc,NULL);
    return NULL;
}

/* VSIM key [ELE|FP32|VALUES] <vector or ele> [WITHSCORES] [COUNT num] [EPSILON eps] [EF exploration-factor] */
int VSIM_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);

    /* Basic argument check: need at least key and vector specification
     * method. */
    if (argc < 4) return RedisModule_WrongArity(ctx);

    /* Defaults */
    int withscores = 0;
    long long count = VSET_DEFAULT_COUNT;   /* New default value */
    long long ef = 0;       /* Exploration factor (see HNSW paper) */
    double epsilon = 2.0;   /* Max cosine distance */

    /* Get key and vector type */
    RedisModuleString *key = argv[1];
    const char *vectorType = RedisModule_StringPtrLen(argv[2], NULL);

    /* Get vector set */
    RedisModuleKey *keyptr = RedisModule_OpenKey(ctx, key, REDISMODULE_READ);
    int type = RedisModule_KeyType(keyptr);
    if (type == REDISMODULE_KEYTYPE_EMPTY)
        return RedisModule_ReplyWithEmptyArray(ctx);

    if (RedisModule_ModuleTypeGetType(keyptr) != VectorSetType)
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);

    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(keyptr);

    /* Vector parsing stage */
    float *vec = NULL;
    size_t dim = 0;
    int vector_args = 0;  /* Number of args consumed by vector specification */

    if (!strcasecmp(vectorType, "ELE")) {
        /* Get vector from existing element */
        RedisModuleString *ele = argv[3];
        hnswNode *node = RedisModule_DictGet(vset->dict, ele, NULL);
        if (!node) {
            return RedisModule_ReplyWithError(ctx, "ERR element not found in set");
        }
        vec = RedisModule_Alloc(sizeof(float) * vset->hnsw->vector_dim);
        hnsw_get_node_vector(vset->hnsw,node,vec);
        dim = vset->hnsw->vector_dim;
        vector_args = 2;  /* ELE + element name */
    } else {
        /* Parse vector. */
        int consumed_args;

        vec = parseVector(argv, argc, 2, &dim, NULL, &consumed_args);
        if (!vec) {
            return RedisModule_ReplyWithError(ctx,
                "ERR invalid vector specification");
        }
        vector_args = consumed_args;

        /* Apply projection if the set uses it, with the exception
         * of ELE type, that will already have the right dimension. */
        if (vset->proj_matrix && dim != vset->hnsw->vector_dim) {
            float *projected = applyProjection(vec, vset->proj_matrix,
                                             vset->proj_input_size, dim);
            RedisModule_Free(vec);
            vec = projected;
            dim = vset->hnsw->vector_dim;
        }

        /* Count consumed arguments */
        if (!strcasecmp(vectorType, "FP32")) {
            vector_args = 2;  /* FP32 + vector blob */
        } else if (!strcasecmp(vectorType, "VALUES")) {
            long long vdim;
            if (RedisModule_StringToLongLong(argv[3], &vdim) != REDISMODULE_OK) {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx, "ERR invalid vector dimension");
            }
            vector_args = 2 + vdim;  /* VALUES + dim + values */
        } else {
            RedisModule_Free(vec);
            return RedisModule_ReplyWithError(ctx,
                "ERR vector type must be ELE, FP32 or VALUES");
        }
    }

    /* Check vector dimension matches set */
    if (dim != vset->hnsw->vector_dim) {
        RedisModule_Free(vec);
        return RedisModule_ReplyWithErrorFormat(ctx,
            "ERR Vector dimension mismatch - got %d but set has %d",
            (int)dim, (int)vset->hnsw->vector_dim);
    }

    /* Parse optional arguments - start after vector specification */
    int j = 2 + vector_args;
    while (j < argc) {
        const char *opt = RedisModule_StringPtrLen(argv[j], NULL);
        if (!strcasecmp(opt, "WITHSCORES")) {
            withscores = 1;
            j++;
        } else if (!strcasecmp(opt, "COUNT") && j+1 < argc) {
            if (RedisModule_StringToLongLong(argv[j+1], &count)
                != REDISMODULE_OK || count <= 0)
            {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx, "ERR invalid COUNT");
            }
            j += 2;
        } else if (!strcasecmp(opt, "EPSILON") && j+1 < argc) {
            if (RedisModule_StringToDouble(argv[j+1], &epsilon) !=
                REDISMODULE_OK || epsilon <= 0)
            {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx, "ERR invalid EPSILON");
            }
            j += 2;
        } else if (!strcasecmp(opt, "EF") && j+1 < argc) {
            if (RedisModule_StringToLongLong(argv[j+1], &ef) !=
                REDISMODULE_OK || ef <= 0)
            {
                RedisModule_Free(vec);
                return RedisModule_ReplyWithError(ctx, "ERR invalid EF");
            }
            j += 2;
        } else {
            RedisModule_Free(vec);
            return RedisModule_ReplyWithError(ctx,
                "ERR syntax error in VSIM command");
        }
    }

    int threaded_request = 1; // Run on a thread, by default.

    // Disable threaded for MULTI/EXEC and Lua.
    if (RedisModule_GetContextFlags(ctx) &
             (REDISMODULE_CTX_FLAGS_LUA|
             REDISMODULE_CTX_FLAGS_MULTI))
    {
        threaded_request = 0;
    }

    if (threaded_request) {
        /* Spawn the thread serving the request:
         * Acquire the lock here so that the object will not be
         * destroyed while we work with it in the thread.
         *
         * This lock should never block, since:
         * 1. If we are in the main thread, the key exists (we looked it up)
         * and so there is no deletion in progress.
         * 2. If the write lock is taken while destroying the object, another
         * command or operation (expire?) from the main thread acquired
         * it to delete the object, so *it* will block if there are still
         * operations in progress on this key. */
        pthread_rwlock_rdlock(&vset->in_use_lock);

        RedisModuleBlockedClient *bc = RedisModule_BlockClient(ctx,NULL,NULL,NULL,0);
        pthread_t tid;
        void **targ = RedisModule_Alloc(sizeof(void*)*7);
        targ[0] = bc;
        targ[1] = vset;
        targ[2] = vec;
        targ[3] = (void*)count;
        targ[4] = RedisModule_Alloc(sizeof(float));
        *((float*)targ[4]) = epsilon;
        targ[5] = (void*)(unsigned long)withscores;
        targ[6] = (void*)(unsigned long)ef;
        if (pthread_create(&tid,NULL,VSIM_thread,targ) != 0) {
            pthread_rwlock_unlock(&vset->in_use_lock);
            RedisModule_AbortBlock(bc);
            RedisModule_Free(vec);
            RedisModule_Free(targ[4]);
            RedisModule_Free(targ);
            return RedisModule_ReplyWithError(ctx,"-ERR Can't start thread");
        }
    } else {
        VSIM_execute(ctx, vset, vec, count, epsilon, withscores, ef);
    }

    return REDISMODULE_OK;
}

/* VDIM <key>: return the dimension of vectors in the vector set. */
int VDIM_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);

    if (argc != 2) return RedisModule_WrongArity(ctx);

    RedisModuleKey *key = RedisModule_OpenKey(ctx, argv[1], REDISMODULE_READ);
    int type = RedisModule_KeyType(key);

    if (type == REDISMODULE_KEYTYPE_EMPTY)
        return RedisModule_ReplyWithError(ctx, "ERR key does not exist");

    if (RedisModule_ModuleTypeGetType(key) != VectorSetType)
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);

    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(key);
    return RedisModule_ReplyWithLongLong(ctx, vset->hnsw->vector_dim);
}

/* VCARD <key>: return cardinality (num of elements) of the vector set. */
int VCARD_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);

    if (argc != 2) return RedisModule_WrongArity(ctx);

    RedisModuleKey *key = RedisModule_OpenKey(ctx, argv[1], REDISMODULE_READ);
    int type = RedisModule_KeyType(key);

    if (type == REDISMODULE_KEYTYPE_EMPTY)
        return RedisModule_ReplyWithLongLong(ctx, 0);

    if (RedisModule_ModuleTypeGetType(key) != VectorSetType)
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);

    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(key);
    return RedisModule_ReplyWithLongLong(ctx, vset->hnsw->node_count);
}

/* VREM key element
 * Remove an element from a vector set.
 * Returns 1 if the element was found and removed, 0 if not found. */
int VREM_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx); /* Use automatic memory management. */

    if (argc != 3) return RedisModule_WrongArity(ctx);

    /* Get key and value */
    RedisModuleString *key = argv[1];
    RedisModuleString *element = argv[2];

    /* Open key */
    RedisModuleKey *keyptr = RedisModule_OpenKey(ctx, key,
        REDISMODULE_READ|REDISMODULE_WRITE);
    int type = RedisModule_KeyType(keyptr);

    /* Handle non-existing key or wrong type */
    if (type == REDISMODULE_KEYTYPE_EMPTY) {
        return RedisModule_ReplyWithLongLong(ctx, 0);
    }
    if (RedisModule_ModuleTypeGetType(keyptr) != VectorSetType) {
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);
    }

    /* Get vector set from key */
    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(keyptr);

    /* Find the node for this element */
    hnswNode *node = RedisModule_DictGet(vset->dict, element, NULL);
    if (!node) {
        return RedisModule_ReplyWithLongLong(ctx, 0);
    }

    /* Remove from dictionary */
    RedisModule_DictDel(vset->dict, element, NULL);

    /* Remove from HNSW graph using the high-level API that handles
     * locking and cleanup. We pass RedisModule_FreeString as the value
     * free function since the strings were retained at insertion time. */
    hnsw_delete_node(vset->hnsw, node, vectorSetReleaseNodeValue);

    /* Destroy empty vector set. */
    if (RedisModule_DictSize(vset->dict) == 0) {
        RedisModule_DeleteKey(keyptr);
    }

    /* Reply and propagate the command */
    RedisModule_ReplyWithLongLong(ctx, 1);
    RedisModule_ReplicateVerbatim(ctx);
    return REDISMODULE_OK;
}

/* VEMB key element
 * Returns the embedding vector associated with an element, or NIL if not
 * found. The vector is returned in the same format it was added, but the
 * return value will have some lack of precision due to quantization and
 * normalization of vectors. Also, if items were added using REDUCE, the
 * reduced vector is returned instead. */
int VEMB_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);
    int raw_output = 0; // RAW option.

    if (argc < 3) return RedisModule_WrongArity(ctx);

    /* Parse arguments. */
    for (int j = 3; j < argc; j++) {
        const char *opt = RedisModule_StringPtrLen(argv[j], NULL);
        if (!strcasecmp(opt,"raw")) {
            raw_output = 1;
        } else {
            return RedisModule_ReplyWithError(ctx,"ERR invalid option");
        }
    }

    /* Get key and element. */
    RedisModuleString *key = argv[1];
    RedisModuleString *element = argv[2];

    /* Open key. */
    RedisModuleKey *keyptr = RedisModule_OpenKey(ctx, key, REDISMODULE_READ);
    int type = RedisModule_KeyType(keyptr);

    /* Handle non-existing key and key of wrong type. */
    if (type == REDISMODULE_KEYTYPE_EMPTY) {
        return RedisModule_ReplyWithNull(ctx);
    } else if (RedisModule_ModuleTypeGetType(keyptr) != VectorSetType) {
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);
    }

    /* Lookup the node about the specified element. */
    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(keyptr);
    hnswNode *node = RedisModule_DictGet(vset->dict, element, NULL);
    if (!node) {
        return RedisModule_ReplyWithNull(ctx);
    }

    if (raw_output) {
        int output_qrange = vset->hnsw->quant_type == HNSW_QUANT_Q8;
        RedisModule_ReplyWithArray(ctx, 3+output_qrange);
        RedisModule_ReplyWithSimpleString(ctx, vectorSetGetQuantName(vset));
        RedisModule_ReplyWithStringBuffer(ctx, node->vector, hnsw_quants_bytes(vset->hnsw));
        RedisModule_ReplyWithDouble(ctx, node->l2);
        if (output_qrange) RedisModule_ReplyWithDouble(ctx, node->quants_range);
    } else {
        /* Get the vector associated with the node. */
        float *vec = RedisModule_Alloc(sizeof(float) * vset->hnsw->vector_dim);
        hnsw_get_node_vector(vset->hnsw, node, vec); // May dequantize/denorm.

        /* Return as array of doubles. */
        RedisModule_ReplyWithArray(ctx, vset->hnsw->vector_dim);
        for (uint32_t i = 0; i < vset->hnsw->vector_dim; i++)
            RedisModule_ReplyWithDouble(ctx, vec[i]);
        RedisModule_Free(vec);
    }
    return REDISMODULE_OK;
}

/* ============================== Reflection ================================ */

/* VLINKS key element [WITHSCORES]
 * Returns the neighbors of an element at each layer in the HNSW graph.
 * Reply is an array of arrays, where each nested array represents one level
 * of neighbors, from highest level to level 0. If WITHSCORES is specified,
 * each neighbor is followed by its distance from the element. */
int VLINKS_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);

    if (argc < 3 || argc > 4) return RedisModule_WrongArity(ctx);

    RedisModuleString *key = argv[1];
    RedisModuleString *element = argv[2];

    /* Parse WITHSCORES option. */
    int withscores = 0;
    if (argc == 4) {
        const char *opt = RedisModule_StringPtrLen(argv[3], NULL);
        if (strcasecmp(opt, "WITHSCORES") != 0) {
            return RedisModule_WrongArity(ctx);
        }
        withscores = 1;
    }

    RedisModuleKey *keyptr = RedisModule_OpenKey(ctx, key, REDISMODULE_READ);
    int type = RedisModule_KeyType(keyptr);

    /* Handle non-existing key or wrong type. */
    if (type == REDISMODULE_KEYTYPE_EMPTY)
        return RedisModule_ReplyWithNull(ctx);

    if (RedisModule_ModuleTypeGetType(keyptr) != VectorSetType)
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);

    /* Find the node for this element. */
    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(keyptr);
    hnswNode *node = RedisModule_DictGet(vset->dict, element, NULL);
    if (!node)
        return RedisModule_ReplyWithNull(ctx);

    /* Reply with array of arrays, one per level. */
    RedisModule_ReplyWithArray(ctx, node->level + 1);

    /* For each level, from highest to lowest: */
    for (int i = node->level; i >= 0; i--) {
        /* Reply with array of neighbors at this level. */
        if (withscores)
            RedisModule_ReplyWithMap(ctx,node->layers[i].num_links);
        else
            RedisModule_ReplyWithArray(ctx,node->layers[i].num_links);

        /* Add each neighbor's element value to the array. */
        for (uint32_t j = 0; j < node->layers[i].num_links; j++) {
            RedisModule_ReplyWithString(ctx, node->layers[i].links[j]->value);
            if (withscores) {
                float distance = hnsw_distance(vset->hnsw, node, node->layers[i].links[j]);
                /* Convert distance to similarity score to match
                 * VSIM behavior.*/
                float similarity = 1.0 - distance/2.0;
                RedisModule_ReplyWithDouble(ctx, similarity);
            }
        }
    }
    return REDISMODULE_OK;
}

/* VINFO key
 * Returns information about a vector set, both visible and hidden
 * features of the HNSW data structure. */
int VINFO_RedisCommand(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    RedisModule_AutoMemory(ctx);

    if (argc != 2) return RedisModule_WrongArity(ctx);

    RedisModuleKey *key = RedisModule_OpenKey(ctx, argv[1], REDISMODULE_READ);
    int type = RedisModule_KeyType(key);

    if (type == REDISMODULE_KEYTYPE_EMPTY)
        return RedisModule_ReplyWithNullArray(ctx);

    if (RedisModule_ModuleTypeGetType(key) != VectorSetType)
        return RedisModule_ReplyWithError(ctx, REDISMODULE_ERRORMSG_WRONGTYPE);

    struct vsetObject *vset = RedisModule_ModuleTypeGetValue(key);

    /* Reply with hash */
    RedisModule_ReplyWithMap(ctx, 6);

    /* Quantization type */
    RedisModule_ReplyWithSimpleString(ctx, "quant-type");
    RedisModule_ReplyWithSimpleString(ctx, vectorSetGetQuantName(vset));

    /* Vector dimensionality. */
    RedisModule_ReplyWithSimpleString(ctx, "vector-dim");
    RedisModule_ReplyWithLongLong(ctx, vset->hnsw->vector_dim);

    /* Number of elements. */
    RedisModule_ReplyWithSimpleString(ctx, "size");
    RedisModule_ReplyWithLongLong(ctx, vset->hnsw->node_count);

    /* Max level of HNSW. */
    RedisModule_ReplyWithSimpleString(ctx, "max-level");
    RedisModule_ReplyWithLongLong(ctx, vset->hnsw->max_level);

    /* Vector set ID. */
    RedisModule_ReplyWithSimpleString(ctx, "vset-uid");
    RedisModule_ReplyWithLongLong(ctx, vset->id);

    /* HNSW max node ID. */
    RedisModule_ReplyWithSimpleString(ctx, "hnsw-max-node-uid");
    RedisModule_ReplyWithLongLong(ctx, vset->hnsw->last_id);

    return REDISMODULE_OK;
}

/* ============================== vset type methods ========================= */

/* Save object to RDB */
void VectorSetRdbSave(RedisModuleIO *rdb, void *value) {
    struct vsetObject *vset = value;
    RedisModule_SaveUnsigned(rdb, vset->hnsw->vector_dim);
    RedisModule_SaveUnsigned(rdb, vset->hnsw->node_count);
    RedisModule_SaveUnsigned(rdb, vset->hnsw->quant_type);

    /* Save projection matrix if present */
    if (vset->proj_matrix) {
        RedisModule_SaveUnsigned(rdb, 1);  // has projection
        uint32_t input_dim = vset->proj_input_size;
        uint32_t output_dim = vset->hnsw->vector_dim;
        RedisModule_SaveUnsigned(rdb, input_dim);
        // Output dim is the same as the first value saved
        // above, so we don't save it.

        // Save projection matrix as binary blob
        size_t matrix_size = sizeof(float) * input_dim * output_dim;
        RedisModule_SaveStringBuffer(rdb, (const char *)vset->proj_matrix, matrix_size);
    } else {
        RedisModule_SaveUnsigned(rdb, 0);  // no projection
    }

    hnswNode *node = vset->hnsw->head;
    while(node) {
        RedisModule_SaveString(rdb, node->value);
        hnswSerNode *sn = hnsw_serialize_node(vset->hnsw,node);
        RedisModule_SaveStringBuffer(rdb, (const char *)sn->vector, sn->vector_size);
        RedisModule_SaveUnsigned(rdb, sn->params_count);
        for (uint32_t j = 0; j < sn->params_count; j++)
            RedisModule_SaveUnsigned(rdb, sn->params[j]);
        hnsw_free_serialized_node(sn);
        node = node->next;
    }
}

/* Load object from RDB */
void *VectorSetRdbLoad(RedisModuleIO *rdb, int encver) {
    if (encver != 0) return NULL;  // Invalid version

    uint32_t dim = RedisModule_LoadUnsigned(rdb);
    uint64_t elements = RedisModule_LoadUnsigned(rdb);
    uint32_t quant_type = RedisModule_LoadUnsigned(rdb);

    struct vsetObject *vset = createVectorSetObject(dim,quant_type);
    if (!vset) return NULL;

    /* Load projection matrix if present */
    uint32_t has_projection = RedisModule_LoadUnsigned(rdb);
    if (has_projection) {
        uint32_t input_dim = RedisModule_LoadUnsigned(rdb);
        uint32_t output_dim = dim;
        size_t matrix_size = sizeof(float) * input_dim * output_dim;

        vset->proj_matrix = RedisModule_Alloc(matrix_size);
        if (!vset->proj_matrix) {
            vectorSetReleaseObject(vset);
            return NULL;
        }
        vset->proj_input_size = input_dim;

        // Load projection matrix as a binary blob
        char *matrix_blob = RedisModule_LoadStringBuffer(rdb, NULL);
        memcpy(vset->proj_matrix, matrix_blob, matrix_size);
        RedisModule_Free(matrix_blob);
    }

    while(elements--) {
        // Load associated string element.
        RedisModuleString *ele = RedisModule_LoadString(rdb);
        size_t vector_len;
        void *vector = RedisModule_LoadStringBuffer(rdb, &vector_len);
        uint32_t vector_bytes = hnsw_quants_bytes(vset->hnsw);
        if (vector_len != vector_bytes) {
            RedisModule_LogIOError(rdb,"warning",
                                       "Mismatching vector dimension");
            return NULL; // Loading error.
        }

        // Load node parameters back.
        uint32_t params_count = RedisModule_LoadUnsigned(rdb);
        uint64_t *params = RedisModule_Alloc(params_count*sizeof(uint64_t));
        for (uint32_t j = 0; j < params_count; j++)
            params[j] = RedisModule_LoadUnsigned(rdb);

        hnswNode *node = hnsw_insert_serialized(vset->hnsw, vector, params, params_count, ele);
        if (node == NULL) {
            RedisModule_LogIOError(rdb,"warning",
                                       "Vector set node index loading error");
            return NULL; // Loading error.
        }
        RedisModule_DictSet(vset->dict,ele,node);
        RedisModule_Free(vector);
        RedisModule_Free(params);
    }
    hnsw_deserialize_index(vset->hnsw);
    return vset;
}

/* Calculate memory usage */
size_t VectorSetMemUsage(const void *value) {
    const struct vsetObject *vset = value;
    size_t size = sizeof(*vset);

    /* Account for HNSW index base structure */
    size += sizeof(HNSW);

    /* Account for projection matrix if present */
    if (vset->proj_matrix) {
        /* For the matrix size, we need the input dimension. We can get it
         * from the first node if the set is not empty. */
        uint32_t input_dim = vset->proj_input_size;
        uint32_t output_dim = vset->hnsw->vector_dim;
        size += sizeof(float) * input_dim * output_dim;
    }

    /* Account for each node's memory usage. */
    hnswNode *node = vset->hnsw->head;
    if (node == NULL) return size;

    /* Base node structure. */
    size += sizeof(*node) * vset->hnsw->node_count;

    /* Vector storage. */
    uint64_t vec_storage = hnsw_quants_bytes(vset->hnsw);
    size += vec_storage * vset->hnsw->node_count;

    /* Layers array. We use 1.33 as average nodes layers count. */
    uint64_t layers_storage = sizeof(hnswNodeLayer) * vset->hnsw->node_count;
    layers_storage = layers_storage * 4 / 3; // 1.33 times.
    size += layers_storage;

    /* All the nodes have layer 0 links. */
    uint64_t level0_links = node->layers[0].max_links;
    uint64_t other_levels_links = level0_links/2;
    size += sizeof(hnswNode*) * level0_links * vset->hnsw->node_count;

    /* Add the 0.33 remaining part, but upper layers have less links. */
    size += (sizeof(hnswNode*) * other_levels_links * vset->hnsw->node_count)/3;

    /* Associated string value - use Redis Module API to get string size, and
     * guess that all the elements have similar size. */
    size += RedisModule_MallocSizeString(node->value) * vset->hnsw->node_count;

    /* Account for dictionary overhead - this is an approximation. */
    size += RedisModule_DictSize(vset->dict) * (sizeof(void*) * 2);

    return size;
}

/* Free the entire data structure */
void VectorSetFree(void *value) {
    struct vsetObject *vset = value;

    // Wait for all the threads performing operations on this
    // index to terminate their work (locking for write will
    // wait for all the other threads).
    pthread_rwlock_wrlock(&vset->in_use_lock);

    // This lock is managed only in the main thread, so we can
    // unlock it now, to be able to destroy the mutex later
    // in vectorSetReleaseObject().
    pthread_rwlock_unlock(&vset->in_use_lock);
    vectorSetReleaseObject(value);
}

/* Add object digest to the digest context */
void VectorSetDigest(RedisModuleDigest *md, void *value) {
    struct vsetObject *vset = value;

    /* Add consistent order-independent hash of all vectors */
    hnswNode *node = vset->hnsw->head;

    /* Hash the vector dimension and number of nodes. */
    RedisModule_DigestAddLongLong(md, vset->hnsw->node_count);
    RedisModule_DigestAddLongLong(md, vset->hnsw->vector_dim);
    RedisModule_DigestEndSequence(md);

    while(node) {
        /* Hash each vector component */
        RedisModule_DigestAddStringBuffer(md, node->vector, hnsw_quants_bytes(vset->hnsw));
        /* Hash the associated value */
        size_t len;
        const char *str = RedisModule_StringPtrLen(node->value, &len);
        RedisModule_DigestAddStringBuffer(md, (char*)str, len);
        node = node->next;
        RedisModule_DigestEndSequence(md);
    }
}

/* This function must be present on each Redis module. It is used in order to
 * register the commands into the Redis server. */
int RedisModule_OnLoad(RedisModuleCtx *ctx, RedisModuleString **argv, int argc) {
    REDISMODULE_NOT_USED(argv);
    REDISMODULE_NOT_USED(argc);

    if (RedisModule_Init(ctx,"vectorset",1,REDISMODULE_APIVER_1)
        == REDISMODULE_ERR) return REDISMODULE_ERR;

    RedisModuleTypeMethods tm = {
        .version = REDISMODULE_TYPE_METHOD_VERSION,
        .rdb_load = VectorSetRdbLoad,
        .rdb_save = VectorSetRdbSave,
        .aof_rewrite = NULL,
        .mem_usage = VectorSetMemUsage,
        .free = VectorSetFree,
        .digest = VectorSetDigest
    };

    VectorSetType = RedisModule_CreateDataType(ctx,"vectorset",0,&tm);
    if (VectorSetType == NULL) return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx,"VADD",
        VADD_RedisCommand,"write deny-oom",1,1,1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx,"VREM",
        VREM_RedisCommand,"write",1,1,1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx,"VSIM",
        VSIM_RedisCommand,"readonly",1,1,1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx, "VDIM",
        VDIM_RedisCommand, "readonly fast", 1, 1, 1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx, "VCARD",
        VCARD_RedisCommand, "readonly fast", 1, 1, 1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx, "VEMB",
        VEMB_RedisCommand, "readonly fast", 1, 1, 1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx, "VLINKS",
        VLINKS_RedisCommand, "readonly fast", 1, 1, 1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    if (RedisModule_CreateCommand(ctx, "VINFO",
        VINFO_RedisCommand, "readonly fast", 1, 1, 1) == REDISMODULE_ERR)
        return REDISMODULE_ERR;

    hnsw_set_allocator(RedisModule_Free, RedisModule_Alloc,
                       RedisModule_Realloc);

    return REDISMODULE_OK;
}
