import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type MacroSet = {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export type InputIngredient = {
  name: string
  quantity: number | string | null
  unit: string | null
}

export type NormalizationStatus =
  | "normalized"
  | "estimated"
  | "needs_review"

export type NutritionStatus =
  | "manual_override"
  | "cached"
  | "matched"
  | "unmatched"
  | "not_calculated"

export type CalculatedIngredient = {
  name: string
  quantity: number | string | null
  unit: string | null

  normalized_name: string
  grams_normalized: number | null

  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null

  calories_per_100g?: number | null
  protein_per_100g?: number | null
  carbs_per_100g?: number | null
  fat_per_100g?: number | null

  normalization_status: NormalizationStatus
  nutrition_status: NutritionStatus

  fdc_id: number | null
  usda_description: string | null
}

type GramResult = {
  grams: number | null
  normalization_status: NormalizationStatus
}

const ZERO_MACROS: MacroSet = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
}

/**
 * Ingredients that commonly appear without amounts.
 * If quantity/unit is missing, these are treated as 0 calories rather than NULL.
 */
const NEGLIGIBLE_WHEN_AMOUNT_MISSING = new Set([
  "salt",
  "pepper",
  "black pepper",
  "oregano",
  "thyme",
  "thyme or oregano",
  "smoked paprika",
  "paprika",
  "garlic powder",
  "onion powder",
  "chili powder",
  "cayenne pepper",
  "avocado oil spray",
  "cooking spray",
])

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

  "2% cottage cheese": {
    calories: 82,
    protein: 11,
    carbs: 3.4,
    fat: 2.3,
  },

  avocado: {
    calories: 160,
    protein: 2,
    carbs: 8.5,
    fat: 14.7,
  },

  cucumber: {
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
  },

  cucumbers: {
    calories: 15,
    protein: 0.7,
    carbs: 3.6,
    fat: 0.1,
  },
  
  "cooked chicken": {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
  },

  "chicken thighs raw": {
    calories: 177,
    protein: 24,
    carbs: 0,
    fat: 8,
  },

  "pasta dry": {
    calories: 371,
    protein: 13,
    carbs: 75,
    fat: 1.5,
  },

  "low carb rice": {
    calories: 35,
    protein: 1,
    carbs: 7,
    fat: 0.5,
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

  mozzarella: {
    calories: 280,
    protein: 18,
    carbs: 2,
    fat: 22,
  },

  "shredded cheese": {
    calories: 400,
    protein: 25,
    carbs: 3,
    fat: 33,
  },

  "parmesan cheese": {
    calories: 431,
    protein: 38,
    carbs: 4.1,
    fat: 29,
  },

  chorizo: {
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

  garlic: {
    calories: 149,
    protein: 6.4,
    carbs: 33,
    fat: 0.5,
  },

  "garlic powder": {
    calories: 331,
    protein: 16.6,
    carbs: 72.7,
    fat: 0.7,
  },

  "red chili peppers": {
    calories: 40,
    protein: 1.9,
    carbs: 9,
    fat: 0.4,
  },

  "cauliflower rice": {
    calories: 25,
    protein: 1.9,
    carbs: 5,
    fat: 0.3,
  },

  "olive oil": {
    calories: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
  },

  "avocado oil": {
    calories: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
  },

  "avocado oil spray": {
    calories: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
  },

  mayo: {
    calories: 680,
    protein: 1,
    carbs: 1,
    fat: 75,
  },

  cilantro: {
    calories: 23,
    protein: 2.1,
    carbs: 3.7,
    fat: 0.5,
  },

  scallions: {
    calories: 32,
    protein: 1.8,
    carbs: 7.3,
    fat: 0.2,
  },

  leeks: {
    calories: 61,
    protein: 1.5,
    carbs: 14.2,
    fat: 0.3,
  },

  broccoli: {
    calories: 34,
    protein: 2.8,
    carbs: 6.6,
    fat: 0.4,
  },

  "red onion": {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
  },

  onion: {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
  },

  "low fat cream cheese": {
    calories: 208,
    protein: 8.2,
    carbs: 5.5,
    fat: 16.5,
  },

  "ranch seasoning": {
    calories: 333,
    protein: 10,
    carbs: 67,
    fat: 3.3,
  },

  "chicken stock cube": {
    calories: 198,
    protein: 17,
    carbs: 16,
    fat: 8,
  },

  salt: ZERO_MACROS,
  pepper: ZERO_MACROS,
  "black pepper": ZERO_MACROS,
  oregano: ZERO_MACROS,
  thyme: ZERO_MACROS,
  "thyme or oregano": ZERO_MACROS,
  "smoked paprika": ZERO_MACROS,
  paprika: ZERO_MACROS,

  water: ZERO_MACROS,
}

const NAME_OVERRIDES: Record<string, string> = {
  mozarella: "mozzarella",
  mozzarella: "mozzarella",

  "2% cottage cheese": "2% cottage cheese",
  "cottage cheese": "2% cottage cheese",

  avocado: "avocado",
  avocados: "avocado",

  cucumber: "cucumber",
  cucumbers: "cucumbers",

  onions: "onion",

  "salt + pepper": "salt and pepper",
  "salt and pepper": "salt and pepper",

  "parmesan finely": "parmesan cheese",
  parmesan: "parmesan cheese",
  "parmesan cheese": "parmesan cheese",

  "shredded cheese": "shredded cheese",
  "cheddar cheese": "shredded cheese",
  cheddar: "shredded cheese",

  "lazy garlic": "garlic",

  "garlic powder": "garlic powder",

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

  "lowcarb rice": "low carb rice",
  "low carb rice": "low carb rice",

  "sliced chorizo": "chorizo",
  chorizo: "chorizo",

  "chicken breast": "chicken breast raw",
  "raw chicken breast": "chicken breast raw",

  "diced leftover chicken": "cooked chicken",
  "leftover chicken": "cooked chicken",
  "cooked chicken": "cooked chicken",

  "chicken thigh": "chicken thighs raw",
  "chicken thighs": "chicken thighs raw",
  "raw chicken thighs": "chicken thighs raw",
  "boneless chicken thighs": "chicken thighs raw",
  "skinless chicken thighs": "chicken thighs raw",
  "boneless skinless chicken thighs": "chicken thighs raw",

  jalapeños: "jalapeno peppers",
  jalapenos: "jalapeno peppers",

  "cauliflower rice": "cauliflower rice",
  "cauli rice": "cauliflower rice",

  "olive oil": "olive oil",
  oil: "olive oil",

  "avocado oil": "avocado oil",
  "avocado oil spray": "avocado oil spray",
  "cooking spray": "avocado oil spray",

  mayo: "mayo",
  mayonnaise: "mayo",

  "fresh cilantro": "cilantro",
  cilantro: "cilantro",
  coriander: "cilantro",
  "fresh coriander": "cilantro",

  scallion: "scallions",
  scallions: "scallions",
  "spring onion": "scallions",
  "spring onions": "scallions",
  "green onion": "scallions",
  "green onions": "scallions",

  leek: "leeks",
  leeks: "leeks",

  broccoli: "broccoli",

  "red onion": "red onion",
  onion: "onion",

  "low fat cream cheese": "low fat cream cheese",
  "cream cheese": "low fat cream cheese",

  "ranch seasoning": "ranch seasoning",
  "ranch seasoning mix": "ranch seasoning",
  "ranch packet": "ranch seasoning",

  "chicken stock cube": "chicken stock cube",
  "stock cube": "chicken stock cube",
  bouillon: "chicken stock cube",
  "bouillon cube": "chicken stock cube",

  salt: "salt",
  pepper: "pepper",
  "black pepper": "black pepper",
  oregano: "oregano",
  thyme: "thyme",
  "thyme or oregano": "thyme or oregano",
  "thyme oregano": "thyme or oregano",
  "smoked paprika": "smoked paprika",
  paprika: "paprika",

  water: "water",
}

const MASS_UNITS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,

  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,

  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,

  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
}

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  milliliter: 1,
  milliliters: 1,

  l: 1000,
  litre: 1000,
  litres: 1000,
  liter: 1000,
  liters: 1000,

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

  "avocado oil": 0.91,
  "avocado oil spray": 0.91,

  mayo: 0.94,
  mayonnaise: 0.94,

  "red onion": 0.6,
  onion: 0.6,

  broccoli: 0.38,
  "cauliflower rice": 0.45,
  cilantro: 0.1,
  scallions: 0.5,

  "garlic powder": 0.56,
  oregano: 0.3,
  thyme: 0.3,
  "thyme or oregano": 0.3,
  "smoked paprika": 0.45,
  paprika: 0.45,
}

