import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface BookingScanResult {
  booking_no: string | null;
  container_no: string | null;
  seal_no: string | null;
  truck_plate: string | null;
  confidence: 'high' | 'medium' | 'low';
  missing_fields: string[];
}

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

    // Prepare the prompt for booking document scan
    const prompt = `You are a shipping document OCR specialist. Extract the following information from this document image:

1. **Booking Number** - Usually labeled as "Booking No", "Booking Number", "BK No", "BKG", or similar
2. **Container Number** - Format: EXACTLY 4 letters + 7 digits (e.g., TCLU1234567). The 4th letter is usually U, J, or Z
3. **Seal Number** - Usually labeled as "Seal No", "Seal Number", "S/N", or similar. Can be alphanumeric
4. **Truck Plate** - Thai license plate number. Format: xx-xxxx or xxx-xxxx (Thai or English characters + digits, e.g., 69-1234, 700-1234). If there are 2 plates (tractor head + trailer), pick ONLY the tractor head plate.

IMPORTANT RULES:
- Look for these fields in shipping documents, booking confirmations, container lists, or similar documents
- Container number MUST follow the ISO 6346 format: 4 letters (ending with U/J/Z) + 7 digits
- Truck plate: keep the original format with dash (e.g., กข-1234). Do NOT include province name.
- If a field is not found or unclear, return null for that field
- Do NOT guess or make up values

Response format (JSON only):
{
  "booking_no": "string or null",
  "container_no": "string or null (must be 11 characters: 4 letters + 7 digits)",
  "seal_no": "string or null",
  "truck_plate": "string or null"
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

    console.log('📝 Gemini booking scan response:', text);

    // Parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and clean container number
        let containerNo = parsed.container_no;
        if (containerNo) {
          containerNo = containerNo.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const pattern = /^[A-Z]{3}[UJZ]\d{7}$/;
          if (!pattern.test(containerNo)) {
            console.log('⚠️ Invalid container format:', containerNo);
            containerNo = null;
          }
        }

        // Build result
        const scanResult: BookingScanResult = {
          booking_no: parsed.booking_no || null,
          container_no: containerNo || null,
          seal_no: parsed.seal_no || null,
          truck_plate: parsed.truck_plate || null,
          confidence: 'high',
          missing_fields: []
        };

        // Check missing fields
        if (!scanResult.booking_no) scanResult.missing_fields.push('booking_no');
        if (!scanResult.container_no) scanResult.missing_fields.push('container_no');
        if (!scanResult.seal_no) scanResult.missing_fields.push('seal_no');
        if (!scanResult.truck_plate) scanResult.missing_fields.push('truck_plate');

        // Determine confidence level
        if (scanResult.missing_fields.length === 0) {
          scanResult.confidence = 'high';
        } else if (scanResult.missing_fields.length <= 1) {
          scanResult.confidence = 'medium';
        } else {
          scanResult.confidence = 'low';
        }

        console.log('✅ Booking scan result:', scanResult);
        return NextResponse.json(scanResult);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    // No valid data found
    return NextResponse.json({
      booking_no: null,
      container_no: null,
      seal_no: null,
      truck_plate: null,
      confidence: 'low',
      missing_fields: ['booking_no', 'container_no', 'seal_no', 'truck_plate'],
      error: 'Could not extract data from document',
      rawResponse: text
    });

  } catch (error: unknown) {
    console.error('❌ Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to process document',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
