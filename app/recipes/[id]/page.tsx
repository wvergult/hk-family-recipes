"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"
import Link from "next/link"

interface Ingredient {
  id: string
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

function convertToMetric(quantity: number, unit: string | null) {
  const normalizedUnit = unit?.toLowerCase().trim() || ""

  if (
    normalizedUnit === "g" ||
    normalizedUnit === "gram" ||
    normalizedUnit === "grams"
  ) {
    return {
      quantity,
      unit: "g",
    }
  }

  if (
    normalizedUnit === "kg" ||
    normalizedUnit === "kilogram" ||
    normalizedUnit === "kilograms"
  ) {
    return {
      quantity: quantity * 1000,
      unit: "g",
    }
  }

  if (
    normalizedUnit === "oz" ||
    normalizedUnit === "ounce" ||
    normalizedUnit === "ounces"
  ) {
    return {
      quantity: quantity * 28.3495,
      unit: "g",
    }
  }

  if (
    normalizedUnit === "lb" ||
    normalizedUnit === "lbs" ||
    normalizedUnit === "pound" ||
    normalizedUnit === "pounds"
  ) {
    return {
      quantity: quantity * 453.592,
      unit: "g",
    }
  }

  if (
    normalizedUnit === "ml" ||
    normalizedUnit === "milliliter" ||
    normalizedUnit === "milliliters"
  ) {
    return {
      quantity,
      unit: "ml",
    }
  }

  if (
    normalizedUnit === "l" ||
    normalizedUnit === "liter" ||
    normalizedUnit === "liters" ||
    normalizedUnit === "litre" ||
    normalizedUnit === "litres"
  ) {
    return {
      quantity: quantity * 1000,
      unit: "ml",
    }
  }

  if (
    normalizedUnit === "fl oz" ||
    normalizedUnit === "fluid ounce" ||
    normalizedUnit === "fluid ounces"
  ) {
    return {
      quantity: quantity * 29.5735,
      unit: "ml",
    }
  }

  if (normalizedUnit === "cup" || normalizedUnit === "cups") {
    return {
      quantity: quantity * 240,
      unit: "ml",
    }
  }

  if (
    normalizedUnit === "tbsp" ||
    normalizedUnit === "tablespoon" ||
    normalizedUnit === "tablespoons"
  ) {
    return {
      quantity: quantity * 15,
      unit: "ml",
    }
  }

  if (
    normalizedUnit === "tsp" ||
    normalizedUnit === "teaspoon" ||
    normalizedUnit === "teaspoons"
  ) {
    return {
      quantity: quantity * 5,
      unit: "ml",
    }
  }

  return {
    quantity,
    unit: unit || "",
  }
}

function formatQuantity(quantity: number) {
  if (quantity >= 100) {
    return quantity.toFixed(0)
  }

  if (quantity >= 10) {
    return quantity.toFixed(1).replace(/\.0$/, "")
  }

  return quantity.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
}

export default function RecipePage() {
  const params = useParams()
  const recipeId = params.id as string

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState("")
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [baseServings, setBaseServings] = useState(1)

  // This controls how many servings the saved recipe is divided into
  const [selectedServings, setSelectedServings] = useState(1)

  // This controls how many portions you actually want to cook
  const [targetServings, setTargetServings] = useState(1)

  useEffect(() => {
    const fetchData = async () => {
      const { data: recipe } = await supabase
        .from("recipes")
        .select("title, description, base_servings, steps, source_url")
        .eq("id", recipeId)
        .single()

      const { data: ingredientData } = await supabase
        .from("ingredients")
        .select("*")
        .eq("recipe_id", recipeId)

      if (recipe) {
        const servings = recipe.base_servings || 1

        setTitle(recipe.title)
        setDescription(recipe.description)
        setSteps(recipe.steps || "")
        setSourceUrl(recipe.source_url || null)
        setBaseServings(servings)
        setSelectedServings(servings)
        setTargetServings(servings)
      }

      if (ingredientData) {
        setIngredients(ingredientData)
      }
    }

    fetchData()
  }, [recipeId])

  // Original saved recipe totals
  const originalTotalCalories = ingredients.reduce(
    (sum, ing) => sum + ing.calories,
    0
  )

  const originalTotalProtein = ingredients.reduce(
    (sum, ing) => sum + ing.protein,
    0
  )

  const originalTotalCarbs = ingredients.reduce(
    (sum, ing) => sum + ing.carbs,
    0
  )

  const originalTotalFat = ingredients.reduce(
    (sum, ing) => sum + ing.fat,
    0
  )

  // Ingredient scaling for making a smaller or larger batch
  const batchMultiplier = targetServings / baseServings

  // Scaled total macros for the batch you are actually making
  const recipeTotalCalories = originalTotalCalories * batchMultiplier
  const recipeTotalProtein = originalTotalProtein * batchMultiplier
  const recipeTotalCarbs = originalTotalCarbs * batchMultiplier
  const recipeTotalFat = originalTotalFat * batchMultiplier

  // Macro profile per serving based on the batch you are making
  const perServingCalories = recipeTotalCalories / targetServings
  const perServingProtein = recipeTotalProtein / targetServings
  const perServingCarbs = recipeTotalCarbs / targetServings
  const perServingFat = recipeTotalFat / targetServings

  // Optional comparison if user wants to divide the batch differently
  const dividedServingCalories = recipeTotalCalories / selectedServings
  const dividedServingProtein = recipeTotalProtein / selectedServings
  const dividedServingCarbs = recipeTotalCarbs / selectedServings
  const dividedServingFat = recipeTotalFat / selectedServings

  const stepList = steps ? steps.split("\n").filter(Boolean) : []

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Title Section */}
        <div className="space-y-6">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-black transition"
          >
            ← Back to Recipes
          </Link>