const PIECE_WEIGHTS_G: Record<string, number> = {
  egg: 50,

onion: 150,
  onions: 150,
  "red onion": 150,

  tomato: 120,
  tomatoes: 120,

  garlic: 3,
  "garlic clove": 3,

avocado: 150,
  "avocado:pc": 150,
  "avocado:pcs": 150,
  "avocado:piece": 150,
  "avocado:pieces": 150,

  cucumber: 200,
  cucumbers: 200,
  "cucumber:pc": 200,
  "cucumber:pcs": 200,
  "cucumber:piece": 200,
  "cucumber:pieces": 200,
  "cucumbers:pc": 200,
  "cucumbers:pcs": 200,
  "cucumbers:piece": 200,
  "cucumbers:pieces": 200,

  "2% cottage cheese:serving": 113,
  "2% cottage cheese:servings": 113,
  "cottage cheese:serving": 113,
  "cottage cheese:servings": 113,

  scallion: 15,
  scallions: 15,
  "scallion:pc": 15,
  "scallion:pcs": 15,
  "scallion:piece": 15,
  "scallion:pieces": 15,
  "scallions:pc": 15,
  "scallions:pcs": 15,
  "scallions:piece": 15,
  "scallions:pieces": 15,

  "fresh cilantro:handful": 10,
  "fresh cilantro:handfuls": 10,
  "cilantro:handful": 10,
  "cilantro:handfuls": 10,

  "chicken stock cube": 10,
  "chicken stock cube:cube": 10,
  "chicken stock cube:cubes": 10,

  "ranch seasoning:pack": 28,
  "ranch seasoning:packet": 28,
  "ranch seasoning:packets": 28,

  "low carb rice:box": 200,

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
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\bboneless\b|\bskinless\b|\bfresh\b|\bgrated\b|\bminced\b|\bthinly\b|\bsliced\b|\bfinely\b|\bchopped\b|\bdiced\b/g,
      ""
    )
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

  const keysToTry = [`${cleaned}:${u}`, `${normalized}:${u}`, cleaned, normalized]

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

