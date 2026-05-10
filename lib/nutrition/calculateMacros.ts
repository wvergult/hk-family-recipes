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
  | "ai_estimated"
  | "unmatched"
  | "not_calculated"

export type MacroCategory =
  | "primary_food"
  | "vegetable"
  | "fruit"
  | "herb_or_spice"
  | "seasoning"
  | "zero_calorie_liquid"
  | "caloric_liquid"
  | "stock_or_broth"
  | "condiment"
  | "leavening_or_additive"
  | "unknown"

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

  /**
   * Legacy compatibility fields.
   * These are no longer USDA-backed in the current implementation.
   */
  fdc_id: number | null
  usda_description: string | null
}

type GramResult = {
  grams: number | null
  normalization_status: NormalizationStatus
}

type AiMacroEstimate = MacroSet & {
  macroRelevant: boolean
  category: MacroCategory
  confidence: "high" | "medium" | "low"
  notes: string
}

const ZERO_MACROS: MacroSet = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
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

function isZeroCalorieWaterIngredient(name: string) {
  const cleaned = cleanName(name)

  return [
    "water",
    "plain water",
    "tap water",
    "filtered water",
    "cold water",
    "hot water",
    "warm water",
    "boiling water",
    "boiled water",
    "ice",
    "ice water",
  ].includes(cleaned)
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

  "water",
  "plain water",
  "tap water",
  "filtered water",
  "cold water",
  "hot water",
  "warm water",
  "boiling water",
  "boiled water",
  "ice",
  "ice water",
])

