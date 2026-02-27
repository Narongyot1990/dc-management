'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ShipmentRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/plan'); }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}
