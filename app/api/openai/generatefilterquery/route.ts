import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getOpenAIKey } from "@/app/api/openai"

export interface FilterQueryRequestBody {
    query: string
    attributes?: string[]
}

export async function POST(request: NextRequest) {
    try {
        const { query, attributes } =
            (await request.json()) as FilterQueryRequestBody

        if (!query) {
            return NextResponse.json(
                { error: "Query is required" },
                { status: 400 }
            )
        }

        // Get user-provided API key from headers if available
        const userApiKey =
            request.headers.get("X-OpenAI-Key") || (await getOpenAIKey())

        // Initialize the OpenAI client with user key or fallback to env
        const openai = new OpenAI({
            apiKey: userApiKey || process.env.OPENAI_API_KEY,
        })

        // Build the system prompt
        let systemPrompt = `Convert the following natural language query to a Redis vector filter expression. 

        only return the filter expression, nothing else. 
        
##Filter syntax rules:
1. Arithmetic operators: +, -, *, /, % (modulo), ** (exponentiation)
2. Comparison operators: >, >=, <, <=, ==, !=
3. Logical operators: and/&&, or/||, !/not
4. Containment operator: in
5. Grouping: use parentheses (...) to group expressions clearly
6. Use dot notation to access attributes: .attributeName
7. Only use attributes provided in *Available attributes* (listed below)

This is critical: The only valid syntax are the 7 rules listed above.

It is important that the filter query is a valid query that complies with the above syntax.

You can get creative with the filter query, for example if the user asks for "recent movies", you can use the .createdAt attribute to generate a filter query and pick a recent date. Or if the user asks for biggest companies, you can take a guess as what that might mean, and put a number in the filter query.  For example: .revenue > (a big number like 100000) The numbers you choose should be realistic given the context of the query and the name of the attribute field.
You cannot use any other syntax or functions which are not expressed above (like MAX, MIN, etc.). You may not include a query with an attribute that is not explicity listed below.
`

        // Add available attributes if provided
        if (attributes && attributes.length > 0) {
            systemPrompt += `\n\n##Available attributes: ${attributes.join(
                ", "
            )}`

            // Add examples using the actual attributes
            systemPrompt += `\n\n##Examples:`

            systemPrompt += `\n\nGeneric Examples:
- "Movies from the 80s" → .year >= 1980 and .year < 1990
- "Action movies with rating above 8" → .genre == "action" and .rating > 8.0
- "Movies by Spielberg or Nolan" → .director in ["Spielberg", "Nolan"]
- "Movies from around 2000 with good ratings" → (.year - 2000) ** 2 < 100 and .rating / 2 > 4`
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-2024-08-06",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: query,
                },
            ],
            max_tokens: 150,
            temperature: 0.2,
        })

        const filterQuery = completion.choices[0]?.message?.content?.trim()

        if (!filterQuery) {
            return NextResponse.json(
                { error: "Failed to generate filter query" },
                { status: 500 }
            )
        }

        return NextResponse.json({ filterQuery })
    } catch (error) {
        console.error("Error calling OpenAI:", error)
        return NextResponse.json(
            { error: "Failed to generate filter query" },
            { status: 500 }
        )
    }
}
