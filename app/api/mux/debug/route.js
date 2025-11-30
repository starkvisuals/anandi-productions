import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

// Debug endpoint - test Mux connection (GET)
export async function GET() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  
  if (!tokenId || !tokenSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing credentials',
      tokenIdPresent: !!tokenId,
      tokenSecretPresent: !!tokenSecret,
    });
  }

  try {
    const mux = new Mux({
      tokenId: tokenId,
      tokenSecret: tokenSecret,
    });

    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Mux connection successful!',
      uploadId: upload.id,
      uploadUrl: upload.url ? 'URL generated successfully' : 'No URL',
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      errorType: error.constructor.name,
      stack: error.stack?.split('\n').slice(0, 5),
    });
  }
}

// Debug endpoint - test POST (same as upload route)
export async function POST(request) {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  
  if (!tokenId || !tokenSecret) {
    return NextResponse.json({
      success: false,
      error: 'Missing Mux credentials',
    }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { projectId, assetId, filename } = body;

    const mux = new Mux({
      tokenId: tokenId,
      tokenSecret: tokenSecret,
    });

    const upload = await mux.video.uploads.create({
      cors_origin: '*',
      new_asset_settings: {
        playback_policy: ['public'],
        passthrough: JSON.stringify({ projectId, assetId, filename }),
        mp4_support: 'standard',
      },
    });

    return NextResponse.json({
      success: true,
      uploadUrl: upload.url,
      uploadId: upload.id,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
    }, { status: 500 });
  }
}
