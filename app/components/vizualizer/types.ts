export interface VLinkResponse {
    success: boolean
    result: Array<[string, number, number[]]>  // Array of levels, each containing array of [element, similarity, vector]
}

export interface VembResponse {
    success: boolean
    result: number[]
}
