import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    seedEnabled: process.env.ENABLE_SEED_ROUTE === "true",
  });
}
