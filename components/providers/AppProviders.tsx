"use client";

import { ReactNode } from 'react';
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ConnectionStatus } from "@/components/ConnectionStatus";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <LanguageProvider>
      <ConnectionStatus />
      {children}
    </LanguageProvider>
  );
}
