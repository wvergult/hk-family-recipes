"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import Link from "next/link"

interface Recipe {
  id: string
  title: string
  image_url: string
  base_servings?: number
  calories_per_serving?: number
  protein_per_serving?: number
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

    const { data } = await supabase
      .from("recipes")
      .select("*")
      .order("created_at", { ascending: false })

    if (data) setRecipes(data)

    setLoading(false)
  }

  const deleteRecipe = async (id: string) => {
    const confirmed = confirm("Delete this recipe?")
    if (!confirmed) return

    setDeletingId(id)

    await supabase.from("ingredients").delete().eq("recipe_id", id)
    await supabase.from("recipes").delete().eq("id", id)

    setRecipes((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-black px-6 py-12">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
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

        {loading && (
          <p className="text-neutral-400 text-lg">Loading…</p>
        )}

        {!loading && recipes.length === 0 && (
          <p className="text-neutral-400 text-lg">
            No recipes yet.
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-12">
          {recipes.map((recipe) => (
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
                    <h2 className="text-xl font-medium tracking-tight">
                      {recipe.title}
                    </h2>

                    {/* Macro Pills */}
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

              {/* Subtle Delete */}
              <button
                onClick={() => deleteRecipe(recipe.id)}
                disabled={deletingId === recipe.id}
                className="absolute top-5 right-5 text-xs text-neutral-400 hover:text-red-500 transition"
              >
                {deletingId === recipe.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}