import { NextResponse } from 'next/server';

// Test endpoint to check if Mux is configured
export async function GET() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  
  return NextResponse.json({
    configured: !!(tokenId && tokenSecret),
    tokenIdPresent: !!tokenId,
    tokenSecretPresent: !!tokenSecret,
    tokenIdLength: tokenId?.length || 0,
    tokenSecretLength: tokenSecret?.length || 0,
  });
}
