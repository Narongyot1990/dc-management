import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import type { ScanResult } from '@/types';

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

    const prompt = `You are a Thai DC (Distribution Center) delivery document specialist.
Extract transport/operation information from this document image.

Fields to extract:
1. dc_number - DC document number (เลขที่เอกสาร DC)
2. document_date - Date the document was issued (วันที่ออกเอกสาร), format: DD/MM/YYYY
3. document_time - Time the document was issued (เวลาออกเอกสาร), format: HH:MM (24-hour)
4. delivery_date - Delivery date / ship date (วันที่ส่ง), format: DD/MM/YYYY
5. delivery_time - Scheduled delivery time (เวลานัดส่ง), format: HH:MM
6. return_date - Return to DC date (วันที่กลับ DC / นัดถึง DC), format: DD/MM/YYYY
7. return_time - Scheduled return time (เวลานัดถึง DC), format: HH:MM
8. driver_name - Primary driver name (พนักงานขับรถคนที่ 1)
9. driver_name_2 - Second driver name if present (พนักงานขับรถคนที่ 2), null if only 1 driver
10. driver_phone - Driver phone number (เบอร์โทร พขร.)
11. truck_plate_head - Head truck / tractor license plate (ทะเบียนหัวรถ), format: "XXX-XXXX"
12. truck_plate_tail - Trailer license plate (ทะเบียนหางพ่วง), format: "XXX-XXXX". null if no trailer
13. vehicle_type - ประเภทรถ, MUST return one of these values ONLY:
    "6W" = รถ 6 ล้อ ไม่มีหางพ่วง (no trailer plate)
    "6W+" = รถ 6 ล้อพ่วง / 6W-FULL TRAILER (มีหางพ่วง / has trailer plate)
    Determine by: if trailer plate exists → "6W+", if no trailer → "6W"
14. destination_branch - ชื่อสาขาปลายทางเท่านั้น (Branch name ONLY, not full company name)
    Example: document says "บริษัท ซีอาร์ซี ไทวัสดุ จำกัด (สาขาขอนแก่น)" → return "สาขาขอนแก่น"
    Example: document says "บริษัท อีซูซุตรัง จำกัด(สาขาขอนแก่น)" → return "สาขาขอนแก่น"
    Example: document says "สาขาเชียงใหม่" → return "สาขาเชียงใหม่"
    Look for customer/recipient field, extract ONLY the "สาขาXXX" portion
15. destination_address - Destination branch address (ที่อยู่สาขาปลายทาง)

RULES:
- If a field is not visible or unclear, return null for that field
- Dates must be DD/MM/YYYY format
- Times must be HH:MM format (24-hour)
- Keep Thai text as-is for names and addresses
- Truck plates: keep original format with dash, e.g. "XXX-XXXX"
- Do NOT guess or fabricate values
- Phone numbers: digits only, keep leading 0
- vehicle_type: ONLY "6W" or "6W+" - no other values allowed
- destination_branch: extract ONLY branch name (สาขาXXX), NOT full company name

Response format (JSON only):
{
  "dc_number": "string or null",
  "document_date": "string or null",
  "document_time": "string or null",
  "delivery_date": "string or null",
  "delivery_time": "string or null",
  "return_date": "string or null",
  "return_time": "string or null",
  "driver_name": "string or null",
  "driver_name_2": "string or null",
  "driver_phone": "string or null",
  "truck_plate_head": "string or null",
  "truck_plate_tail": "string or null",
  "vehicle_type": "string or null",
  "destination_branch": "string or null",
  "destination_address": "string or null"
}

Return ONLY the JSON, no other text.`;

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

    console.log('Gemini scan response:', text);

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const fields = [
          'dc_number', 'document_date', 'document_time', 'delivery_date', 'delivery_time',
          'return_date', 'return_time', 'driver_name', 'driver_name_2',
          'driver_phone', 'truck_plate_head', 'truck_plate_tail', 'vehicle_type',
          'destination_branch', 'destination_address',
        ];

        // driver_name_2 and truck_plate_tail are optional, don't count as missing
        const requiredFields = fields.filter(f => f !== 'driver_name_2' && f !== 'truck_plate_tail');
        const missing_fields = requiredFields.filter((f) => !parsed[f]);

        const scanResult: ScanResult = {
          dc_number: parsed.dc_number || null,
          document_date: parsed.document_date || null,
          document_time: parsed.document_time || null,
          delivery_date: parsed.delivery_date || null,
          delivery_time: parsed.delivery_time || null,
          return_date: parsed.return_date || null,
          return_time: parsed.return_time || null,
          driver_name: parsed.driver_name || null,
          driver_name_2: parsed.driver_name_2 || null,
          driver_phone: parsed.driver_phone || null,
          truck_plate_head: parsed.truck_plate_head || null,
          truck_plate_tail: parsed.truck_plate_tail || null,
          vehicle_type: parsed.vehicle_type || null,
          destination_branch: parsed.destination_branch || null,
          destination_address: parsed.destination_address || null,
          confidence: missing_fields.length === 0 ? 'high' : missing_fields.length <= 3 ? 'medium' : 'low',
          missing_fields,
        };

        return NextResponse.json(scanResult);
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
    }

    return NextResponse.json({
      error: 'Could not extract data from document',
      rawResponse: text,
    });
  } catch (error: unknown) {
    console.error('Gemini API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to process image', details: errorMessage },
      { status: 500 }
    );
  }
}
