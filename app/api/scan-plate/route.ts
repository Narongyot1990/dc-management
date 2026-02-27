import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are a Thai truck license plate reader.
Extract the truck license plate number from this image.

The plate format is typically Thai format like:
- "1กก-1234" or "70-1234" or "700-1234"
- It may have Thai characters mixed with numbers
- Focus on the MAIN plate number (head truck plate, ทะเบียนหัวรถ)

Response format (JSON only):
{
  "truck_plate_head": "string or null"
}

RULES:
- Return ONLY the JSON, no other text
- If no plate is visible, return null
- Keep the original format with dash if present
- Remove spaces but keep dashes`;

    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg',
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();

    console.log('Gemini plate scan response:', text);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json({
        success: true,
        truck_plate_head: parsed.truck_plate_head || null,
      });
    }

    return NextResponse.json({ success: false, error: 'Could not extract plate' });
  } catch (error: unknown) {
    console.error('Scan plate error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
