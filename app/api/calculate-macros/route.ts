import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type MacroSet = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

type GramResult = {
  grams: number | null
  normalization_status: "normalized" | "estimated" | "needs_review"
}

/**
 * Manual overrides for common ingredients where USDA often gives
 * a poor practical recipe match.
 *
 * Values are per 100g.
 */
const MANUAL_MACROS_PER_100G: Record<string, MacroSet> = {
  "chicken breast raw": {
    calories: 120,
    protein: 23,
    carbs: 0,
    fat: 2.6,
  },

  "pasta dry": {
    calories: 371,
    protein: 13,
    carbs: 75,
    fat: 1.5,
  },

  "tomatoes canned": {
    calories: 32,
    protein: 1.6,
    carbs: 5.6,
    fat: 0.3,
  },

  "mixed vegetables frozen": {
    calories: 55,
    protein: 3,
    carbs: 8,
    fat: 0.5,
  },

  "mozzarella": {
    calories: 280,
    protein: 18,
    carbs: 2,
    fat: 22,
  },

  "chorizo": {
    calories: 346,
    protein: 24,
    carbs: 2,
    fat: 27,
  },

  "jalapeno peppers": {
    calories: 29,
    protein: 0.9,
    carbs: 6.5,
    fat: 0.4,
  },

  "garlic": {
    calories: 149,
    protein: 6.4,
    carbs: 33,
    fat: 0.5,
  },

  "red chili peppers": {
    calories: 40,
    protein: 1.9,
    carbs: 9,
    fat: 0.4,
  },

  "water": {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  },
}

const NAME_OVERRIDES: Record<string, string> = {
  mozarella: "mozzarella",
  mozzarella: "mozzarella",

  "lazy garlic": "garlic",

  "lazy chilli": "red chili peppers",
  "lazy chili": "red chili peppers",
  chilli: "red chili peppers",
  chili: "red chili peppers",

  "chopped tomatoes": "tomatoes canned",
  "tin chopped tomatoes": "tomatoes canned",
  "tinned chopped tomatoes": "tomatoes canned",
  "canned chopped tomatoes": "tomatoes canned",
  "canned tomatoes": "tomatoes canned",

  "mixed frozen veg": "mixed vegetables frozen",
  "mixed frozen vegetables": "mixed vegetables frozen",
  "frozen mixed veg": "mixed vegetables frozen",
  "frozen mixed vegetables": "mixed vegetables frozen",

  "pasta dry weight": "pasta dry",
  "dry pasta": "pasta dry",
  pasta: "pasta dry",

  "sliced chorizo": "chorizo",
  chorizo: "chorizo",

  "chicken breast": "chicken breast raw",
  "raw chicken breast": "chicken breast raw",

  jalapeños: "jalapeno peppers",
  jalapenos: "jalapeno peppers",

  water: "water",
}

const MASS_UNITS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
}

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  litre: 1000,
  litres: 1000,

  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,

  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,

  cup: 240,
  cups: 240,
}

const DENSITY_G_PER_ML: Record<string, number> = {
  water: 1,

  garlic: 0.5,
  "lazy garlic": 0.5,

  chilli: 0.9,
  chili: 0.9,
  "lazy chilli": 0.9,
  "lazy chili": 0.9,
  "red chili peppers": 0.9,

  "olive oil": 0.91,
  oil: 0.91,
}

const PIECE_WEIGHTS_G: Record<string, number> = {
  egg: 50,
  onion: 150,
  "red onion": 150,
  tomato: 120,
  tomatoes: 120,
  garlic: 3,
  "garlic clove": 3,

  /**
   * UK-style tins/cans of chopped tomatoes are usually 400g.
   */
  "chopped tomatoes:tin": 400,
  "chopped tomatoes:tins": 400,
  "chopped tomatoes:can": 400,
  "chopped tomatoes:cans": 400,

  "tomatoes canned:tin": 400,
  "tomatoes canned:tins": 400,
  "tomatoes canned:can": 400,
  "tomatoes canned:cans": 400,
}

