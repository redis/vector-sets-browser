import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const OPENAI_KEY_COOKIE = 'openai_api_key';
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

// Validate the OpenAI key by making a test request
async function validateApiKey(apiKey: string): Promise<boolean> {
    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    try {
        const { apiKey } = await request.json();
        
        if (!apiKey) {
            return NextResponse.json(
                { error: "API key is required" },
                { status: 400 }
            );
        }

        // Validate the API key first
        const isValid = await validateApiKey(apiKey);
        if (!isValid) {
            return NextResponse.json(
                { error: "Invalid OpenAI API key" },
                { status: 400 }
            );
        }

        // Set the cookie with the API key
        cookies().set(OPENAI_KEY_COOKIE, apiKey, COOKIE_OPTIONS);
        
        return NextResponse.json({ 
            success: true,
            message: "API key saved successfully"
        });
    } catch (error) {
        console.error("Error saving OpenAI API key:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to save API key" 
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const apiKey = cookies().get(OPENAI_KEY_COOKIE)?.value;
        
        if (!apiKey) {
            return NextResponse.json(
                { error: "No API key found" },
                { status: 404 }
            );
        }

        // We don't send the actual key back to the client
        return NextResponse.json({ 
            success: true,
            hasKey: true
        });
    } catch (error) {
        console.error("Error checking OpenAI API key:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to check API key" 
            },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    try {
        cookies().delete(OPENAI_KEY_COOKIE);
        return NextResponse.json({ 
            success: true,
            message: "API key removed successfully" 
        });
    } catch (error) {
        console.error("Error removing OpenAI API key:", error);
        return NextResponse.json(
            { 
                error: error instanceof Error ? error.message : "Failed to remove API key" 
            },
            { status: 500 }
        );
    }
} 