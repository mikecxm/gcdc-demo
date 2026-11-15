import { createContext } from 'react';
import type { UserRole, UserResponse } from '../services/api';

export interface AuthContextType {
  user: UserResponse | null;
  role: UserRole;
  isAuthenticated: boolean;
  token: string | null;
  setDevRole: (role: UserRole) => void;
  setUser: (user: UserResponse | null) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
