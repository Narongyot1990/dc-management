import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const originLat = searchParams.get('origin_lat');
    const originLon = searchParams.get('origin_lon');
    const destLat = searchParams.get('dest_lat');
    const destLon = searchParams.get('dest_lon');

    if (!originLat || !originLon || !destLat || !destLon) {
      return NextResponse.json(
        { error: 'Missing coordinates' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ORS API key not configured' },
        { status: 500 }
      );
    }

    // ORS uses lon,lat order
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${originLon},${originLat}&end=${destLon},${destLat}`;

    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('ORS API error:', res.status, text);
      return NextResponse.json(
        { error: `ORS API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    const feature = data.features?.[0];
    if (!feature) {
      return NextResponse.json({ error: 'No route found' }, { status: 404 });
    }

    // Extract coordinates (GeoJSON: [lon, lat] → convert to [lat, lon] for Leaflet)
    const coordinates: [number, number][] =
      feature.geometry.coordinates.map((c: number[]) => [c[1], c[0]]);

    const summary = feature.properties?.summary || {};

    return NextResponse.json({
      coordinates,
      distance: summary.distance || 0, // meters
      duration: summary.duration || 0, // seconds
    });
  } catch (error: unknown) {
    console.error('Directions API error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
