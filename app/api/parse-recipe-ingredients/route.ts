import OpenAI from "openai"
import { NextResponse } from "next/server"

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
})

interface ParsedIngredient {
  original?: string
  name: string
  quantity: number | null
  unit: string | null
  optional?: boolean
}

interface ParsedIngredientsResponse {
  servings: number | null
  ingredients: ParsedIngredient[]
}

export async function POST(req: Request) {
  try {
    const { title, text } = await req.json()

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Recipe text is required." },
        { status: 400 }
      )
    }

    const completion = await client.chat.completions.create({
      model: "deepseek/deepseek-chat-v3",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a strict recipe ingredient extraction engine.

Return valid JSON only.
No markdown.
No commentary.
No explanations.
Do not calculate nutrition.
Do not normalize units.
Do not convert units.
Do not drop ingredients.
Extract ingredients only.
          `.trim(),
        },
        {
          role: "user",
          content: `
Extract ONLY the recipe ingredients from the recipe text below.

Return ONLY valid JSON in this exact shape:

{
  "servings": number | null,
  "ingredients": [
    {
      "original": string,
      "name": string,
      "quantity": number | null,
      "unit": string | null,
      "optional": boolean
    }
  ]
}

Rules:
- Extract ingredients only.
- Do not return title.
- Do not return description.
- Do not return steps.
- Prefer the explicit Ingredients section over quantities repeated in the Method.
- Do not duplicate ingredients from the Method if they already appear in the Ingredients section.
- If the Method contains extra ingredients not present in the Ingredients section, include them.
- Keep total recipe quantities from the Ingredients section, not per-dish or per-serving quantities from the Method.
- Extract "Makes x 4", "Makes 4", "Serves 4", or "Yield: 4" as servings = 4.
- Quantity must be numeric when present.
- Convert simple fractions to decimals, for example 1/2 becomes 0.5.
- Convert mixed fractions to decimals, for example 1 1/2 becomes 1.5.
- For ranges like 2-3, use the larger number.
- Preserve the original unit from the recipe where possible.
- Do not normalize units.
- Do not convert units.
- Allowed common units include: g, kg, ml, l, tsp, tbsp, cup, cups, tin, tins, can, cans, pcs, cloves, clove, oz, lb, packet, packets, bunch, bunches, slice, slices.
- If a unit is unclear, use null.
- If a quantity is unclear, use null.
- Preserve descriptors in the name, such as dry, cooked, chopped, sliced, frozen, breast, lean, low fat.
- Correct obvious spelling mistakes in names, for example "mozarella" becomes "mozzarella".
- Mark ingredients after "Optional:" as optional = true.
- Do not include prices in ingredient names.
- Do not include calories or macros from the recipe text.
- Do not include equipment.
- Do not include headings as ingredients.
- Do not include serving suggestions unless they are clearly part of the recipe.
- If the text contains ingredient groups, flatten them into one ingredients array.
- The "original" field should contain the original ingredient line if available.
- The "name" field should not include the numeric quantity or unit.

Current saved recipe title:
${typeof title === "string" ? title : ""}

Recipe text:
${text}
          `.trim(),
        },
      ],
    })

    let raw = completion.choices[0].message.content || ""

    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim()

    const parsed = JSON.parse(raw) as ParsedIngredientsResponse

    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients
          .filter((ingredient) => ingredient?.name)
          .map((ingredient) => ({
            original: ingredient.original
              ? String(ingredient.original).trim()
              : "",
            name: String(ingredient.name).trim(),
            quantity:
              typeof ingredient.quantity === "number"
                ? ingredient.quantity
                : ingredient.quantity === null
                ? null
                : Number(ingredient.quantity),
            unit: ingredient.unit ? String(ingredient.unit).trim() : null,
            optional: Boolean(ingredient.optional),
          }))
      : []

    return NextResponse.json({
      base_servings:
        typeof parsed.servings === "number" && parsed.servings > 0
          ? parsed.servings
          : null,
      ingredients,
    })
  } catch (error: any) {
    console.error("Ingredient re-parse error:", error)

    return NextResponse.json(
      { error: error.message || "Could not parse ingredients." },
      { status: 500 }
    )
  }
}