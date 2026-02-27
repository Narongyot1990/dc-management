'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type Role = 'leader' | 'driver' | null;

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextType>({
  role: null,
  setRole: () => {},
  clearRole: () => {},
});

const STORAGE_KEY = 'dc-management-role';

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Role;
    if (saved === 'leader' || saved === 'driver') {
      setRoleState(saved);
    }
    setHydrated(true);
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    if (r) {
      localStorage.setItem(STORAGE_KEY, r);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!hydrated) {
    return null;
  }

  return (
    <RoleContext.Provider value={{ role, setRole, clearRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
