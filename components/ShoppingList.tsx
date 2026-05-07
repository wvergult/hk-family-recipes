"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

type Ingredient = {
  id: string
  name: string
  amount: number | null
  unit: string | null
}

type ShoppingItem = {
  id: string
  recipe_id: string
  ingredient_id: string
  needed: boolean
  bought: boolean
  created_at?: string
  updated_at?: string
}

type ShoppingListRow = {
  ingredient: Ingredient
  shoppingItemId: string | null
  needed: boolean
  bought: boolean
}

type Props = {
  recipeId: string
  ingredients: Ingredient[]
  shoppingItems: ShoppingItem[]
}

function formatQuantity(quantity: number | null) {
  if (quantity === null) return ""

  if (quantity >= 100) {
    return quantity.toFixed(0)
  }

  if (quantity >= 10) {
    return quantity.toFixed(1).replace(/\.0$/, "")
  }

  return quantity.toFixed(2).replace(/\.00$/, "").replace(/0$/, "")
}

export function ShoppingList({
  recipeId,
  ingredients,
  shoppingItems,
}: Props) {
  const buildRows = () => {
    return ingredients.map((ingredient) => {
      const existing = shoppingItems.find(
        (shoppingItem) => shoppingItem.ingredient_id === ingredient.id
      )

      return {
        ingredient,
        shoppingItemId: existing?.id ?? null,
        needed: existing?.needed ?? false,
        bought: existing?.bought ?? false,
      }
    })
  }

  const [items, setItems] = useState<ShoppingListRow[]>(buildRows)

  useEffect(() => {
    setItems(buildRows())
  }, [ingredients, shoppingItems])

  async function updateShoppingItem(
    ingredient: Ingredient,
    updates: {
      needed?: boolean
      bought?: boolean
    }
  ) {
    const current = items.find(
      (item) => item.ingredient.id === ingredient.id
    )

    if (!current) return

    const nextNeeded = updates.needed ?? current.needed
    const nextBought = updates.bought ?? current.bought

    setItems((prev) =>
      prev.map((item) =>
        item.ingredient.id === ingredient.id
          ? {
              ...item,
              needed: nextNeeded,
              bought: nextBought,
            }
          : item
      )
    )

    try {
      const payload = {
        recipe_id: recipeId,
        ingredient_id: ingredient.id,
        needed: nextNeeded,
        bought: nextBought,
        updated_at: new Date().toISOString(),
      }

      const { data, error } = await supabase
        .from("recipe_shopping_items")
        .upsert(payload, {
          onConflict: "recipe_id,ingredient_id",
        })
        .select("*")
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setItems((prev) =>
          prev.map((item) =>
            item.ingredient.id === ingredient.id
              ? {
                  ...item,
                  shoppingItemId: data.id,
                  needed: data.needed,
                  bought: data.bought,
                }
              : item
          )
        )
      }
    } catch (error) {
      console.error("Shopping list update failed:", error)

      setItems((prev) =>
        prev.map((item) =>
          item.ingredient.id === ingredient.id
            ? {
                ...item,
                needed: current.needed,
                bought: current.bought,
              }
            : item
        )
      )
    }
  }

  const neededItems = items.filter((item) => item.needed)
  const stillNeedItems = neededItems.filter((item) => !item.bought)
  const boughtItems = neededItems.filter((item) => item.bought)

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">Shopping list</h2>
        <p className="text-sm text-zinc-400">
          Select ingredients you still need to buy, then tick them off once
          bought.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const ingredient = item.ingredient

          return (
            <div
              key={ingredient.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3"
            >
              <div>
                <p
                  className={
                    item.bought
                      ? "font-medium text-zinc-500 line-through"
                      : "font-medium text-white"
                  }
                >
                  {ingredient.name}
                </p>

                <p className="text-sm text-zinc-400">
                  {formatQuantity(ingredient.amount)} {ingredient.unit ?? ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={item.needed}
                    onChange={(event) => {
                      const checked = event.target.checked

                      updateShoppingItem(ingredient, {
                        needed: checked,
                        bought: checked ? item.bought : false,
                      })
                    }}
                  />
                  Need
                </label>

                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={item.bought}
                    disabled={!item.needed}
                    onChange={(event) => {
                      updateShoppingItem(ingredient, {
                        bought: event.target.checked,
                      })
                    }}
                  />
                  Bought
                </label>
              </div>
            </div>
          )
        })}
      </div>

      {neededItems.length > 0 && (
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 font-semibold text-white">Current list</h3>

          {stillNeedItems.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-semibold text-zinc-300">
                Still need
              </p>

              <ul className="space-y-1 text-sm text-zinc-200">
                {stillNeedItems.map((item) => (
                  <li key={item.ingredient.id}>
                    {formatQuantity(item.ingredient.amount)}{" "}
                    {item.ingredient.unit ?? ""} {item.ingredient.name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {boughtItems.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-zinc-300">
                Bought
              </p>

              <ul className="space-y-1 text-sm text-zinc-500">
                {boughtItems.map((item) => (
                  <li
                    key={item.ingredient.id}
                    className="line-through"
                  >
                    {formatQuantity(item.ingredient.amount)}{" "}
                    {item.ingredient.unit ?? ""} {item.ingredient.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}