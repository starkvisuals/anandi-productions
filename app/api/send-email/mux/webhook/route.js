import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Mux from '@mux/mux-node';

// Mux sends webhooks when video processing is complete
// Configure webhook URL in Mux dashboard: https://dashboard.mux.com/settings/webhooks
// Set to: https://your-domain.vercel.app/api/mux/webhook

export async function POST(request) {
  try {
    const body = await request.json();
    const headersList = headers();
    
    // Verify webhook signature (optional but recommended)
    // const signature = headersList.get('mux-signature');
    // You can verify this with your webhook signing secret
    
    const { type, data } = body;
    
    console.log('Mux webhook received:', type);
    
    switch (type) {
      case 'video.asset.ready':
        // Video is ready for playback
        const asset = data;
        const playbackId = asset.playback_ids?.[0]?.id;
        const passthrough = asset.passthrough ? JSON.parse(asset.passthrough) : {};
        
        console.log('Video ready:', {
          assetId: asset.id,
          playbackId,
          duration: asset.duration,
          aspectRatio: asset.aspect_ratio,
          projectId: passthrough.projectId,
          originalAssetId: passthrough.assetId,
        });
        
        // Here you could update your Firebase database with the Mux playback info
        // For now, we'll poll from the frontend
        
        break;
        
      case 'video.asset.errored':
        console.error('Video processing failed:', data);
        break;
        
      case 'video.upload.asset_created':
        console.log('Upload complete, asset created:', data.asset_id);
        break;
        
      case 'video.upload.cancelled':
        console.log('Upload cancelled');
        break;
        
      default:
        console.log('Unhandled webhook type:', type);
    }
    
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// Mux needs to verify the endpoint exists
export async function GET() {
  return NextResponse.json({ status: 'Mux webhook endpoint active' });
}