/**
 * Manual overrides for special app-specific ingredients.
 *
 * Values are per 100g.
 *
 * General nutrition lookup uses DeepSeek through OpenRouter.
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
  "plain water": "water",
  "tap water": "water",
  "filtered water": "water",
  "cold water": "water",
  "hot water": "water",
  "warm water": "water",
  "boiling water": "water",
  "boiled water": "water",
  ice: "water",
  "ice water": "water",
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

function roundCalories(value: number) {
  return Math.round(value)
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/)

    if (!match) {
      throw new Error("No JSON object found in AI response.")
    }

    return JSON.parse(match[0])
  }
}

function isValidMacroSet(macros: MacroSet) {
  if (
    !Number.isFinite(macros.calories) ||
    !Number.isFinite(macros.protein) ||
    !Number.isFinite(macros.carbs) ||
    !Number.isFinite(macros.fat)
  ) {
    return false
  }

  if (
    macros.calories < 0 ||
    macros.protein < 0 ||
    macros.carbs < 0 ||
    macros.fat < 0 ||
    macros.calories > 950 ||
    macros.protein > 100 ||
    macros.carbs > 100 ||
    macros.fat > 100
  ) {
    return false
  }

  const macroCalories = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
  const calorieDifference = Math.abs(macros.calories - macroCalories)

  if (
    macros.calories > 50 &&
    macroCalories > 0 &&
    calorieDifference > Math.max(120, macros.calories * 0.45)
  ) {
    return false
  }

  return true
}

async function estimateMacrosWithAI(
  ingredientName: string
): Promise<AiMacroEstimate | null> {
  if (isZeroCalorieWaterIngredient(ingredientName) || normalizeName(ingredientName) === "water") {
    return {
      macroRelevant: false,
      category: "zero_calorie_liquid",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      confidence: "high",
      notes: "Hardcoded water safety override before AI.",
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("Missing OPENROUTER_API_KEY environment variable.")
    return null
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "Recipe Macro Calculator",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
You are a strict nutrition classification and macro estimation engine.

Return only valid JSON.
No markdown.
No commentary.
No text outside JSON.

You estimate typical nutrition values per 100 grams for recipe ingredients.

You must follow this internal process before returning JSON:

STAGE 1 — Identify the ingredient:
- Determine whether the input is a real calorie-containing food, a drink/liquid, a seasoning, a herb/spice, a zero-calorie cooking liquid, a stock/broth item, a condiment, an additive, or unknown.
- Do not confuse cooking instructions with ingredient identity.
- Words like boiling, hot, cold, warm, iced, tap, filtered, and fresh may describe temperature or preparation, not calories.

STAGE 2 — Decide macro relevance:
- Set macroRelevant = false for zero-calorie cooking liquids, plain water, ice, salt, pepper, herbs, spices, and seasonings that are normally used in negligible amounts.
- Set macroRelevant = true for calorie-containing foods and liquids, including oils, butter, dairy, cheese, cream cheese, meat, fish, eggs, pasta, rice, bread, flour, sugar, fruit, vegetables, nuts, seeds, sauces, milk, cream, yoghurt, stock cubes, and condiments.
- If unsure whether it has calories, set macroRelevant = true and category = "unknown".

STAGE 3 — Estimate per 100g macros:
- If macroRelevant is false, calories, protein, carbs, and fat must all be 0.
- If macroRelevant is true, estimate typical raw/plain nutrition per 100g.
- Do not use brand-specific values unless the ingredient clearly specifies a brand.
- Do not estimate based on the recipe quantity. Values must be per 100g only.

STAGE 4 — Sanity check:
- Plain water, boiling water, hot water, cold water, warm water, and ice must be 0 calories per 100g.
- Salt, pepper, dried herbs, and spices used as seasonings should be 0 calories per 100g for this recipe calculator.
- Oil and pure fats may be around 884 calories and 100g fat per 100g.
- Most foods cannot exceed 950 calories per 100g.
- Protein, carbs, and fat cannot exceed 100g per 100g.
- If the ingredient is a zero-calorie liquid but your calories are not 0, correct it before returning.
- If calories are implausibly high for the category, lower confidence or set category to "unknown".

Use exactly one category:
- "primary_food"
- "vegetable"
- "fruit"
- "herb_or_spice"
- "seasoning"
- "zero_calorie_liquid"
- "caloric_liquid"
- "stock_or_broth"
- "condiment"
- "leavening_or_additive"
- "unknown"

Return this exact JSON shape:
{
  "macroRelevant": boolean,
  "category": "primary_food" | "vegetable" | "fruit" | "herb_or_spice" | "seasoning" | "zero_calorie_liquid" | "caloric_liquid" | "stock_or_broth" | "condiment" | "leavening_or_additive" | "unknown",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fat": number,
  "confidence": "high" | "medium" | "low",
  "notes": string
}
          `.trim(),
        },
        {
          role: "user",
          content: `
Estimate nutrition macros per 100g for this recipe ingredient:

"${ingredientName}"

Important:
- Return per 100g values only.
- Do not use the recipe quantity.
- If this is plain water, boiling water, hot water, cold water, warm water, or ice, return macroRelevant false and all macros 0.
- If this is salt, pepper, an herb, a spice, or negligible seasoning, return macroRelevant false and all macros 0.
- If this is oil, butter, cheese, cream cheese, meat, pasta, rice, vegetables, fruit, dairy, sauce, stock cube, or condiment, return macroRelevant true with reasonable per-100g macros.
- Perform the sanity check before returning JSON.
          `.trim(),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()

    console.error("OpenRouter macro estimate failed:", {
      ingredientName,
      status: response.status,
      errorText,
    })

    return null
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content?.trim()

  if (!text) {
    console.error("OpenRouter returned empty macro estimate:", {
      ingredientName,
      data,
    })

    return null
  }

  try {
    const parsed = extractJsonObject(text)

    const allowedCategories = new Set<MacroCategory>([
      "primary_food",
      "vegetable",
      "fruit",
      "herb_or_spice",
      "seasoning",
      "zero_calorie_liquid",
      "caloric_liquid",
      "stock_or_broth",
      "condiment",
      "leavening_or_additive",
      "unknown",
    ])

    const category: MacroCategory = allowedCategories.has(parsed.category)
      ? parsed.category
      : "unknown"

    const estimate: AiMacroEstimate = {
      macroRelevant:
        typeof parsed.macroRelevant === "boolean"
          ? parsed.macroRelevant
          : true,
      category,
      calories: Number(parsed.calories),
      protein: Number(parsed.protein),
      carbs: Number(parsed.carbs),
      fat: Number(parsed.fat),
      confidence:
        parsed.confidence === "high" ||
        parsed.confidence === "medium" ||
        parsed.confidence === "low"
          ? parsed.confidence
          : "low",
      notes: String(parsed.notes || ""),
    }

    if (
      Number.isNaN(estimate.calories) ||
      Number.isNaN(estimate.protein) ||
      Number.isNaN(estimate.carbs) ||
      Number.isNaN(estimate.fat)
    ) {
      console.error("AI macro estimate contained invalid numbers:", {
        ingredientName,
        parsed,
      })

      return null
    }

    if (estimate.macroRelevant === false) {
      return {
        macroRelevant: false,
        category: estimate.category,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        confidence: estimate.confidence,
        notes: estimate.notes || "Not macro relevant for recipe calculation.",
      }
    }

    const macroSet: MacroSet = {
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
    }

    if (!isValidMacroSet(macroSet)) {
      console.error("AI macro estimate failed sanity check:", {
        ingredientName,
        estimate,
      })

      return null
    }

    return {
      macroRelevant: true,
      category: estimate.category,
      calories: roundCalories(estimate.calories),
      protein: roundMacro(estimate.protein),
      carbs: roundMacro(estimate.carbs),
      fat: roundMacro(estimate.fat),
      confidence: estimate.confidence,
      notes: estimate.notes,
    }
  } catch (error) {
    console.error("Failed to parse OpenRouter macro estimate:", {
      ingredientName,
      text,
      error,
    })

    return null
  }
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

    /**
     * Absolute water safety override.
     *
     * This must run before:
     * - gram null handling
     * - cache lookup
     * - manual macro lookup
     * - AI lookup
     *
     * Water should never enter the AI/cache path because a bad AI/cache row can
     * make it look like oil at 884 calories / 100g.
     */
    if (isZeroCalorieWaterIngredient(originalName) || normalized === "water") {
      updatedIngredients.push({
        name: originalName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,

        normalized_name: "water",
        grams_normalized:
          gramResult.grams === null ? null : roundMacro(gramResult.grams),

        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,

        calories_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,

        normalization_status:
          gramResult.grams === null
            ? "needs_review"
            : gramResult.normalization_status,
        nutrition_status: "manual_override",

        fdc_id: null,
        usda_description: "Hardcoded zero-calorie water override",
      })

      continue
    }

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
    let nutritionStatus: NutritionStatus = "ai_estimated"
    let fdcId: number | null = null
    let nutritionDescription: string | null = null

    if (MANUAL_MACROS_PER_100G[normalized]) {
      macrosPer100g = MANUAL_MACROS_PER_100G[normalized]
      nutritionStatus = "manual_override"
      nutritionDescription = "Manual macro override"
    } else {
      const { data: cached } = await supabase
        .from("ingredient_nutrition_cache")
        .select("*")
        .eq("name", normalized)
        .maybeSingle()

      /**
       * Only trust cache rows created by the current AI estimator.
       * Old cache rows, null source rows, and invalid rows are ignored
       * and replaced with a fresh OpenRouter/DeepSeek estimate.
       */
      if (cached && cached.source === "AI_ESTIMATE") {
        const cachedMacros: MacroSet = {
          calories: Number(cached.calories_per_100g || 0),
          protein: Number(cached.protein_per_100g || 0),
          carbs: Number(cached.carbs_per_100g || 0),
          fat: Number(cached.fat_per_100g || 0),
        }

        if (isValidMacroSet(cachedMacros)) {
          macrosPer100g = cachedMacros
          nutritionStatus = "cached"
          fdcId = null
          nutritionDescription =
            cached.usda_description || "Cached DeepSeek/OpenRouter AI estimate"
        } else {
          console.log("Ignoring invalid cached AI nutrition row:", {
            ingredient: normalized,
            cachedMacros,
          })
        }
      }

      if (!macrosPer100g) {
        if (cached) {
          console.log("Replacing old or invalid nutrition cache row:", {
            ingredient: normalized,
            oldSource: cached.source || null,
          })
        }

        const aiEstimate = await estimateMacrosWithAI(normalized)

        if (!aiEstimate) {
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

        macrosPer100g = {
          calories: aiEstimate.calories,
          protein: aiEstimate.protein,
          carbs: aiEstimate.carbs,
          fat: aiEstimate.fat,
        }

        nutritionStatus = "ai_estimated"
        fdcId = null
        nutritionDescription = `DeepSeek/OpenRouter AI estimate. Category: ${aiEstimate.category}. Macro relevant: ${aiEstimate.macroRelevant}. Confidence: ${aiEstimate.confidence}. ${aiEstimate.notes}`

        const { error: cacheUpsertError } = await supabase
          .from("ingredient_nutrition_cache")
          .upsert(
            [
              {
                name: normalized,
                calories_per_100g: macrosPer100g.calories,
                protein_per_100g: macrosPer100g.protein,
                carbs_per_100g: macrosPer100g.carbs,
                fat_per_100g: macrosPer100g.fat,
                source: "AI_ESTIMATE",
                fdc_id: null,
                usda_description: nutritionDescription,
              },
            ],
            {
              onConflict: "name",
            }
          )

        if (cacheUpsertError) {
          console.error("Failed to save AI nutrition estimate to cache:", {
            ingredient: normalized,
            error: cacheUpsertError,
          })
        }
      }
    }

    /**
     * Final safety override.
     * This should be unreachable for water because of the earlier continue,
     * but it protects against future refactors.
     */
    if (normalized === "water" || isZeroCalorieWaterIngredient(originalName)) {
      macrosPer100g = ZERO_MACROS
      nutritionStatus = "manual_override"
      fdcId = null
      nutritionDescription = "Final zero-calorie water safety override"
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
      usda_description: nutritionDescription,
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