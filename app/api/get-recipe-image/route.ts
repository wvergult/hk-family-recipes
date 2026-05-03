export async function POST(req: Request) {
  try {
    const { title } = await req.json()

    if (!title) {
      return Response.json({ error: "No title provided" }, { status: 400 })
    }

    const lowerTitle = title.toLowerCase()

    // ✅ Detect main protein
    let protein = ""
    if (lowerTitle.includes("chicken")) protein = "chicken"
    else if (lowerTitle.includes("beef")) protein = "beef"
    else if (lowerTitle.includes("salmon")) protein = "salmon"
    else if (lowerTitle.includes("shrimp")) protein = "shrimp"
    else if (lowerTitle.includes("pork")) protein = "pork"
    else if (lowerTitle.includes("tofu")) protein = "tofu"
    else if (lowerTitle.includes("pasta")) protein = "pasta"

    // ✅ Strong food photography bias
    const query = encodeURIComponent(
      `${protein || title} plated meal food photography`
    )

    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&per_page=8&orientation=landscape`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        },
      }
    )

    const data = await res.json()

    if (!data.results || data.results.length === 0) {
      return Response.json({ imageUrl: null })
    }

    // ✅ Filter out ingredient / flat lay shots
    const filtered = data.results.filter((img: any) => {
      const desc = (img.alt_description || "").toLowerCase()

      return (
        desc.includes("plate") ||
        desc.includes("dish") ||
        desc.includes("meal") ||
        desc.includes("bowl")
      )
    })

    const chosen =
      filtered[0]?.urls?.regular ||
      data.results[0]?.urls?.regular ||
      null

    return Response.json({ imageUrl: chosen })

  } catch (err) {
    console.error("Image fetch error:", err)
    return Response.json({ error: "Failed to fetch image" }, { status: 500 })
  }
}