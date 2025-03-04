import { apiClient } from './client';
import {
    VinfoRequest,
    VinfoResponse,
    VdimRequest,
    VcardRequest,
    VremRequest,
    VembRequest,
    VaddRequest,
    VlinksRequest,
    VsimRequest,
    VectorTuple,
    VectorTupleLevels
} from './types';

export const redisCommands = {
    async vinfo(keyName: string) {
        return apiClient.post<VinfoResponse, VinfoRequest>(
            '/api/redis/command/vinfo',
            { keyName }
        );
    },

    async vdim(keyName: string) {
        return apiClient.post<number, VdimRequest>(
            '/api/redis/command/vdim',
            { keyName }
        );
    },

    async vcard(keyName: string) {
        return apiClient.post<number, VcardRequest>(
            '/api/redis/command/vcard',
            { keyName }
        );
    },

    async vrem(keyName: string, element: string) {
        return apiClient.post<boolean, VremRequest>(
            '/api/redis/command/vrem',
            { keyName, element }
        );
    },

    async vemb(keyName: string, element: string) {
        return apiClient.post<number[], VembRequest>(
            '/api/redis/command/vemb',
            { keyName, element }
        );
    },

    async vadd(keyName: string, element: string, vector: number[]) {
        return apiClient.post<boolean, VaddRequest>(
            '/api/redis/command/vadd',
            { keyName, element, vector }
        );
    },

    async vlinks(keyName: string, element: string, count?: number, withEmbeddings?: boolean) {
        return apiClient.post<VectorTupleLevels, VlinksRequest>(
            '/api/redis/command/vlinks',
            { keyName, element, count, withEmbeddings }
        );
    },

    async vsim(
        keyName: string,
        searchVectorOrElement: number[] | string,
        count: number,
        withEmbeddings?: boolean
    ) {
        const request: VsimRequest = {
            keyName,
            count,
            withEmbeddings,
            ...(Array.isArray(searchVectorOrElement)
                ? { searchVector: searchVectorOrElement }
                : { searchElement: searchVectorOrElement })
        };

        return apiClient.post<VectorTuple[], VsimRequest>(
            '/api/redis/command/vsim',
            request
        );
    }
}; 