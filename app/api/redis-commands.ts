import { apiClient } from "./client"
import {
    VinfoRequest,
    VinfoResponse,
    VdimRequest,
    VcardRequest,
    VremRequest,
    VembRequest,
    VaddRequest,
    VlinkRequest,
    VsimRequest,
    VsetAttrRequest,
    VgetAttrRequest,
    VectorTuple,
    VectorTupleLevels,
} from "./types"

export const redisCommands = {
    async vinfo(keyName: string) {
        return apiClient.post<VinfoResponse, VinfoRequest>(
            "/api/redis/command/vinfo",
            { keyName }
        )
    },

    async vdim(keyName: string) {
        return apiClient.post<number, VdimRequest>("/api/redis/command/vdim", {
            keyName,
        })
    },

    async vcard(keyName: string) {
        return apiClient.post<number, VcardRequest>(
            "/api/redis/command/vcard",
            { keyName }
        )
    },

    async vrem(keyName: string, element: string) {
        return apiClient.post<boolean, VremRequest>("/api/redis/command/vrem", {
            keyName,
            element,
        })
    },

    async vemb(keyName: string, element: string) {
        return apiClient.post<number[], VembRequest>(
            "/api/redis/command/vemb",
            { keyName, element }
        )
    },

    async vadd(keyName: string, element: string, vector: number[]) {
        return apiClient.post<boolean, VaddRequest>("/api/redis/command/vadd", {
            keyName,
            element,
            vector,
        })
    },

    async vlinks(
        keyName: string,
        element: string,
        count?: number,
        withEmbeddings?: boolean
    ) {
        return apiClient.post<VectorTupleLevels, VlinkRequest>(
            "/api/redis/command/vlinks",
            { keyName, element, count, withEmbeddings }
        )
    },

    async vsim(
        keyName: string,
        searchVectorOrElement: number[] | string,
        count: number,
        withEmbeddings?: boolean,
        filter?: string
    ) {
        const request: VsimRequest = {
            keyName,
            count,
            withEmbeddings,
            filter,
            ...(Array.isArray(searchVectorOrElement)
                ? { searchVector: searchVectorOrElement }
                : { searchElement: searchVectorOrElement }),
        }

        const response = await apiClient.post<
            { result: VectorTuple[]; executionTimeMs?: number },
            VsimRequest
        >("/api/redis/command/vsim", request);
        
        // Return both the result and execution time
        return {
            result: response.result,
            executionTimeMs: response.executionTimeMs
        };
    },

    async vsetattr(keyName: string, element: string, attributes: string) {
        return apiClient.post<
            { success: boolean; error?: string },
            VsetAttrRequest
        >("/api/redis/command/vsetattr", { keyName, element, attributes })
    },

    async vgetattr(keyName: string, element: string): Promise<string | null> {
        try {
            return await apiClient.post<string, VgetAttrRequest>(
                "/api/redis/command/vgetattr",
                { keyName, element }
            )
        } catch (error) {
            console.error("[vgetattr] error: ", error)
            return null
        }
    },

    async vgetattr_multi(
        keyName: string,
        elements: string[]
    ): Promise<string[] | null> {
        try {
            return await apiClient.post<string[], VgetAttrRequest>(
                "/api/redis/command/vgetattr",
                { keyName, elements }
            )
        } catch (error) {
            console.error("[vgetattr] error: ", error)
            return null
        }
    },
}