function cleanName(name: string) {
  return String(name || "")
    .toLowerCase()
    .replace(/[£$€]\s?\d+(\.\d+)?/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\bboneless\b|\bskinless\b|\bfresh\b|\bgrated\b|\bminced\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeName(name: string) {
  const cleaned = cleanName(name)

  if (NAME_OVERRIDES[cleaned]) {
    return NAME_OVERRIDES[cleaned]
  }

  for (const key of Object.keys(NAME_OVERRIDES)) {
    if (cleaned.includes(key)) {
      return NAME_OVERRIDES[key]
    }
  }

  return cleaned
}

function findDensity(name: string) {
  const cleaned = cleanName(name)
  const normalized = normalizeName(name)

  if (DENSITY_G_PER_ML[cleaned]) {
    return {
      density: DENSITY_G_PER_ML[cleaned],
      matched: true,
    }
  }

  if (DENSITY_G_PER_ML[normalized]) {
    return {
      density: DENSITY_G_PER_ML[normalized],
      matched: true,
    }
  }

  const key = Object.keys(DENSITY_G_PER_ML).find(
    (k) => cleaned.includes(k) || normalized.includes(k)
  )

  if (key) {
    return {
      density: DENSITY_G_PER_ML[key],
      matched: true,
    }
  }

  return {
    density: 1,
    matched: false,
  }
}

function findPieceWeight(name: string, unit: string) {
  const cleaned = cleanName(name)
  const normalized = normalizeName(name)
  const u = unit.toLowerCase().trim()

  const keysToTry = [
    `${cleaned}:${u}`,
    `${normalized}:${u}`,
  ]

  for (const key of keysToTry) {
    if (PIECE_WEIGHTS_G[key]) {
      return {
        grams: PIECE_WEIGHTS_G[key],
        matched: true,
      }
    }
  }

  const key = Object.keys(PIECE_WEIGHTS_G).find(
    (k) => cleaned.includes(k) || normalized.includes(k)
  )

  if (key) {
    return {
      grams: PIECE_WEIGHTS_G[key],
      matched: true,
    }
  }

  return {
    grams: null,
    matched: false,
  }
}

function convertToGrams(
  quantity: number | null,
  unit: string | null,
  name: string
): GramResult {
  if (quantity === null || quantity === undefined || !unit) {
    return {
      grams: null,
      normalization_status: "needs_review",
    }
  }

  const numericQuantity = Number(quantity)

  if (Number.isNaN(numericQuantity) || numericQuantity < 0) {
    return {
      grams: null,
      normalization_status: "needs_review",
    }
  }

  const u = unit.toLowerCase().trim()

  if (MASS_UNITS[u]) {
    return {
      grams: numericQuantity * MASS_UNITS[u],
      normalization_status: "normalized",
    }
  }

  if (VOLUME_TO_ML[u]) {
    const ml = numericQuantity * VOLUME_TO_ML[u]
    const densityResult = findDensity(name)

    return {
      grams: ml * densityResult.density,
      normalization_status: densityResult.matched ? "normalized" : "estimated",
    }
  }

  if (
    [
      "pcs",
      "pc",
      "piece",
      "pieces",
      "tin",
      "tins",
      "can",
      "cans",
      "clove",
      "cloves",
    ].includes(u)
  ) {
    const pieceResult = findPieceWeight(name, u)

    if (!pieceResult.grams) {
      return {
        grams: null,
        normalization_status: "needs_review",
      }
    }

    return {
      grams: numericQuantity * pieceResult.grams,
      normalization_status: "estimated",
    }
  }

  return {
    grams: null,
    normalization_status: "needs_review",
  }
}

function getCaloriesFromFood(food: any) {
  const nutrients = food.foodNutrients || []

  const energy = nutrients.find(
    (n: any) =>
      String(n.nutrientName || "").toLowerCase() === "energy" &&
      String(n.unitName || "").toUpperCase() === "KCAL"
  )

  return Number(energy?.value || 0)
}

function scoreFood(food: any, query: string) {
  const description = String(food.description || "").toLowerCase()
  const q = query.toLowerCase()

  let score = 0

  if (description === q) score += 100
  if (description.includes(q)) score += 50

  const queryWords = q.split(/\s+/).filter(Boolean)

  for (const word of queryWords) {
    if (description.includes(word)) {
      score += 10
    }
  }

  if (food.dataType === "Foundation") score += 10
  if (food.dataType === "SR Legacy") score += 8

  if (String(food.servingSizeUnit || "").toLowerCase() === "g") {
    score += 3
  }

  return score
}

async function lookupUSDA(query: string) {
  const res = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${process.env.USDA_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        pageSize: 10,
        dataType: ["Foundation", "SR Legacy"],
      }),
    }
  )

  if (!res.ok) {
    throw new Error(`USDA request failed: ${res.status}`)
  }

  const data = await res.json()

  if (!data.foods || data.foods.length === 0) {
    return null
  }

  const filtered = data.foods.filter((food: any) => {
    const calories = getCaloriesFromFood(food)

    if (!calories && !query.includes("water")) return false
    if (calories > 900) return false
    if (query.includes("water") && calories > 5) return false

    return true
  })

  const candidates = filtered.length > 0 ? filtered : data.foods

  candidates.sort((a: any, b: any) => {
    return scoreFood(b, query) - scoreFood(a, query)
  })

  return candidates[0] || null
}

