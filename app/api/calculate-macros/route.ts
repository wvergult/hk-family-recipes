import { NextResponse } from "next/server"
import { calculateMacros } from "../../../lib/nutrition/calculateMacros"

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json()

    const result = await calculateMacros(ingredients || [])

    return NextResponse.json(result)
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