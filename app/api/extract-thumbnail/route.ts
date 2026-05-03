import { NextResponse } from "next/server"

function getMetaContent(html: string, property: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`,
      "i"
    ),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1].replaceAll("&amp;", "&")
    }
  }

  return null
}

function getYoutubeVideoId(url: string) {
  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.hostname.includes("youtu.be")) {
      return parsedUrl.pathname.replace("/", "")
    }

    if (parsedUrl.hostname.includes("youtube.com")) {
      if (parsedUrl.searchParams.get("v")) {
        return parsedUrl.searchParams.get("v")
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/shorts/")[1]?.split("/")[0]
      }

      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/embed/")[1]?.split("/")[0]
      }
    }

    return null
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing URL." },
        { status: 400 }
      )
    }

    const trimmedUrl = url.trim()

    let parsedUrl: URL

    try {
      parsedUrl = new URL(trimmedUrl)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL." },
        { status: 400 }
      )
    }

    const youtubeVideoId = getYoutubeVideoId(trimmedUrl)

    if (youtubeVideoId) {
      return NextResponse.json({
        imageUrl: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
      })
    }

    const response = await fetch(trimmedUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Could not fetch page. Status: ${response.status}`,
        },
        { status: 400 }
      )
    }

    const html = await response.text()

    const imageUrl =
      getMetaContent(html, "og:image") ||
      getMetaContent(html, "twitter:image") ||
      getMetaContent(html, "twitter:image:src")

    if (!imageUrl) {
      return NextResponse.json(
        {
          error:
            "No thumbnail found. This page may block scraping. Try pasting an image URL manually.",
        },
        { status: 404 }
      )
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("Thumbnail extraction error:", error)

    return NextResponse.json(
      {
        error:
          "Could not extract thumbnail. This site may block server-side requests.",
      },
      { status: 500 }
    )
  }
}