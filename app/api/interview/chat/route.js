export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildInterviewSystemPrompt } from '@/lib/interview-questions';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { interviewId, userMessage } = await request.json();

    if (!interviewId || !userMessage?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get interview from Firestore
    const { getInterview, updateInterviewMessages } = await import('@/lib/interview-firestore');
    const interview = await getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    if (interview.status === 'completed') {
      return NextResponse.json({ error: 'Interview already completed' }, { status: 400 });
    }

    // Build messages array
    const messages = [...(interview.messages || [])];
    messages.push({ role: 'user', content: userMessage });

    const systemPrompt = buildInterviewSystemPrompt(interview.position, interview.candidateName);

    // Stream response from Claude
    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const anthropicStream = client.messages.stream({
            model: 'claude-opus-4-6',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
          });

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullResponse += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          // Save updated messages to Firestore
          const updatedMessages = [
            ...messages,
            { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString() },
          ];
          // Fix user message to include timestamp
          updatedMessages[updatedMessages.length - 2].timestamp = new Date().toISOString();

          await updateInterviewMessages(interviewId, updatedMessages);
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
