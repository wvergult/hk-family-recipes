"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "../../lib/supabase"
import Link from "next/link"

interface Ingredient {
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default function AdminPage() {
  const router = useRouter()

  const [rawText, setRawText] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState("")
  const [status, setStatus] = useState("")

  const [servings, setServings] = useState(4)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })

  const parseRecipe = async () => {
    setStatus("Parsing recipe...")

    const res = await fetch("/api/parse-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rawText }),
    })

    const data = await res.json()

    if (data.error) {
      setStatus("❌ " + data.error)
      return
    }

    setTitle(data.title || "")
    setDescription(data.description || "")
    setSteps(data.steps?.join("\n") || "")
    setServings(data.servings ?? 4)

    const parsedIngredients = (data.ingredients || []).map((ing: any) => ({
      ...ing,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }))

    setStatus("Calculating macros...")

    const macroRes = await fetch("/api/calculate-macros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients: parsedIngredients }),
    })

    const macroData = await macroRes.json()

    if (macroData.error) {
      setStatus("❌ " + macroData.error)
      return
    }

    setIngredients(macroData.ingredients)
    setTotals(macroData.totals)

    setStatus("✅ Parsed & macros calculated!")
  }

  const handleSubmit = async () => {
    setStatus("Fetching image...")

    const imageRes = await fetch("/api/get-recipe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })

    const imageData = await imageRes.json()
    const imageUrl = imageData.imageUrl || null

    setStatus("Saving recipe...")

    const { data, error } = await supabase
      .from("recipes")
      .insert([
        {
          title,
          description,
          steps,
          image_url: imageUrl,
          base_servings: servings,
          total_calories: totals.calories,
          total_protein: totals.protein,
          total_carbs: totals.carbs,
          total_fat: totals.fat,
          calories_per_serving: totals.calories / servings,
          protein_per_serving: totals.protein / servings,
          carbs_per_serving: totals.carbs / servings,
          fat_per_serving: totals.fat / servings,
        },
      ])
      .select()
      .single()

    if (error || !data) {
      setStatus("❌ Recipe insert error: " + error?.message)
      return
    }

    const recipeId = data.id

    if (ingredients.length > 0) {
      const rows = ingredients.map((ing) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        calories: ing.calories,
        protein: ing.protein,
        carbs: ing.carbs,
        fat: ing.fat,
      }))

      const { error: ingredientError } = await supabase
        .from("ingredients")
        .insert(rows)

      if (ingredientError) {
        setStatus("❌ Ingredient insert error: " + ingredientError.message)
        return
      }
    }

    setStatus("✅ Recipe saved successfully!")

    router.push("/")
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-12">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            New Recipe
          </h1>

          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-black transition"
          >
            ← Back
          </Link>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          <textarea
            className="w-full border border-neutral-200 rounded-xl p-4 h-40"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <button
            onClick={parseRecipe}
            className="bg-black text-white px-5 py-2 rounded-full text-sm hover:opacity-80 transition"
          >
            Parse with AI
          </button>
        </div>

        {ingredients.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-medium">
              Ingredients
            </h2>

            <div className="space-y-2 text-neutral-600">
              {ingredients.map((ing, i) => (
                <div key={i}>
                  • {ing.name} — {ing.quantity} {ing.unit}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6 text-center pt-6">
              <div>
                <div className="text-xl font-medium">
                  {totals.calories.toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">
                  Total Calories
                </div>
              </div>

              <div>
                <div className="text-xl font-medium">
                  {totals.protein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Total Protein
                </div>
              </div>

              <div>
                <div className="text-xl font-medium">
                  {(totals.calories / servings).toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">
                  Calories / Serving
                </div>
              </div>

              <div>
                <div className="text-xl font-medium">
                  {(totals.protein / servings).toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">
                  Protein / Serving
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={ingredients.length === 0}
          className="w-full bg-black text-white rounded-full py-3 text-sm hover:opacity-80 transition disabled:opacity-40"
        >
          Save Recipe
        </button>

        {status && (
          <p className="text-sm text-neutral-500">
            {status}
          </p>
        )}
      </div>
    </main>
  )
}