function extractMacrosPer100g(food: any): MacroSet {
  const nutrients = food?.foodNutrients || []

  const getNutrient = (names: string[], unitName?: string) => {
    const nutrient = nutrients.find((n: any) => {
      const nutrientName = String(n.nutrientName || "").toLowerCase()

      const wanted = names.some(
        (name) => nutrientName === name.toLowerCase()
      )

      if (!wanted) return false

      if (unitName) {
        return String(n.unitName || "").toUpperCase() === unitName.toUpperCase()
      }

      return true
    })

    return Number(nutrient?.value || 0)
  }

  /**
   * For USDA Foundation and SR Legacy search results, these values are
   * treated as per 100g. Do not multiply by servingSize here.
   */
  return {
    calories: getNutrient(["Energy"], "KCAL"),
    protein: getNutrient(["Protein"], "G"),
    fat: getNutrient(["Total lipid (fat)", "Total fat"], "G"),
    carbs: getNutrient(["Carbohydrate, by difference"], "G"),
  }
}

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json()

    const totals: MacroSet = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }

    const updatedIngredients = []

    for (const ingredient of ingredients || []) {
      const originalName = String(ingredient.name || "")
      const normalized = normalizeName(originalName)

      const gramResult = convertToGrams(
        ingredient.quantity,
        ingredient.unit,
        originalName
      )

      if (gramResult.grams === null) {
        updatedIngredients.push({
          ...ingredient,
          normalized_name: normalized,
          grams_normalized: null,
          calories: null,
          protein: null,
          carbs: null,
          fat: null,
          normalization_status: "needs_review",
          nutrition_status: "not_calculated",
          fdc_id: null,
          usda_description: null,
        })

        continue
      }

      let macrosPer100g: MacroSet | null = null
      let nutritionStatus = "matched"
      let fdcId: number | null = null
      let usdaDescription: string | null = null

      /**
       * 1. Prefer manual overrides.
       */
      if (MANUAL_MACROS_PER_100G[normalized]) {
        macrosPer100g = MANUAL_MACROS_PER_100G[normalized]
        nutritionStatus = "manual_override"
        usdaDescription = "Manual macro override"
      } else {
        /**
         * 2. Then check local cache.
         */
        const { data: cached } = await supabase
          .from("ingredient_nutrition_cache")
          .select("*")
          .eq("name", normalized)
          .maybeSingle()

        if (cached) {
          macrosPer100g = {
            calories: Number(cached.calories_per_100g || 0),
            protein: Number(cached.protein_per_100g || 0),
            carbs: Number(cached.carbs_per_100g || 0),
            fat: Number(cached.fat_per_100g || 0),
          }

          nutritionStatus = "cached"
          fdcId = cached.fdc_id || null
          usdaDescription = cached.usda_description || null
        } else {
          /**
           * 3. Finally, fallback to USDA.
           */
          const food = await lookupUSDA(normalized)

          if (!food) {
            updatedIngredients.push({
              ...ingredient,
              normalized_name: normalized,
              grams_normalized: gramResult.grams,
              calories: null,
              protein: null,
              carbs: null,
              fat: null,
              normalization_status: gramResult.normalization_status,
              nutrition_status: "unmatched",
              fdc_id: null,
              usda_description: null,
            })

            continue
          }

          macrosPer100g = extractMacrosPer100g(food)
          fdcId = food.fdcId || null
          usdaDescription = food.description || null

          await supabase.from("ingredient_nutrition_cache").insert([
            {
              name: normalized,
              calories_per_100g: macrosPer100g.calories,
              protein_per_100g: macrosPer100g.protein,
              carbs_per_100g: macrosPer100g.carbs,
              fat_per_100g: macrosPer100g.fat,
              source: "USDA",
              fdc_id: fdcId,
              usda_description: usdaDescription,
            },
          ])
        }
      }

      const multiplier = gramResult.grams / 100

      const ingredientCalories = macrosPer100g.calories * multiplier
      const ingredientProtein = macrosPer100g.protein * multiplier
      const ingredientCarbs = macrosPer100g.carbs * multiplier
      const ingredientFat = macrosPer100g.fat * multiplier

      totals.calories += ingredientCalories
      totals.protein += ingredientProtein
      totals.carbs += ingredientCarbs
      totals.fat += ingredientFat

      updatedIngredients.push({
        ...ingredient,
        normalized_name: normalized,
        grams_normalized: gramResult.grams,

        calories: ingredientCalories,
        protein: ingredientProtein,
        carbs: ingredientCarbs,
        fat: ingredientFat,

        calories_per_100g: macrosPer100g.calories,
        protein_per_100g: macrosPer100g.protein,
        carbs_per_100g: macrosPer100g.carbs,
        fat_per_100g: macrosPer100g.fat,

        normalization_status: gramResult.normalization_status,
        nutrition_status: nutritionStatus,

        fdc_id: fdcId,
        usda_description: usdaDescription,
      })
    }

    return NextResponse.json({
      ingredients: updatedIngredients,
      totals,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to calculate macros",
      },
      {
        status: 500,
      }
    )
  }
}