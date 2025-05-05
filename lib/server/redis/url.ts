/**
 * Sanitizes a Redis URL by hiding the password component.
 * @param url The Redis URL to sanitize
 * @returns The sanitized URL with password hidden
 */
export function sanitizeRedisUrl(url: string): string {
    try {
        const parsedUrl = new URL(url)
        if (parsedUrl.password) {
            parsedUrl.password = '****'
        }
        return parsedUrl.toString()
    } catch (error) {
        // If URL parsing fails, return the original URL
        return url
    }
} 