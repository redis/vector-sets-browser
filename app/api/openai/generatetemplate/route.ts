import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import {
    EmbeddingTemplateResponseObject,
    EmbeddingTemplateRequestBody,
} from "../../openai"

// Initialize the OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
    try {
        const { columns, sampleRows } =
            (await request.json()) as EmbeddingTemplateRequestBody

        if (!columns || !sampleRows) {
            return NextResponse.json(
                { error: "Prompt is required" },
                { status: 400 }
            )
        }

        let userPrompt = `This CSV file contains the following columns:`
        for (const column of columns) {
            userPrompt += `\n- ${column}`
        }
        userPrompt += `\n\nHere is some sample data from the CSV:`
        for (const row of sampleRows) {
            userPrompt += `\n${row}`
        }

        // Call OpenAI API with structured output
        const completion = await openai.beta.chat.completions.parse({
            model: "gpt-4o-2024-08-06",
            messages: [
                {
                    role: "system",
                    content:
                        "Generate template strings for embedding data. An example would be: 'A movie titled ${title} was released in ${year} by ${director} with the tagline ${tagline}.' I will provide you with a list of columns and some sample data from a CSV. You have to generate two templates: one for the element name and one for the embedding using the column references. Wrap the column references in ${} syntax.  Element name must be short. picking either a single column that would be predicted to be unique, or a combination of columns that would be unique. For example for a movie title, element name might be: '${title} (${year})'",
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            response_format: zodResponseFormat(
                EmbeddingTemplateResponseObject,
                "template"
            ),
        })

        // Parse the content as JSON
        const content = completion.choices[0]?.message?.parsed

        return NextResponse.json(content)
    } catch (error) {
        console.error("Error calling OpenAI:", error)
        return NextResponse.json(
            { error: "Failed to generate template" },
            { status: 500 }
        )
    }
}
