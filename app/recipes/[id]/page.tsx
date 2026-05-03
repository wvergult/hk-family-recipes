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

interface EditableIngredient {
  name: string
  quantity: string
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

interface RecalculatedRecipe {
  ingredients: RecalculatedIngredient[]
  total_calories: number
  total_protein: number
  total_carbs: number
  total_fat: number
  calories_per_serving: number
  protein_per_serving: number
  carbs_per_serving: number
  fat_per_serving: number
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
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [baseServings, setBaseServings] = useState(1)

  // This controls how many servings the saved recipe is divided into
  const [selectedServings, setSelectedServings] = useState(1)

  // This controls how many portions you actually want to cook
  const [targetServings, setTargetServings] = useState(1)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editableIngredients, setEditableIngredients] = useState<
    EditableIngredient[]
  >([])
  const [editableBaseServings, setEditableBaseServings] = useState(1)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const fetchData = async () => {
    const { data: recipe } = await supabase
      .from("recipes")
      .select(
        "title, description, base_servings, steps, source_url, image_url"
      )
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
      setImageUrl(recipe.image_url || null)
      setBaseServings(servings)
      setSelectedServings(servings)
      setTargetServings(servings)
    }

    if (ingredientData) {
      setIngredients(ingredientData)
    }
  }

  useEffect(() => {
    fetchData()
  }, [recipeId])

  const startEditing = () => {
    setEditableIngredients(
      ingredients.map((ing) => ({
        name: ing.name,
        quantity: String(ing.quantity),
        unit: ing.unit || "",
      }))
    )

    setEditableBaseServings(baseServings)
    setImagePreviewUrl(imageUrl)
    setNewImageFile(null)
    setStatusMessage("")
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setEditableIngredients([])
    setEditableBaseServings(baseServings)
    setImagePreviewUrl(null)
    setNewImageFile(null)
    setStatusMessage("")
    setIsEditing(false)
  }

  const updateEditableIngredient = (
    index: number,
    field: keyof EditableIngredient,
    value: string
  ) => {
    const updated = [...editableIngredients]

    updated[index] = {
      ...updated[index],
      [field]: value,
    }

    setEditableIngredients(updated)
  }

  const addIngredient = () => {
    setEditableIngredients([
      ...editableIngredients,
      {
        name: "",
        quantity: "",
        unit: "",
      },
    ])
  }

  const removeIngredient = (index: number) => {
    setEditableIngredients(editableIngredients.filter((_, i) => i !== index))
  }

  const handleImageFile = (file: File) => {
    setNewImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  const handleImageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]

    if (!file) return

    handleImageFile(file)
  }

  const handlePasteImage = (event: React.ClipboardEvent<HTMLDivElement>) => {
    if (!isEditing) return

    const items = event.clipboardData.items

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile()

        if (file) {
          handleImageFile(file)
          setStatusMessage("Image pasted. Save changes to update the recipe.")
        }

        break
      }
    }
  }

  const uploadRecipeImage = async () => {
    if (!newImageFile) return imageUrl

    const fileExtension = newImageFile.name.split(".").pop() || "png"
    const filePath = `${recipeId}/${Date.now()}.${fileExtension}`

    const { error: uploadError } = await supabase.storage
      .from("recipe-images")
      .upload(filePath, newImageFile, {
        cacheControl: "3600",
        upsert: true,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    const { data } = supabase.storage
      .from("recipe-images")
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const saveChanges = async () => {
    setSaving(true)
    setStatusMessage("Saving changes and recalculating macros...")

    try {
      const cleanedIngredients = editableIngredients
        .map((ing) => ({
          name: ing.name.trim(),
          quantity: Number(ing.quantity),
          unit: ing.unit.trim(),
        }))
        .filter((ing) => ing.name && !Number.isNaN(ing.quantity))

      if (cleanedIngredients.length === 0) {
        throw new Error("Please add at least one ingredient.")
      }

      if (!editableBaseServings || editableBaseServings < 1) {
        throw new Error("Servings must be at least 1.")
      }

      const updatedImageUrl = await uploadRecipeImage()

      const response = await fetch("/api/recalculate-recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipeId,
          title,
          description,
          steps,
          baseServings: editableBaseServings,
          ingredients: cleanedIngredients,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.error || "Could not recalculate recipe macros."
        )
      }

      const recalculatedRecipe =
        (await response.json()) as RecalculatedRecipe

      const { error: deleteError } = await supabase
        .from("ingredients")
        .delete()
        .eq("recipe_id", recipeId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const ingredientsToInsert = recalculatedRecipe.ingredients.map((ing) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        calories: ing.calories,
        protein: ing.protein,
        carbs: ing.carbs,
        fat: ing.fat,
      }))

      const { data: insertedIngredients, error: insertError } = await supabase
        .from("ingredients")
        .insert(ingredientsToInsert)
        .select("*")

      if (insertError) {
        throw new Error(insertError.message)
      }

      const { error: recipeUpdateError } = await supabase
        .from("recipes")
        .update({
          image_url: updatedImageUrl,
          base_servings: editableBaseServings,
          total_calories: recalculatedRecipe.total_calories,
          total_protein: recalculatedRecipe.total_protein,
          total_carbs: recalculatedRecipe.total_carbs,
          total_fat: recalculatedRecipe.total_fat,
          calories_per_serving: recalculatedRecipe.calories_per_serving,
          protein_per_serving: recalculatedRecipe.protein_per_serving,
          carbs_per_serving: recalculatedRecipe.carbs_per_serving,
          fat_per_serving: recalculatedRecipe.fat_per_serving,
        })
        .eq("id", recipeId)

      if (recipeUpdateError) {
        throw new Error(recipeUpdateError.message)
      }

      setImageUrl(updatedImageUrl)
      setBaseServings(editableBaseServings)
      setSelectedServings(editableBaseServings)
      setTargetServings(editableBaseServings)
      setIngredients(insertedIngredients || [])
      setEditableIngredients([])
      setNewImageFile(null)
      setImagePreviewUrl(null)
      setIsEditing(false)
      setStatusMessage("Recipe updated.")
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong."

      setStatusMessage(`Error: ${message}`)
    } finally {
      setSaving(false)
    }
  }

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
    <main
      className="min-h-screen bg-neutral-50 text-black px-6 py-12"
      onPaste={handlePasteImage}
    >
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Top Image */}
        {(imageUrl || imagePreviewUrl || isEditing) && (
          <div className="bg-white rounded-3xl p-4 shadow-sm space-y-4">
            {(imagePreviewUrl || imageUrl) ? (
              <img
                src={imagePreviewUrl || imageUrl || ""}
                alt={title}
                className="w-full max-h-[520px] object-cover rounded-2xl"
              />
            ) : (
              <div className="w-full h-80 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
                No image yet
              </div>
            )}

            {isEditing && (
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <label className="inline-flex justify-center cursor-pointer bg-black text-white rounded-full px-5 py-2 text-sm hover:opacity-80 transition">
                  Change Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageInputChange}
                    className="hidden"
                  />
                </label>

                <p className="text-sm text-neutral-500">
                  You can also paste an image anywhere on this page while
                  editing.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Title Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <Link
              href="/"
              className="text-sm text-neutral-500 hover:text-black transition"
            >
              ← Back to Recipes
            </Link>

            {!isEditing ? (
              <button
                onClick={startEditing}
                className="bg-black text-white rounded-full px-5 py-2 text-sm hover:opacity-80 transition"
              >
                Edit Recipe
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={cancelEditing}
                  disabled={saving}
                  className="bg-neutral-200 text-black rounded-full px-5 py-2 text-sm hover:opacity-80 transition disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="bg-black text-white rounded-full px-5 py-2 text-sm hover:opacity-80 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>

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

            {statusMessage && (
              <p className="text-sm text-neutral-500 mt-4">
                {statusMessage}
              </p>
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
              disabled={isEditing}
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
              disabled={isEditing}
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
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">
                Ingredients
              </h2>

              {!isEditing ? (
                <p className="text-sm text-neutral-500 mt-2">
                  Adjusted for {targetServings} portion
                  {targetServings === 1 ? "" : "s"}.
                </p>
              ) : (
                <p className="text-sm text-neutral-500 mt-2">
                  Edit ingredients below. Macros will recalculate when you save.
                </p>
              )}
            </div>

            {isEditing && (
              <button
                onClick={addIngredient}
                disabled={saving}
                className="bg-neutral-100 text-black rounded-full px-5 py-2 text-sm hover:bg-neutral-200 transition disabled:opacity-50"
              >
                + Add Ingredient
              </button>
            )}
          </div>

          {!isEditing ? (
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
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-neutral-500 mb-2">
                  Original recipe servings
                </label>

                <input
                  type="number"
                  min="1"
                  value={editableBaseServings}
                  onChange={(e) =>
                    setEditableBaseServings(Number(e.target.value))
                  }
                  className="w-full md:w-40 border border-neutral-200 rounded-2xl px-4 py-3 text-sm"
                />
              </div>

              <div className="space-y-4">
                {editableIngredients.map((ing, index) => (
                  <div
                    key={index}
                    className="border border-neutral-200 rounded-2xl p-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                      <input
                        value={ing.name}
                        onChange={(e) =>
                          updateEditableIngredient(
                            index,
                            "name",
                            e.target.value
                          )
                        }
                        placeholder="Ingredient name"
                        className="md:col-span-3 border border-neutral-200 rounded-xl px-4 py-3 text-sm"
                      />

                      <input
                        type="number"
                        value={ing.quantity}
                        onChange={(e) =>
                          updateEditableIngredient(
                            index,
                            "quantity",
                            e.target.value
                          )
                        }
                        placeholder="Qty"
                        className="md:col-span-1 border border-neutral-200 rounded-xl px-4 py-3 text-sm"
                      />

                      <input
                        value={ing.unit}
                        onChange={(e) =>
                          updateEditableIngredient(
                            index,
                            "unit",
                            e.target.value
                          )
                        }
                        placeholder="Unit"
                        className="md:col-span-1 border border-neutral-200 rounded-xl px-4 py-3 text-sm"
                      />

                      <button
                        onClick={() => removeIngredient(index)}
                        disabled={saving}
                        className="md:col-span-1 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm hover:bg-red-100 transition disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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