          <div>
            <h1 className="text-4xl font-semibold tracking-tight">
              {title}
            </h1>

            <p className="text-neutral-500 text-lg leading-relaxed mt-4">
              {description}
            </p>

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex mt-5 bg-black text-white rounded-full px-5 py-2 text-sm hover:opacity-80 transition"
              >
                Open Original Source
              </a>
            )}
          </div>
        </div>

        {/* Macro Section */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-10">
          {/* Batch Size Slider */}
          <div>
            <label className="block text-sm text-neutral-500 mb-3">
              Make {targetServings} portion{targetServings === 1 ? "" : "s"}
            </label>

            <input
              type="range"
              min="1"
              max="10"
              value={targetServings}
              onChange={(e) => setTargetServings(Number(e.target.value))}
              className="w-full"
            />

            <p className="text-sm text-neutral-400 mt-2">
              This changes the ingredient quantities and total recipe macros.
            </p>
          </div>

          {/* Total Macros */}
          <div>
            <h2 className="text-sm text-neutral-500 mb-4">
              Total Macros for {targetServings} Portion
              {targetServings === 1 ? "" : "s"}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalCalories.toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">
                  Calories
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Protein
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Carbs
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Fat
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200" />

          {/* Per Serving */}
          <div>
            <h2 className="text-sm text-neutral-500 mb-4">
              Per Portion
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-medium">
                  {perServingCalories.toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">
                  Calories
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Protein
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Carbs
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Fat
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-200" />

          {/* Divide Slider */}
          <div>
            <label className="block text-sm text-neutral-500 mb-3">
              Or divide this batch into {selectedServings} serving
              {selectedServings === 1 ? "" : "s"}
            </label>

            <input
              type="range"
              min="1"
              max="10"
              value={selectedServings}
              onChange={(e) => setSelectedServings(Number(e.target.value))}
              className="w-full"
            />

            <p className="text-sm text-neutral-400 mt-2">
              This only changes the macro calculation per serving. It does not
              change the ingredients.
            </p>
          </div>

          {/* Divided Serving Macros */}
          <div>
            <h2 className="text-sm text-neutral-500 mb-4">
              If Divided Into {selectedServings} Serving
              {selectedServings === 1 ? "" : "s"}
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-medium">
                  {dividedServingCalories.toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">
                  Calories
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Protein
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Carbs
                </div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Fat
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">
              Ingredients
            </h2>

            <p className="text-sm text-neutral-500 mt-2">
              Adjusted for {targetServings} portion
              {targetServings === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="space-y-3 text-neutral-700">
            {ingredients.map((ing) => {
              const scaledQuantity = ing.quantity * batchMultiplier
              const metric = convertToMetric(scaledQuantity, ing.unit)

              return (
                <div key={ing.id}>
                  • {formatQuantity(metric.quantity)} {metric.unit} {ing.name}
                </div>
              )
            })}
          </div>
        </div>

        {/* Preparation */}
        {stepList.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-semibold">
              Preparation
            </h2>

            <div className="space-y-4 text-neutral-700">
              {stepList.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="text-neutral-400 font-medium">
                    {index + 1}.
                  </div>
                  <div>{step}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Original Source */}
        {sourceUrl && (
          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-4">
            <h2 className="text-2xl font-semibold">
              Original Source
            </h2>

            <p className="text-sm text-neutral-500">
              Revisit the original recipe or video here.
            </p>

            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-blue-600 underline break-all"
            >
              {sourceUrl}
            </a>
          </div>
        )}
      </div>
    </main>
  )
}