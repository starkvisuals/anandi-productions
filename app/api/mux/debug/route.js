import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

// Debug endpoint - test Mux connection
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
    // Try creating a Mux client and making a test call
    const mux = new Mux({
      tokenId: tokenId,
      tokenSecret: tokenSecret,
    });

    // Try to create a direct upload URL as a test
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
