import React, { createContext, useContext, useState } from 'react';
import { authService } from '../services/authService';
import { AdminAuthUser } from '../types/user';

interface AuthContextType {
  user: AdminAuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminAuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminAuthUser | null>(null);
  const [loading, setLoading] = useState(false);

  // Note: sessions are NOT auto-restored on mount.
  // Users must explicitly log in via the login() call on the HomePage.

  const login = async (email: string, password: string): Promise<AdminAuthUser> => {
    const authUser = await authService.adminLogin(email, password);
    setUser(authUser);
    return authUser;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
