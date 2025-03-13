import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'redis';

const REDIS_CONFIG_KEY = 'vector-set-browser:config';
const DEFAULT_USER = 'default';

// Helper function to get Redis client
async function getRedisClient() {
    const client = createClient();
    await client.connect();
    return client;
}

// Helper function to get the full Redis key for user settings
function getUserSettingsKey(userId: string = DEFAULT_USER) {
    return `${REDIS_CONFIG_KEY}`;
}

export async function GET(
    request: NextRequest,
    { params }: { params: { keyname: string } }
) {
    try {
        const client = await getRedisClient();
        const settingsKey = getUserSettingsKey();
        
        // Get the specific setting if keyname is provided
        const value = await client.hGet(settingsKey, `setting:${params.keyname}`);
        await client.quit();

        if (!value) {
            return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
        }

        try {
            // Attempt to parse as JSON in case it's a complex value
            const parsed = JSON.parse(value);
            return NextResponse.json({ value: parsed });
        } catch {
            // If not JSON, return as is
            return NextResponse.json({ value });
        }
    } catch (error) {
        console.error('Error getting setting:', error);
        return NextResponse.json(
            { error: 'Failed to get setting' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { keyname: string } }
) {
    try {
        const body = await request.json();
        const { value } = body;

        if (value === undefined) {
            return NextResponse.json(
                { error: 'Value is required' },
                { status: 400 }
            );
        }
        const client = await getRedisClient();
        const settingsKey = getUserSettingsKey();
        
        // Store the value, converting objects/arrays to JSON strings
        const valueToStore = JSON.stringify(value);
        
        await client.hSet(settingsKey, `setting:${params.keyname}`, valueToStore);
        
        await client.quit();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error setting value:', error);
        return NextResponse.json(
            { error: 'Failed to set value' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { keyname: string } }
) {
    try {
        const client = await getRedisClient();
        const settingsKey = getUserSettingsKey();
        
        const deleted = await client.hDel(settingsKey, `setting:${params.keyname}`);
        await client.quit();

        if (!deleted) {
            return NextResponse.json(
                { error: 'Setting not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting setting:', error);
        return NextResponse.json(
            { error: 'Failed to delete setting' },
            { status: 500 }
        );
    }
} 