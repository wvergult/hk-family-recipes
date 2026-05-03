import { NextResponse } from "next/server"
import { calculateMacros } from "../../../lib/nutrition/calculateMacros"

function roundCalories(value: number) {
  return Math.round(value)
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
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

    const cleanedIngredients = ingredients
      .map((ingredient: any) => ({
        name: String(ingredient.name || "").trim(),
        quantity: ingredient.quantity,
        unit: String(ingredient.unit || "").trim(),
      }))
      .filter((ingredient: any) => ingredient.name)

    if (cleanedIngredients.length === 0) {
      return NextResponse.json(
        { error: "At least one valid ingredient is required." },
        { status: 400 }
      )
    }

    const result = await calculateMacros(cleanedIngredients)

    const totalCalories = result.totals.calories
    const totalProtein = result.totals.protein
    const totalCarbs = result.totals.carbs
    const totalFat = result.totals.fat

    return NextResponse.json({
      ingredients: result.ingredients,

      total_calories: totalCalories,
      total_protein: totalProtein,
      total_carbs: totalCarbs,
      total_fat: totalFat,

      calories_per_serving: roundCalories(totalCalories / servings),
      protein_per_serving: roundMacro(totalProtein / servings),
      carbs_per_serving: roundMacro(totalCarbs / servings),
      fat_per_serving: roundMacro(totalFat / servings),
    })
  } catch (error: any) {
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