function inferMissingUnit(name: string): string | null {
  const normalized = normalizeName(name)

  if (normalized === "chicken stock cube") {
    return "cube"
  }

  if (
    normalized === "onion" ||
    normalized === "red onion" ||
    normalized === "avocado" ||
    normalized === "cucumber" ||
    normalized === "cucumbers"
  ) {
    return "piece"
  }

  if (NEGLIGIBLE_WHEN_AMOUNT_MISSING.has(normalized)) {
    return "g"
  }

  return null
}

function convertToGrams(
  quantity: number | string | null,
  unit: string | null,
  name: string
): GramResult {
  const normalized = normalizeName(name)

  if (
    (quantity === null || quantity === undefined || quantity === "") &&
    !unit &&
    NEGLIGIBLE_WHEN_AMOUNT_MISSING.has(normalized)
  ) {
    return {
      grams: 0,
      normalization_status: "estimated",
    }
  }

  const inferredUnit = unit || inferMissingUnit(name)

  if (quantity === null || quantity === undefined || quantity === "" || !inferredUnit) {
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

  const u = inferredUnit.toLowerCase().trim()

  if (MASS_UNITS[u]) {
    return {
      grams: numericQuantity * MASS_UNITS[u],
      normalization_status: unit ? "normalized" : "estimated",
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
      "cube",
      "cubes",
      "handful",
      "handfuls",
      "pack",
      "packs",
      "packet",
      "packets",
      "box",
      "boxes",
      "serving",
    "servings",
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
  if (!process.env.USDA_API_KEY) {
    throw new Error("Missing USDA_API_KEY environment variable.")
  }

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

    if (
      !calories &&
      !query.includes("water") &&
      !query.includes("salt") &&
      !query.includes("pepper") &&
      !query.includes("oregano") &&
      !query.includes("thyme")
    ) {
      return false
    }

    if (calories > 900) return false
    if (query.includes("water") && calories > 5) return false
    if (query.includes("salt") && calories > 5) return false

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

  return {
    calories: getNutrient(["Energy"], "KCAL"),
    protein: getNutrient(["Protein"], "G"),
    fat: getNutrient(["Total lipid (fat)", "Total fat"], "G"),
    carbs: getNutrient(["Carbohydrate, by difference"], "G"),
  }
}

function roundCalories(value: number) {
  return Math.round(value)
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

export async function calculateMacros(ingredients: InputIngredient[]) {
  const totals: MacroSet = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  }

  const updatedIngredients: CalculatedIngredient[] = []

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
        name: originalName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
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
    let nutritionStatus: NutritionStatus = "matched"
    let fdcId: number | null = null
    let usdaDescription: string | null = null

    if (MANUAL_MACROS_PER_100G[normalized]) {
      macrosPer100g = MANUAL_MACROS_PER_100G[normalized]
      nutritionStatus = "manual_override"
      usdaDescription = "Manual macro override"
    } else {
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
        const food = await lookupUSDA(normalized)

        if (!food) {
          updatedIngredients.push({
            name: originalName,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
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

        await supabase.from("ingredient_nutrition_cache").upsert(
          [
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
          ],
          {
            onConflict: "name",
          }
        )
      }
    }

    const multiplier = gramResult.grams / 100

    const ingredientCalories = macrosPer100g.calories * multiplier
    const ingredientProtein = macrosPer100g.protein * multiplier
    const ingredientCarbs = macrosPer100g.carbs * multiplier
    const ingredientFat = macrosPer100g.fat * multiplier

    const roundedCalories = roundCalories(ingredientCalories)
    const roundedProtein = roundMacro(ingredientProtein)
    const roundedCarbs = roundMacro(ingredientCarbs)
    const roundedFat = roundMacro(ingredientFat)

    totals.calories += roundedCalories
    totals.protein += roundedProtein
    totals.carbs += roundedCarbs
    totals.fat += roundedFat

    updatedIngredients.push({
      name: originalName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,

      normalized_name: normalized,
      grams_normalized: roundMacro(gramResult.grams),

      calories: roundedCalories,
      protein: roundedProtein,
      carbs: roundedCarbs,
      fat: roundedFat,

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

  return {
    ingredients: updatedIngredients,
    totals: {
      calories: roundCalories(totals.calories),
      protein: roundMacro(totals.protein),
      carbs: roundMacro(totals.carbs),
      fat: roundMacro(totals.fat),
    },
  }
}