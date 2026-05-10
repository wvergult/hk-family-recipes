import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { calculateMacros } from "@/lib/nutrition/calculateMacros"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function roundCalories(value: number) {
  return Math.round(value)
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

function getServingCount(recipe: any) {
  const raw =
    recipe.base_servings ??
    recipe.servings ??
    recipe.target_servings ??
    recipe.number_of_servings ??
    1

  const value = Number(raw)

  if (!Number.isFinite(value) || value <= 0) {
    return 1
  }

  return value
}

function mapCalculatedIngredient(recipeId: string, ingredient: any) {
  return {
    recipe_id: recipeId,

    name: ingredient.name,
    quantity: ingredient.quantity,
    unit: ingredient.unit,

    normalized_name: ingredient.normalized_name,
    grams_normalized: ingredient.grams_normalized,

    calories: ingredient.calories || 0,
    protein: ingredient.protein || 0,
    carbs: ingredient.carbs || 0,
    fat: ingredient.fat || 0,

    normalization_status: ingredient.normalization_status,
    nutrition_status: ingredient.nutrition_status,

    fdc_id: ingredient.fdc_id,
    usda_description: ingredient.usda_description,
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    /**
     * Simple safety switch so you do not accidentally run this.
     * Call the endpoint with:
     * { "confirm": "RECALCULATE_ALL_RECIPES" }
     */
    if (body.confirm !== "RECALCULATE_ALL_RECIPES") {
      return NextResponse.json(
        {
          error:
            "Missing confirmation. Send { confirm: 'RECALCULATE_ALL_RECIPES' }",
        },
        { status: 400 }
      )
    }

    const { data: recipes, error: recipesError } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: true })

    if (recipesError) {
      throw recipesError
    }

    const results: any[] = []

    for (const recipe of recipes || []) {
      const recipeId = recipe.id

      try {
        const { data: existingIngredients, error: ingredientsError } =
        await supabase
            .from("ingredients")
            .select("*")
            .eq("recipe_id", recipeId)

        if (ingredientsError) {
          throw ingredientsError
        }

        const inputIngredients = (existingIngredients || []).map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        }))

        if (inputIngredients.length === 0) {
          results.push({
            recipe_id: recipeId,
            title: recipe.title,
            status: "skipped",
            reason: "No ingredients",
          })

          continue
        }

        const recalculated = await calculateMacros(inputIngredients)

        const calculatedIngredients = recalculated.ingredients || []

        const totalCalories = roundCalories(recalculated.totals.calories || 0)
        const totalProtein = roundMacro(recalculated.totals.protein || 0)
        const totalCarbs = roundMacro(recalculated.totals.carbs || 0)
        const totalFat = roundMacro(recalculated.totals.fat || 0)

        const servings = getServingCount(recipe)

        const caloriesPerServing = roundCalories(totalCalories / servings)
        const proteinPerServing = roundMacro(totalProtein / servings)
        const carbsPerServing = roundMacro(totalCarbs / servings)
        const fatPerServing = roundMacro(totalFat / servings)

        const { error: deleteError } = await supabase
          .from("ingredients")
          .delete()
          .eq("recipe_id", recipeId)

        if (deleteError) {
          throw deleteError
        }

        const rowsToInsert = calculatedIngredients.map((ingredient) =>
          mapCalculatedIngredient(recipeId, ingredient)
        )

        const { error: insertError } = await supabase
          .from("ingredients")
          .insert(rowsToInsert)

        if (insertError) {
          throw insertError
        }

        const { error: recipeUpdateError } = await supabase
          .from("recipes")
          .update({
            total_calories: totalCalories,
            total_protein: totalProtein,
            total_carbs: totalCarbs,
            total_fat: totalFat,
            calories_per_serving: caloriesPerServing,
            protein_per_serving: proteinPerServing,
            carbs_per_serving: carbsPerServing,
            fat_per_serving: fatPerServing,
          })
          .eq("id", recipeId)

        if (recipeUpdateError) {
          throw recipeUpdateError
        }

        results.push({
          recipe_id: recipeId,
          title: recipe.title,
          status: "updated",
          ingredient_count: rowsToInsert.length,
          servings,
          totals: {
            calories: totalCalories,
            protein: totalProtein,
            carbs: totalCarbs,
            fat: totalFat,
          },
          per_serving: {
            calories: caloriesPerServing,
            protein: proteinPerServing,
            carbs: carbsPerServing,
            fat: fatPerServing,
          },
        })
      } catch (error: any) {
        results.push({
          recipe_id: recipeId,
          title: recipe.title,
          status: "failed",
          error: error.message || String(error),
        })
      }
    }

    return NextResponse.json({
      success: true,
      total_recipes: recipes?.length || 0,
      updated: results.filter((result) => result.status === "updated").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      results,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to recalculate recipes",
      },
      { status: 500 }
    )
  }
}