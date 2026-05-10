import OpenAI from "openai"
import { NextResponse } from "next/server"
import {
  calculateMacroTotals,
  calculatePerServing,
  roundCalories,
  roundMacro,
} from "@/lib/nutrition/macroTotals"

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
})

function stripCodeFences(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const num = Number(value)

  if (!Number.isFinite(num)) {
    return null
  }

  return num
}

function cleanIngredient(ingredient: any) {
  const confidence = ["high", "medium", "low"].includes(ingredient?.confidence)
    ? ingredient.confidence
    : "medium"

  return {
    original: String(ingredient?.original || ""),
    name: String(ingredient?.name || ""),
    quantity: nullableNumber(ingredient?.quantity),
    unit:
      ingredient?.unit === null || ingredient?.unit === undefined
        ? null
        : String(ingredient.unit),
    optional: Boolean(ingredient?.optional),

    estimated_grams: nullableNumber(ingredient?.estimated_grams),

    calories: roundCalories(Number(ingredient?.calories || 0)),
    protein: roundMacro(Number(ingredient?.protein || 0)),
    carbs: roundMacro(Number(ingredient?.carbs || 0)),
    fat: roundMacro(Number(ingredient?.fat || 0)),

    confidence,
    calculation_basis:
      ingredient?.calculation_basis === null ||
      ingredient?.calculation_basis === undefined
        ? null
        : String(ingredient.calculation_basis),
    notes:
      ingredient?.notes === null || ingredient?.notes === undefined
        ? null
        : String(ingredient.notes),
  }
}

async function analyzeWithAI(text: string) {
  const completion = await client.chat.completions.create({
    model: "deepseek/deepseek-chat-v3",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are a strict recipe nutrition estimation engine.

Return valid JSON only.
No markdown.
No commentary.
No explanations.

You may estimate nutrition when exact brand data is unavailable.
Use common real-world nutrition values.
Prefer practical cooking assumptions over database-literal assumptions.
Do not omit ingredients.
Do not invent ingredients.
Do not include prices.
If the recipe already contains claimed calories or macros, ignore them unless they are clearly from a nutrition label for a packaged ingredient.
        `.trim(),
      },
      {
        role: "user",
        content: `
Analyze the recipe below.

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
      "optional": boolean,
      "estimated_grams": number | null,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "confidence": "high" | "medium" | "low",
      "calculation_basis": string | null,
      "notes": string | null
    }
  ],
  "steps": string[]
}

Rules:
- Prefer the explicit Ingredients section over quantities repeated in the Method.
- Do not duplicate ingredients from the Method if they already appear in Ingredients.
- If the Method contains extra ingredients not present in Ingredients, include them.
- Keep total recipe quantities from the Ingredients section, not per-dish or per-serving quantities from the Method.
- Extract "Makes x 4", "Makes 4", "Serves 4", or "Yield: 4" as servings = 4.
- If servings are unclear, use null.
- Quantity must be numeric when present.
- Convert simple fractions to decimals, for example 1/2 becomes 0.5.
- Preserve the original unit from the recipe where possible.
- Estimate grams using common cooking assumptions when needed.
- Use raw vs cooked state from the recipe where stated.
- Preserve descriptors in the name, such as dry, cooked, chopped, sliced, frozen, breast, lean, low fat.
- Correct obvious spelling mistakes in names, for example "mozarella" becomes "mozzarella".
- Mark ingredients after "Optional:" as optional = true.
- Seasonings with no quantity such as salt, pepper, herbs, and spices may be estimated as 0 calories.
- Cooking spray with no quantity may be estimated as 0 to 10 calories.
- Water should be 0 calories.
- Round calories to nearest whole number.
- Round protein, carbs, and fat to 1 decimal place.
- Ingredient macros must be for the full listed ingredient amount, not per 100g.
- Steps should be concise and ordered.

Recipe:
${text}
        `.trim(),
      },
    ],
  })

  const raw = stripCodeFences(completion.choices[0].message.content || "")
  return JSON.parse(raw)
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing recipe text" },
        { status: 400 }
      )
    }

    const parsed = await analyzeWithAI(text)

    const ingredients = Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map(cleanIngredient)
      : []

    const servings = nullableNumber(parsed.servings)

const totals = calculateMacroTotals(ingredients)

    const perServing = servings
      ? calculatePerServing(totals, servings)
      : {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
        }

    return NextResponse.json({
      title: String(parsed.title || ""),
      description: String(parsed.description || ""),
      servings,
      ingredients,
      totals,
      per_serving: perServing,
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.map((step: any) => String(step))
        : [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}