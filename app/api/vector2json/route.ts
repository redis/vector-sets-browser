import { writeFile, mkdir } from 'fs/promises'
import { NextResponse } from 'next/server'
import path from 'path'
import { existsSync } from 'fs'

export async function POST(request: Request) {
    try {
        console.log('[vector2json] Received request to save vector data')
        const { data, filename } = await request.json()
        
        if (!data || !filename) {
            console.error('[vector2json] Missing required data or filename')
            return NextResponse.json(
                { error: 'Missing required data or filename' },
                { status: 400 }
            )
        }

        console.log(`[vector2json] Saving data to file: ${filename}`)
        console.log(`[vector2json] Data length: ${Array.isArray(data) ? data.length : 'not an array'}`)

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename)
        const publicDir = path.join(process.cwd(), 'public', 'exports')
        const filePath = path.join(publicDir, sanitizedFilename)

        // Ensure the exports directory exists
        if (!existsSync(publicDir)) {
            console.log(`[vector2json] Creating directory: ${publicDir}`)
            await mkdir(publicDir, { recursive: true })
        }
        
        // Save the file
        await writeFile(filePath, JSON.stringify(data, null, 2))
        console.log(`[vector2json] Successfully saved file to: ${filePath}`)
        
        // Return the public URL path
        const publicPath = `/exports/${sanitizedFilename}`
        console.log(`[vector2json] Public access path: ${publicPath}`)
        
        return NextResponse.json({ 
            success: true,
            filePath: publicPath
        })
    } catch (error) {
        console.error('[vector2json] Error saving vector data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json(
            { 
                error: 'Failed to save vector data',
                details: errorMessage
            },
            { status: 500 }
        )
    }
} 