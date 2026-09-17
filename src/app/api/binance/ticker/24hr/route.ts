import { NextResponse } from "next/server";

const BINANCE_URL = "https://api.binance.com/api/v3/ticker/24hr";

export const revalidate = 15; // seconds (hint)

export async function GET() {
  try {
    const res = await fetch(BINANCE_URL, {
      next: { revalidate: 15 },
      headers: {
        Accept: "application/json",
        "User-Agent": "crypto-watcher/1.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Binance API error", status: res.status },
        {
          status: 502,
          headers: {
            "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
          },
        }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch Binance", message },
      {
        status: 502,
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
        },
      }
    );
  }
}
