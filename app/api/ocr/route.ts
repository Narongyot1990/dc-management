import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Get the Gemini 2.5 Flash model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Prepare the prompt
    const prompt = `You are a container number OCR specialist. Extract the shipping container number from this image.

STRICT RULES:
1. Container number format: EXACTLY 4 letters + EXACTLY 7 digits (total 11 characters)
2. The 4th letter MUST be U, J, or Z (ISO 6346 standard for freight containers)
3. Examples: CMAU9588857, KOCU4800112, FCIU1234567
4. IGNORE all other text, dates, labels, or numbers
5. If the serial number contains patterns like "2024", "2025", "2512" - these are likely dates, NOT container numbers

Response format (JSON only):
{
  "containerNumber": "CMAU9588857" // or null if not found
}

Return ONLY the JSON, no other text.`;

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    // Call Gemini API
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    console.log('📝 Gemini raw response:', text);

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate the container number format
        if (parsed.containerNumber) {
          const containerNo = parsed.containerNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const pattern = /^[A-Z]{3}[UJZ]\d{7}$/;

          if (pattern.test(containerNo)) {
            console.log('✅ Valid container number found:', containerNo);
            return NextResponse.json({
              containerNumber: containerNo,
              confidence: 'high'
            });
          } else {
            console.log('⚠️ Invalid format:', containerNo);
          }
        }
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    // No valid container number found
    return NextResponse.json({
      containerNumber: null,
      error: 'No valid container number found',
      rawResponse: text
    });

  } catch (error: any) {
    console.error('❌ Gemini API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process image',
        details: error.message
      },
      { status: 500 }
    );
  }
}
