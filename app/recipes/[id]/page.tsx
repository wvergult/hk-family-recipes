"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"
import Link from "next/link"
import { ShoppingList } from "../../../components/ShoppingList"

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

interface ShoppingItem {
  id: string
  recipe_id: string
  ingredient_id: string
  needed: boolean
  bought: boolean
  created_at?: string
  updated_at?: string
}

interface EditableIngredient {
  name: string
  quantity: string
  unit: string
}

interface RecalculatedIngredient {
  name: string
  quantity: number | string | null
  unit: string | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
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

interface SavedRecipeMacros {
  total_calories: number | null
  total_protein: number | null
  total_carbs: number | null
  total_fat: number | null
  calories_per_serving: number | null
  protein_per_serving: number | null
  carbs_per_serving: number | null
  fat_per_serving: number | null
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
      quantity,
      unit: "tbsp",
    }
  }

  if (
    normalizedUnit === "tsp" ||
    normalizedUnit === "teaspoon" ||
    normalizedUnit === "teaspoons"
  ) {
    return {
      quantity,
      unit: "tsp",
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

function roundCalories(value: number) {
  return Math.round(value)
}

function roundMacro(value: number) {
  return Number(value.toFixed(1))
}

function valuesAreClose(
  currentValue: number | null | undefined,
  nextValue: number,
  tolerance = 0.05
) {
  if (currentValue === null || currentValue === undefined) return false

  return Math.abs(Number(currentValue) - nextValue) <= tolerance
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
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [updatingShoppingItemNames, setUpdatingShoppingItemNames] = useState<
    string[]
  >([])
  const [baseServings, setBaseServings] = useState(1)

  const [savedRecipeMacros, setSavedRecipeMacros] =
    useState<SavedRecipeMacros | null>(null)

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
        "title, description, base_servings, steps, source_url, image_url, total_calories, total_protein, total_carbs, total_fat, calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving"
      )
      .eq("id", recipeId)
      .single()

    const { data: ingredientData } = await supabase
      .from("ingredients")
      .select("*")
      .eq("recipe_id", recipeId)

    const { data: shoppingItemData } = await supabase
      .from("recipe_shopping_items")
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

      setSavedRecipeMacros({
        total_calories: recipe.total_calories,
        total_protein: recipe.total_protein,
        total_carbs: recipe.total_carbs,
        total_fat: recipe.total_fat,
        calories_per_serving: recipe.calories_per_serving,
        protein_per_serving: recipe.protein_per_serving,
        carbs_per_serving: recipe.carbs_per_serving,
        fat_per_serving: recipe.fat_per_serving,
      })
    }

    if (ingredientData) {
      setIngredients(ingredientData)
    }

    if (shoppingItemData) {
      setShoppingItems(shoppingItemData)
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

  const getShoppingItemForIngredient = (ingredientId: string) => {
    return shoppingItems.find((item) => item.ingredient_id === ingredientId)
  }

  const isIngredientNeeded = (ingredientId: string) => {
    const existingItem = getShoppingItemForIngredient(ingredientId)

    return existingItem?.needed === true
  }

  const toggleIngredientShoppingItem = async (
    ingredient: Ingredient,
    checked: boolean
  ) => {
    const ingredientId = ingredient.id
    const existingItem = getShoppingItemForIngredient(ingredientId)

    if (updatingShoppingItemNames.includes(ingredientId)) return

    setUpdatingShoppingItemNames((current) => [...current, ingredientId])
    setStatusMessage("Updating shopping list...")

    const tempId = `temp-${ingredientId}`

    setShoppingItems((currentItems) => {
      if (existingItem) {
        return currentItems.map((item) =>
          item.id === existingItem.id
            ? {
                ...item,
                needed: checked,
              }
            : item
        )
      }

      return [
        ...currentItems,
        {
          id: tempId,
          recipe_id: recipeId,
          ingredient_id: ingredientId,
          needed: checked,
          bought: false,
        },
      ]
    })

    try {
      if (existingItem) {
        const { data, error } = await supabase
          .from("recipe_shopping_items")
          .update({
            needed: checked,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItem.id)
          .select("*")
          .single()

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error("Supabase update returned no data.")
        }

        setShoppingItems((currentItems) =>
          currentItems.map((item) =>
            item.id === existingItem.id ? data : item
          )
        )
      } else {
        const { data, error } = await supabase
          .from("recipe_shopping_items")
          .insert({
            recipe_id: recipeId,
            ingredient_id: ingredientId,
            needed: checked,
            bought: false,
          })
          .select("*")
          .single()

        if (error) {
          throw error
        }

        if (!data) {
          throw new Error("Supabase insert returned no data.")
        }

        setShoppingItems((currentItems) =>
          currentItems.map((item) => (item.id === tempId ? data : item))
        )
      }

      setStatusMessage(
        checked ? "Added to shopping list." : "Removed from shopping list."
      )
    } catch (error) {
      console.error("Shopping item toggle failed:", error)

      await fetchData()

      const message =
        error instanceof Error ? error.message : JSON.stringify(error, null, 2)

      setStatusMessage(`Shopping list error:\n${message}`)
    } finally {
      setUpdatingShoppingItemNames((current) =>
        current.filter((id) => id !== ingredientId)
      )
    }
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
          servings: editableBaseServings,
          ingredients: cleanedIngredients,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(
          errorData?.error || "Could not recalculate recipe macros."
        )
      }

      const recalculatedRecipe = (await response.json()) as RecalculatedRecipe

      const { error: deleteError } = await supabase
        .from("ingredients")
        .delete()
        .eq("recipe_id", recipeId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      const ingredientsToInsert = recalculatedRecipe.ingredients.map(
        (ing: RecalculatedIngredient) => ({
          recipe_id: recipeId,
          name: ing.name,
          quantity: Number(ing.quantity) || 0,
          unit: ing.unit || "",
          calories: ing.calories || 0,
          protein: ing.protein || 0,
          carbs: ing.carbs || 0,
          fat: ing.fat || 0,
        })
      )

      const { data: insertedIngredients, error: insertError } = await supabase
        .from("ingredients")
        .insert(ingredientsToInsert)
        .select("*")

      if (insertError) {
        throw new Error(insertError.message)
      }

      const nextSavedRecipeMacros = {
        total_calories: recalculatedRecipe.total_calories,
        total_protein: recalculatedRecipe.total_protein,
        total_carbs: recalculatedRecipe.total_carbs,
        total_fat: recalculatedRecipe.total_fat,
        calories_per_serving: recalculatedRecipe.calories_per_serving,
        protein_per_serving: recalculatedRecipe.protein_per_serving,
        carbs_per_serving: recalculatedRecipe.carbs_per_serving,
        fat_per_serving: recalculatedRecipe.fat_per_serving,
      }

      const { error: recipeUpdateError } = await supabase
        .from("recipes")
        .update({
          image_url: updatedImageUrl,
          base_servings: editableBaseServings,
          ...nextSavedRecipeMacros,
        })
        .eq("id", recipeId)

      if (recipeUpdateError) {
        throw new Error(recipeUpdateError.message)
      }

      setImageUrl(updatedImageUrl)
      setBaseServings(editableBaseServings)
      setSelectedServings(editableBaseServings)
      setTargetServings(editableBaseServings)
      setSavedRecipeMacros(nextSavedRecipeMacros)
      setIngredients(insertedIngredients || [])
      setEditableIngredients([])
      setNewImageFile(null)
      setImagePreviewUrl(null)
      setIsEditing(false)
      setStatusMessage("Recipe updated.")

      await fetchData()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong."

      setStatusMessage(`Error: ${message}`)
    } finally {
      setSaving(false)
    }
  }

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

  const syncedCaloriesPerServing = roundCalories(
    originalTotalCalories / baseServings
  )
  const syncedProteinPerServing = roundMacro(originalTotalProtein / baseServings)
  const syncedCarbsPerServing = roundMacro(originalTotalCarbs / baseServings)
  const syncedFatPerServing = roundMacro(originalTotalFat / baseServings)

  const syncedTotalCalories = roundCalories(originalTotalCalories)
  const syncedTotalProtein = roundMacro(originalTotalProtein)
  const syncedTotalCarbs = roundMacro(originalTotalCarbs)
  const syncedTotalFat = roundMacro(originalTotalFat)

  useEffect(() => {
    const syncRecipeCardMacros = async () => {
      if (!recipeId || !savedRecipeMacros || ingredients.length === 0) return
      if (!baseServings || baseServings < 1) return
      if (isEditing || saving) return

      const nextMacros = {
        total_calories: syncedTotalCalories,
        total_protein: syncedTotalProtein,
        total_carbs: syncedTotalCarbs,
        total_fat: syncedTotalFat,
        calories_per_serving: syncedCaloriesPerServing,
        protein_per_serving: syncedProteinPerServing,
        carbs_per_serving: syncedCarbsPerServing,
        fat_per_serving: syncedFatPerServing,
      }

      const alreadySynced =
        valuesAreClose(savedRecipeMacros.total_calories, nextMacros.total_calories) &&
        valuesAreClose(savedRecipeMacros.total_protein, nextMacros.total_protein) &&
        valuesAreClose(savedRecipeMacros.total_carbs, nextMacros.total_carbs) &&
        valuesAreClose(savedRecipeMacros.total_fat, nextMacros.total_fat) &&
        valuesAreClose(
          savedRecipeMacros.calories_per_serving,
          nextMacros.calories_per_serving
        ) &&
        valuesAreClose(
          savedRecipeMacros.protein_per_serving,
          nextMacros.protein_per_serving
        ) &&
        valuesAreClose(
          savedRecipeMacros.carbs_per_serving,
          nextMacros.carbs_per_serving
        ) &&
        valuesAreClose(
          savedRecipeMacros.fat_per_serving,
          nextMacros.fat_per_serving
        )

      if (alreadySynced) return

      const { error } = await supabase
        .from("recipes")
        .update(nextMacros)
        .eq("id", recipeId)

      if (error) {
        console.error("Failed to sync recipe card macros:", error)
        return
      }

      setSavedRecipeMacros(nextMacros)
      console.log("Recipe card macros synced:", nextMacros)
    }

    syncRecipeCardMacros()
  }, [
    recipeId,
    savedRecipeMacros,
    ingredients.length,
    baseServings,
    isEditing,
    saving,
    syncedTotalCalories,
    syncedTotalProtein,
    syncedTotalCarbs,
    syncedTotalFat,
    syncedCaloriesPerServing,
    syncedProteinPerServing,
    syncedCarbsPerServing,
    syncedFatPerServing,
  ])

  const batchMultiplier = targetServings / baseServings

  const recipeTotalCalories = originalTotalCalories * batchMultiplier
  const recipeTotalProtein = originalTotalProtein * batchMultiplier
  const recipeTotalCarbs = originalTotalCarbs * batchMultiplier
  const recipeTotalFat = originalTotalFat * batchMultiplier

  const perServingCalories = recipeTotalCalories / targetServings
  const perServingProtein = recipeTotalProtein / targetServings
  const perServingCarbs = recipeTotalCarbs / targetServings
  const perServingFat = recipeTotalFat / targetServings

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
            {imagePreviewUrl || imageUrl ? (
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
              className="inline-flex items-center justify-center rounded-full border border-neutral-300 bg-white px-6 py-3 text-base font-medium text-black shadow-sm transition hover:bg-neutral-100"
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
            <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>

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
                <div className="text-sm text-neutral-500">Calories</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Protein</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Carbs</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {recipeTotalFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Fat</div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-200" />

          <div>
            <h2 className="text-sm text-neutral-500 mb-4">Per Portion</h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-medium">
                  {perServingCalories.toFixed(0)}
                </div>
                <div className="text-sm text-neutral-500">Calories</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Protein</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Carbs</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {perServingFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Fat</div>
              </div>
            </div>
          </div>

          <div className="border-t border-neutral-200" />

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
                <div className="text-sm text-neutral-500">Calories</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingProtein.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Protein</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingCarbs.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Carbs</div>
              </div>

              <div>
                <div className="text-2xl font-medium">
                  {dividedServingFat.toFixed(1)}g
                </div>
                <div className="text-sm text-neutral-500">Fat</div>
              </div>
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Ingredients</h2>

              {!isEditing ? (
                <p className="text-sm text-neutral-500 mt-2">
                  Tick ingredients to add them to your shopping list. Adjusted
                  for {targetServings} portion
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
                const checked = isIngredientNeeded(ing.id)
                const isUpdating = updatingShoppingItemNames.includes(ing.id)

                return (
                  <div
                    key={ing.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2 hover:bg-neutral-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isUpdating}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        toggleIngredientShoppingItem(ing, e.target.checked)
                      }
                      className="h-4 w-4 shrink-0 accent-black cursor-pointer disabled:cursor-wait disabled:opacity-50"
                    />

                    <span
                      className="cursor-pointer select-none"
                      onClick={() => {
                        if (!isUpdating) {
                          toggleIngredientShoppingItem(ing, !checked)
                        }
                      }}
                    >
                      {formatQuantity(metric.quantity)} {metric.unit}{" "}
                      {ing.name}
                    </span>
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

        {!isEditing && (
          <ShoppingList
            recipeId={recipeId}
            ingredients={ingredients.map((ing) => {
              const scaledQuantity = ing.quantity * batchMultiplier
              const metric = convertToMetric(scaledQuantity, ing.unit)

              return {
                id: ing.id,
                name: ing.name,
                amount: metric.quantity,
                unit: metric.unit || null,
              }
            })}
            shoppingItems={shoppingItems}
          />
        )}

        {/* Preparation */}
        {stepList.length > 0 && (
          <div className="bg-white rounded-3xl p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-semibold">Preparation</h2>

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
            <h2 className="text-2xl font-semibold">Original Source</h2>

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