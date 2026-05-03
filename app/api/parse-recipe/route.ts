import OpenAI from "openai"
import { NextResponse } from "next/server"

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
})

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-chat-v3",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a strict recipe extraction engine.

Return valid JSON only.
No markdown.
No commentary.
No explanations.
Do not calculate nutrition.
Do not normalize units.
Do not convert units.
Do not drop ingredients.
          `.trim(),
        },
        {
          role: "user",
          content: `
Extract structured cooking data from the recipe below.

Return ONLY valid JSON in this exact shape:

{
  "title": string,
  "description": string,
  "servings": number | null,
  "ingredients": [
    {
      "original": string,
      "name": string,
      "quantity": number | null,
      "unit": string | null,
      "optional": boolean
    }
  ],
  "steps": string[]
}

Rules:
- Prefer the explicit Ingredients section over quantities repeated in the Method.
- Do not duplicate ingredients from the Method if they already appear in the Ingredients section.
- If the Method contains extra ingredients not present in the Ingredients section, include them.
- Keep total recipe quantities from the Ingredients section, not per-dish or per-serving quantities from the Method.
- Extract "Makes x 4", "Makes 4", "Serves 4", or "Yield: 4" as servings = 4.
- Quantity must be numeric when present.
- Convert simple fractions to decimals, for example 1/2 becomes 0.5.
- Preserve the original unit from the recipe where possible.
- Allowed common units include: g, kg, ml, l, tsp, tbsp, cup, cups, tin, tins, can, cans, pcs, cloves.
- If a unit is unclear, use null.
- If a quantity is unclear, use null.
- Preserve descriptors in the name, such as dry, cooked, chopped, sliced, frozen, breast, lean, low fat.
- Correct obvious spelling mistakes in names, for example "mozarella" becomes "mozzarella".
- Mark ingredients after "Optional:" as optional = true.
- Do not include prices in ingredient names.
- Do not include calories or macros from the recipe text.
- Steps should be concise and ordered.

Recipe:
${text}
          `.trim(),
        },
      ],
    })

    let raw = completion.choices[0].message.content || ""

    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim()

    const parsed = JSON.parse(raw)

    return NextResponse.json(parsed)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}