"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import Link from "next/link"

type TriedRating = "delicious" | "good" | "not_good" | null
type SectionTone = "neutral" | "yellow" | "green" | "blue" | "red"

interface Recipe {
  id: string
  title: string
  image_url: string | null
  base_servings?: number | null
  calories_per_serving?: number | null
  protein_per_serving?: number | null
  is_favourite?: boolean | null
  tried_rating?: TriedRating
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchRecipes()
  }, [])

  const fetchRecipes = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("recipes")
      .select(
        "id, title, image_url, base_servings, calories_per_serving, protein_per_serving, is_favourite, tried_rating, created_at"
      )
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Could not fetch recipes:", error)
      setLoading(false)
      return
    }

    if (data) {
      setRecipes(data)
    }

    setLoading(false)
  }

  const deleteRecipe = async (id: string) => {
    const confirmed = confirm("Delete this recipe?")
    if (!confirmed) return

    setDeletingId(id)

    const { error: ingredientDeleteError } = await supabase
      .from("ingredients")
      .delete()
      .eq("recipe_id", id)

    if (ingredientDeleteError) {
      console.error("Could not delete ingredients:", ingredientDeleteError)
      setDeletingId(null)
      return
    }

    const { error: recipeDeleteError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id)

    if (recipeDeleteError) {
      console.error("Could not delete recipe:", recipeDeleteError)
      setDeletingId(null)
      return
    }

    setRecipes((prev) => prev.filter((recipe) => recipe.id !== id))
    setDeletingId(null)
  }

  const toggleFavourite = async (
    id: string,
    currentValue?: boolean | null
  ) => {
    const nextValue = !currentValue

    console.log("Saving favourite:", { id, nextValue })

    const { data, error } = await supabase
      .from("recipes")
      .update({ is_favourite: nextValue })
      .eq("id", id)
      .select("id, is_favourite")
      .single()

    if (error) {
      console.error("Could not save favourite:", error)
      return
    }

    console.log("Favourite saved:", data)

    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === id
          ? {
              ...recipe,
              is_favourite: data.is_favourite,
            }
          : recipe
      )
    )
  }

  const setTriedRating = async (id: string, rating: TriedRating) => {
    const currentRecipe = recipes.find((recipe) => recipe.id === id)
    if (!currentRecipe) return

    const nextRating = currentRecipe.tried_rating === rating ? null : rating

    console.log("Saving rating:", { id, nextRating })

    const { data, error } = await supabase
      .from("recipes")
      .update({ tried_rating: nextRating })
      .eq("id", id)
      .select("id, tried_rating")
      .single()

    if (error) {
      console.error("Could not save rating:", error)
      return
    }

    console.log("Rating saved:", data)

    setRecipes((prev) =>
      prev.map((recipe) =>
        recipe.id === id
          ? {
              ...recipe,
              tried_rating: data.tried_rating as TriedRating,
            }
          : recipe
      )
    )
  }

  const favouriteRecipes = recipes.filter((recipe) => recipe.is_favourite)

  const deliciousRecipes = recipes.filter(
    (recipe) => recipe.tried_rating === "delicious"
  )

  const goodRecipes = recipes.filter(
    (recipe) => recipe.tried_rating === "good"
  )

  const notGoodRecipes = recipes.filter(
    (recipe) => recipe.tried_rating === "not_good"
  )

  const stillNeedToTryRecipes = recipes.filter(
    (recipe) => !recipe.tried_rating
  )

  const getSectionClasses = (tone: SectionTone) => {
    if (tone === "green") {
      return "bg-emerald-100 text-emerald-800"
    }

    if (tone === "blue") {
      return "bg-blue-100 text-blue-800"
    }

    if (tone === "red") {
      return "bg-red-100 text-red-800"
    }

    if (tone === "yellow") {
      return "bg-yellow-100 text-yellow-800"
    }

    return "bg-neutral-100 text-neutral-700"
  }

  const renderRecipeCard = (recipe: Recipe) => (
    <div
      key={recipe.id}
      className="group relative bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition duration-300"
    >
      <Link href={`/recipes/${recipe.id}`}>
        <div className="cursor-pointer">
          {recipe.image_url && (
            <div className="overflow-hidden">
              <img
                src={recipe.image_url}
                alt={recipe.title}
                className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
              />
            </div>
          )}

          <div className="p-8 space-y-5">
            <h2 className="text-xl font-medium tracking-tight pr-16">
              {recipe.title}
            </h2>

            <div className="flex flex-wrap gap-3">
              {recipe.base_servings && (
                <span className="text-xs bg-neutral-100 px-3 py-1 rounded-full text-neutral-600">
                  {recipe.base_servings} servings
                </span>
              )}

              {recipe.calories_per_serving && (
                <span className="text-xs bg-neutral-100 px-3 py-1 rounded-full text-neutral-600">
                  {recipe.calories_per_serving.toFixed(0)} kcal / serving
                </span>
              )}

              {recipe.protein_per_serving && (
                <span className="text-xs bg-neutral-100 px-3 py-1 rounded-full text-neutral-600">
                  {recipe.protein_per_serving.toFixed(1)}g protein
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => toggleFavourite(recipe.id, recipe.is_favourite)}
        className={`absolute top-5 left-5 rounded-full px-3 py-1 text-xs shadow-sm transition ${
          recipe.is_favourite
            ? "bg-yellow-400 text-black"
            : "bg-white/90 text-neutral-500 hover:text-black"
        }`}
      >
        {recipe.is_favourite ? "★ Favourite" : "☆ Favourite"}
      </button>

      <button
        type="button"
        onClick={() => deleteRecipe(recipe.id)}
        disabled={deletingId === recipe.id}
        className="absolute top-5 right-5 text-xs text-neutral-400 hover:text-red-500 transition"
      >
        {deletingId === recipe.id ? "Deleting…" : "Delete"}
      </button>

      <div className="px-8 pb-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTriedRating(recipe.id, "delicious")}
          className={`rounded-full px-3 py-1 text-xs transition ${
            recipe.tried_rating === "delicious"
              ? "bg-emerald-500 text-white"
              : "bg-neutral-100 text-neutral-500 hover:text-black"
          }`}
        >
          Delicious
        </button>

        <button
          type="button"
          onClick={() => setTriedRating(recipe.id, "good")}
          className={`rounded-full px-3 py-1 text-xs transition ${
            recipe.tried_rating === "good"
              ? "bg-blue-500 text-white"
              : "bg-neutral-100 text-neutral-500 hover:text-black"
          }`}
        >
          Good
        </button>

        <button
          type="button"
          onClick={() => setTriedRating(recipe.id, "not_good")}
          className={`rounded-full px-3 py-1 text-xs transition ${
            recipe.tried_rating === "not_good"
              ? "bg-red-500 text-white"
              : "bg-neutral-100 text-neutral-500 hover:text-black"
          }`}
        >
          Not good
        </button>
      </div>
    </div>
  )

  const renderRecipeSection = (
    title: string,
    sectionRecipes: Recipe[],
    tone: SectionTone
  ) => {
    if (sectionRecipes.length === 0) return null

    return (
      <section className="mb-16">
        <div
          className={`mb-8 rounded-3xl px-6 py-4 flex items-center justify-between ${getSectionClasses(
            tone
          )}`}
        >
          <h2 className="text-2xl font-medium tracking-tight">
            {title}
          </h2>

          <span className="text-sm font-medium">
            {sectionRecipes.length}
          </span>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {sectionRecipes.map(renderRecipeCard)}
        </div>
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-16">
          <h1 className="text-4xl font-semibold tracking-tight">
            HK Family Recipes
          </h1>

          <Link
            href="/admin-92fj3k"
            className="bg-black text-white px-5 py-2 rounded-full text-sm hover:opacity-80 transition"
          >
            Add Recipe
          </Link>
        </div>

        {loading && <p className="text-neutral-400 text-lg">Loading…</p>}

        {!loading && recipes.length === 0 && (
          <p className="text-neutral-400 text-lg">No recipes yet.</p>
        )}

        {!loading && recipes.length > 0 && (
          <>
            {renderRecipeSection("Favourites", favouriteRecipes, "neutral")}

            {renderRecipeSection("Delicious", deliciousRecipes, "green")}

            {renderRecipeSection("Good", goodRecipes, "blue")}

            {renderRecipeSection("Not good", notGoodRecipes, "red")}

            {renderRecipeSection(
              "Still need to try",
              stillNeedToTryRecipes,
              "yellow"
            )}
          </>
        )}
      </div>
    </main>
  )
}