export interface MacroIngredient {
  calories?: number | string | null
  protein?: number | string | null
  carbs?: number | string | null
  fat?: number | string | null
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export function roundCalories(value: number) {
  return Math.round(Number(value) || 0)
}

export function roundMacro(value: number) {
  return Number((Number(value) || 0).toFixed(1))
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0)
}

export function calculateMacroTotals(
  ingredients: MacroIngredient[]
): MacroTotals {
  const totals = ingredients.reduce<MacroTotals>(
    (acc, ingredient) => {
      acc.calories += toNumber(ingredient.calories)
      acc.protein += toNumber(ingredient.protein)
      acc.carbs += toNumber(ingredient.carbs)
      acc.fat += toNumber(ingredient.fat)

      return acc
    },
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  )

  return {
    calories: roundCalories(totals.calories),
    protein: roundMacro(totals.protein),
    carbs: roundMacro(totals.carbs),
    fat: roundMacro(totals.fat),
  }
}

export function calculatePerServing(
  totals: MacroTotals,
  servings: number
): MacroTotals {
  const safeServings = servings > 0 ? servings : 1

  return {
    calories: roundCalories(totals.calories / safeServings),
    protein: roundMacro(totals.protein / safeServings),
    carbs: roundMacro(totals.carbs / safeServings),
    fat: roundMacro(totals.fat / safeServings),
  }
}