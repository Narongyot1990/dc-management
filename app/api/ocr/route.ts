import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CONTAINER_NUMBER_RULES = `Container number format: EXACTLY 4 letters + EXACTLY 7 digits (total 11 characters). The 4th letter MUST be U, J, or Z (ISO 6346 standard for freight containers). Examples: CMAU9588857, KOCU4800112, FCIU1234567. IGNORE dates, weights, and other numbers near it.`;

const CONTAINER_ONLY_PROMPT = `You are a container number OCR specialist. Extract the shipping container number from this image.

STRICT RULES:
1. ${CONTAINER_NUMBER_RULES}
2. If the serial number contains patterns like "2024", "2025", "2512" - these are likely dates, NOT container numbers

Response format (JSON only):
{
  "containerNumber": "CMAU9588857" // or null if not found
}

Return ONLY the JSON, no other text.`;

// Used for the Yard Check scanner: also tries to read the ISO 6346 size/type code
// (e.g. "22G1", "45G1") stamped on the container door and the trailer/chassis
// registration plate visible in the same photo.
const YARD_SCAN_PROMPT = `You are a container yard inspector reading a photo that may show a shipping container's door plate and/or a trailer (chassis) registration plate.

Extract up to three things:

1. containerNumber — ${CONTAINER_NUMBER_RULES}

2. size — the container's length/height bucket, derived from the 4-character ISO 6346 size-type code printed under the container number (e.g. "22G1", "4500", "45G1", "42G1"). Apply this rule to the code's first two digits only (ignore the last two characters, which are the type code like G1/G0/R1/V0 and don't affect size):
   - 1st digit "2" (20-foot length) -> "20GP"
   - 1st digit "4" (40-foot length) AND 2nd digit "5" (9'6" high-cube height) -> "40HC"
   - 1st digit "4" AND 2nd digit is anything else (e.g. "0", "2") -> "40GP"
   - If the code isn't visible/legible, return null. Do not guess from the container number alone.

3. chassisPlate — the Thai trailer/chassis vehicle registration number (NOT the truck's own plate). It is printed on the trailer's yellow license plate (format: "THAILAND <province code>" above the number, province name in Thai below), as digits separated by a dash, e.g. "74-7267" or "700-7969" (the prefix can be 1-4 digits). A nearby red-and-white striped sign that just reads "รถพ่วง" is only a vehicle-type label, not the registration — do not read digits from it. Return just the plate number (digits and dash) from the yellow registration plate. If not visible/legible, return null.

Only fill a field when you are confident; leave it null rather than guessing.

Response format (JSON only):
{
  "containerNumber": "CMAU9588857" or null,
  "size": "40HC" or null,
  "chassisPlate": "74-7267" or null
}

Return ONLY the JSON, no other text.`;

const VALID_SIZES = new Set(['20GP', '40GP', '40HC']);
const CONTAINER_PATTERN = /^[A-Z]{3}[UJZ]\d{7}$/;
const CHASSIS_PLATE_PATTERN = /^\d{1,4}-\d{3,5}$/;

export async function POST(request: NextRequest) {
  try {
    const { image, mode } = await request.json();
    const isYardMode = mode === 'yard';

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

    const prompt = isYardMode ? YARD_SCAN_PROMPT : CONTAINER_ONLY_PROMPT;

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

        let containerNumber: string | null = null;
        if (parsed.containerNumber) {
          const candidate = String(parsed.containerNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (CONTAINER_PATTERN.test(candidate)) {
            containerNumber = candidate;
          } else {
            console.log('⚠️ Invalid container number format:', candidate);
          }
        }

        if (!isYardMode) {
          if (containerNumber) {
            console.log('✅ Valid container number found:', containerNumber);
            return NextResponse.json({ containerNumber, confidence: 'high' });
          }
          return NextResponse.json({
            containerNumber: null,
            error: 'No valid container number found',
            rawResponse: text,
          });
        }

        // Yard mode: also validate/normalize size + chassis plate
        let size: string | null = null;
        if (parsed.size && VALID_SIZES.has(String(parsed.size).toUpperCase())) {
          size = String(parsed.size).toUpperCase();
        }

        let chassisPlate: string | null = null;
        if (parsed.chassisPlate) {
          const candidate = String(parsed.chassisPlate).toUpperCase().replace(/\s+/g, '');
          if (CHASSIS_PLATE_PATTERN.test(candidate)) {
            chassisPlate = candidate;
          } else {
            console.log('⚠️ Invalid chassis plate format:', candidate);
          }
        }

        console.log('✅ Yard scan result:', { containerNumber, size, chassisPlate });
        return NextResponse.json({
          containerNumber,
          size,
          chassisPlate,
          error: containerNumber ? undefined : 'No valid container number found',
          rawResponse: containerNumber ? undefined : text,
        });
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    // No valid JSON found
    return NextResponse.json({
      containerNumber: null,
      size: null,
      chassisPlate: null,
      error: 'No valid container number found',
      rawResponse: text
    });

  } catch (error) {
    console.error('❌ Gemini API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process image',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
