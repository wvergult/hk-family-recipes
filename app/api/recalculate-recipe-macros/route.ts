import OpenAI from "openai"
import { NextResponse } from "next/server"
import {
  calculateMacroTotals,
  calculatePerServing,
  roundCalories,
  roundMacro,
} from "@/lib/nutrition/macroTotals"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface IncomingIngredient {
  name: string
  quantity: number
  unit: string
}

interface RecalculatedIngredient {
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const ingredients = body.ingredients as IncomingIngredient[] | undefined
    const servings = Number(body.servings || 1)

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json(
        { error: "No ingredients provided." },
        { status: 400 }
      )
    }

    const prompt = `
You are a nutrition calculator.

Estimate macros for each ingredient.

Return ONLY valid JSON in this exact shape:

{
  "ingredients": [
    {
      "name": "ingredient name",
      "quantity": 100,
      "unit": "g",
      "calories": 100,
      "protein": 10,
      "carbs": 5,
      "fat": 2
    }
  ]
}

Rules:
- calories are kcal.
- protein, carbs, and fat are grams.
- Use the provided ingredient names, quantities, and units.
- If unsure, make a reasonable nutrition estimate.
- Do not include markdown.
- Do not include explanations.

Ingredients:
${JSON.stringify(ingredients, null, 2)}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
    })

    const content = completion.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: "No macro data returned." },
        { status: 500 }
      )
    }

    const cleanedContent = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()

    const parsed = JSON.parse(cleanedContent)

    const recalculatedIngredients: RecalculatedIngredient[] =
      parsed.ingredients.map((ing: any) => ({
        name: String(ing.name || ""),
        quantity: Number(ing.quantity || 0),
        unit: String(ing.unit || ""),
        calories: roundCalories(Number(ing.calories || 0)),
        protein: roundMacro(Number(ing.protein || 0)),
        carbs: roundMacro(Number(ing.carbs || 0)),
        fat: roundMacro(Number(ing.fat || 0)),
      }))

    const totals = calculateMacroTotals(recalculatedIngredients)
    const perServing = calculatePerServing(totals, servings)

    return NextResponse.json({
      ingredients: recalculatedIngredients,

      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,

      calories_per_serving: perServing.calories,
      protein_per_serving: perServing.protein,
      carbs_per_serving: perServing.carbs,
      fat_per_serving: perServing.fat,
    })
  } catch (error) {
    console.error("Recalculate recipe error:", error)

    return NextResponse.json(
      { error: "Failed to recalculate recipe macros." },
      { status: 500 }
    )
  }
}