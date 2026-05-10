"use client"

import { useEffect, useState } from "react"
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

const IMAGE_BUCKET = "recipe-images"

export default function AdminPage() {
  const router = useRouter()

  const [rawText, setRawText] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState("")
  const [status, setStatus] = useState("")

  const [sourceUrl, setSourceUrl] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageError, setImageError] = useState("")
  const [imageUploading, setImageUploading] = useState(false)

  const [servings, setServings] = useState(4)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [totals, setTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  })

  const uploadImageFile = async (file: File) => {
    setImageUploading(true)
    setImageError("")
    setStatus("Uploading pasted screenshot...")

    try {
      const fileExt = file.type.split("/")[1] || "png"
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${fileExt}`
      const filePath = `admin-uploads/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(filePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        setImageError("Image upload failed: " + uploadError.message)
        setStatus("❌ Image upload failed.")
        return
      }

      const { data } = supabase.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(filePath)

      if (!data.publicUrl) {
        setImageError("Could not get public image URL.")
        setStatus("❌ Could not get public image URL.")
        return
      }

      setImageUrl(data.publicUrl)
      setStatus("✅ Screenshot uploaded!")
    } catch {
      setImageError("Something went wrong while uploading the screenshot.")
      setStatus("❌ Screenshot upload failed.")
    } finally {
      setImageUploading(false)
    }
  }

  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items

      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          event.preventDefault()

          const file = item.getAsFile()

          if (!file) {
            setImageError("Could not read pasted image.")
            return
          }

          await uploadImageFile(file)
          return
        }
      }
    }

    window.addEventListener("paste", handlePaste)

    return () => {
      window.removeEventListener("paste", handlePaste)
    }
  }, [])

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
    let finalImageUrl = imageUrl.trim() || null

    if (!finalImageUrl) {
      setStatus("Fetching fallback image...")

      const imageRes = await fetch("/api/get-recipe-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })

      const imageData = await imageRes.json()
      finalImageUrl = imageData.imageUrl || null
    }

    setStatus("Saving recipe...")

    const { data, error } = await supabase
      .from("recipes")
      .insert([
        {
          title,
          description,
          steps,
          image_url: finalImageUrl,
          source_url: sourceUrl.trim() || null,
          base_servings: servings,
          total_calories: Math.round(totals.calories),
          total_protein: Number(totals.protein.toFixed(1)),
          total_carbs: Number(totals.carbs.toFixed(1)),
          total_fat: Number(totals.fat.toFixed(1)),
          calories_per_serving: Math.round(totals.calories / servings),
          protein_per_serving: Number((totals.protein / servings).toFixed(1)),
          carbs_per_serving: Number((totals.carbs / servings).toFixed(1)),
          fat_per_serving: Number((totals.fat / servings).toFixed(1)),
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

    setRawText("")
    setTitle("")
    setDescription("")
    setSteps("")
    setSourceUrl("")
    setImageUrl("")
    setImageError("")
    setIngredients([])
    setTotals({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
    setServings(4)

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
          <div>
            <label className="block text-sm font-medium mb-2">
              Recipe text
            </label>

            <textarea
              className="w-full border border-neutral-200 rounded-xl p-4 h-40"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste the recipe text here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Original recipe URL
            </label>

            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/..."
              className="w-full border border-neutral-200 rounded-xl p-4"
            />

            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-sm text-blue-600 underline break-all"
              >
                Open source URL
              </a>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Image URL
            </label>

            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image URL or paste a screenshot below"
              className="w-full border border-neutral-200 rounded-xl p-4"
            />

            <div className="mt-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-sm text-neutral-500">
              {imageUploading ? (
                <span>Uploading pasted screenshot...</span>
              ) : (
                <span>
                  Screenshot image: copy a screenshot, click anywhere on this
                  page, then press <strong>Ctrl+V</strong> or{" "}
                  <strong>Cmd+V</strong>.
                </span>
              )}
            </div>

            {imageError && (
              <p className="text-sm text-red-600 mt-2">
                {imageError}
              </p>
            )}

            {imageUrl && (
              <div className="mt-4">
                <img
                  src={imageUrl}
                  alt="Recipe preview"
                  className="w-full max-h-80 object-cover rounded-2xl border border-neutral-200"
                />
              </div>
            )}

            <p className="text-xs text-neutral-500 mt-2">
              If this is blank, the app will use the Unsplash fallback image
              when saving.
            </p>
          </div>

          <button
            onClick={parseRecipe}
            disabled={imageUploading}
            className="bg-black text-white px-5 py-2 rounded-full text-sm hover:opacity-80 transition disabled:opacity-40"
          >
            Parse with AI
          </button>
        </div>

        {ingredients.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-medium">
              Ingredients
            </h2>

            {title && (
              <div>
                <div className="text-sm text-neutral-500">
                  Title
                </div>
                <div className="text-lg font-medium">
                  {title}
                </div>
              </div>
            )}

            {description && (
              <div>
                <div className="text-sm text-neutral-500">
                  Description
                </div>
                <p className="text-neutral-700">
                  {description}
                </p>
              </div>
            )}

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
          disabled={ingredients.length === 0 || imageUploading}
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