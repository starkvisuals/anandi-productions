import { NextResponse } from 'next/server';
import Mux from '@mux/mux-node';

// Initialize Mux client
const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// POST - Create a direct upload URL
export async function POST(request) {
  try {
    const body = await request.json();
    const { projectId, assetId, filename } = body;

    // Create a direct upload URL
    const upload = await mux.video.uploads.create({
      cors_origin: '*', // In production, set to your domain
      new_asset_settings: {
        playback_policy: ['public'],
        // Store metadata for webhook
        passthrough: JSON.stringify({
          projectId,
          assetId,
          filename,
          uploadedAt: new Date().toISOString()
        }),
        // Generate thumbnails
        master_access: 'temporary',
        // Enable MP4 download
        mp4_support: 'standard',
      },
    });

    return NextResponse.json({
      success: true,
      uploadUrl: upload.url,
      uploadId: upload.id,
    });
  } catch (error) {
    console.error('Mux upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Get asset status
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');
    const uploadId = searchParams.get('uploadId');

    if (uploadId) {
      // Check upload status
      const upload = await mux.video.uploads.retrieve(uploadId);
      
      if (upload.asset_id) {
        // Upload complete, get asset details
        const asset = await mux.video.assets.retrieve(upload.asset_id);
        return NextResponse.json({
          success: true,
          status: upload.status,
          asset: {
            id: asset.id,
            status: asset.status,
            playbackId: asset.playback_ids?.[0]?.id,
            duration: asset.duration,
            aspectRatio: asset.aspect_ratio,
            resolution: asset.resolution_tier,
            thumbnailUrl: asset.playback_ids?.[0]?.id 
              ? `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`
              : null,
            animatedGif: asset.playback_ids?.[0]?.id
              ? `https://image.mux.com/${asset.playback_ids[0].id}/animated.gif`
              : null,
          }
        });
      }
      
      return NextResponse.json({
        success: true,
        status: upload.status,
        asset: null
      });
    }

    if (assetId) {
      // Get asset by Mux asset ID
      const asset = await mux.video.assets.retrieve(assetId);
      return NextResponse.json({
        success: true,
        asset: {
          id: asset.id,
          status: asset.status,
          playbackId: asset.playback_ids?.[0]?.id,
          duration: asset.duration,
          aspectRatio: asset.aspect_ratio,
        }
      });
    }

    return NextResponse.json(
      { success: false, error: 'Missing assetId or uploadId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Mux get error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
