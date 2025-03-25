import { cookies } from 'next/headers';

const OPENAI_KEY_COOKIE = 'openai_api_key';

export async function getOpenAIKey(): Promise<string | null> {
    const apiKey = (await cookies()).get(OPENAI_KEY_COOKIE)?.value;
    return apiKey || null;
} 