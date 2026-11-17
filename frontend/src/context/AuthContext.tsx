import React, { useState, useMemo } from 'react';
import type { UserRole, UserResponse } from '../services/api';
import { AuthContext } from './authContextDef';

const DEV_USERS: Record<UserRole, UserResponse> = {
  AUTOR: {
    id: 101,
    email: 'carlos.mendoza@correounivalle.edu.co',
    full_name: 'Dr. Carlos Mendoza',
    affiliation: 'Universidad del Valle - Escuela de Ing. de Sistemas',
    roles: ['AUTOR'],
    is_active: true,
    created_at: '2026-03-10T10:00:00Z',
  },
  COMITE: {
    id: 202,
    email: 'elena.valencia@correounivalle.edu.co',
    full_name: 'Dra. Elena Valencia',
    affiliation: 'Universidad del Valle - Comité Científico Symposia',
    roles: ['COMITE'],
    is_active: true,
    created_at: '2026-01-15T09:30:00Z',
  },
  ADMIN: {
    id: 303,
    email: 'sarah.chen@correounivalle.edu.co',
    full_name: 'Sarah Chen',
    affiliation: 'Universidad del Valle - Dirección de Investigaciones',
    roles: ['ADMIN'],
    is_active: true,
    created_at: '2026-01-05T08:00:00Z',
  },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('symposia_active_role');
    return (saved as UserRole) || 'COMITE';
  });

  const [user, setUser] = useState<UserResponse | null>(() => {
    return DEV_USERS[role];
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('symposia_auth_token') || 'mock-dev-jwt-token-2026';
  });

  const setDevRole = (newRole: UserRole) => {
    setRoleState(newRole);
    setUser(DEV_USERS[newRole]);
    localStorage.setItem('symposia_active_role', newRole);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('symposia_auth_token');
    localStorage.removeItem('symposia_active_role');
  };

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated: Boolean(user),
      token,
      setDevRole,
      setUser,
      logout,
    }),
    [user, role, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

