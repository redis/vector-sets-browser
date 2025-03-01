import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    // Only run on /vectorset route
    if (request.nextUrl.pathname === '/vectorset') {
        const connectionId = request.nextUrl.searchParams.get('cid')
        
        // If no connection ID is present, redirect to home
        if (!connectionId) {
            return NextResponse.redirect(new URL('/console', request.url))
        }

        // Add validation for connection ID format (assuming UUID format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(connectionId)) {
            return NextResponse.redirect(new URL('/console', request.url))
        }
    }
    
    return NextResponse.next()
} 