import { NextResponse } from "next/server"
import { calculateMacros } from "@/lib/nutrition/calculateMacros"
import {
  calculateMacroTotals,
  calculatePerServing,
} from "@/lib/nutrition/macroTotals"

interface IncomingIngredient {
  name: string
  quantity: number | string | null
  unit: string | null
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const servings = Number(
      body.servings || body.baseServings || body.base_servings || 1
    )

    const ingredients = body.ingredients || []

    if (!servings || Number.isNaN(servings) || servings < 1) {
      return NextResponse.json(
        { error: "Servings must be at least 1." },
        { status: 400 }
      )
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: "At least one ingredient is required." },
        { status: 400 }
      )
    }

    const cleanedIngredients: IncomingIngredient[] = ingredients
      .map((ingredient: any) => ({
        name: String(ingredient.name || "").trim(),
        quantity: ingredient.quantity,
        unit: String(ingredient.unit || "").trim(),
      }))
      .filter((ingredient: IncomingIngredient) => ingredient.name)

    if (cleanedIngredients.length === 0) {
      return NextResponse.json(
        { error: "At least one valid ingredient is required." },
        { status: 400 }
      )
    }

    const result = await calculateMacros(cleanedIngredients)

    const totals = calculateMacroTotals(result.ingredients)
    const perServing = calculatePerServing(totals, servings)

    return NextResponse.json({
      ingredients: result.ingredients,

      total_calories: totals.calories,
      total_protein: totals.protein,
      total_carbs: totals.carbs,
      total_fat: totals.fat,

      calories_per_serving: perServing.calories,
      protein_per_serving: perServing.protein,
      carbs_per_serving: perServing.carbs,
      fat_per_serving: perServing.fat,
    })
  } catch (error: any) {
    console.error("Recalculate recipe error:", error)

    return NextResponse.json(
      {
        error: error.message || "Failed to recalculate recipe.",
      },
      {
        status: 500,
      }
    )
  }
}