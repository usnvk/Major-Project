import React, { createContext, useContext, useState } from 'react';
import { loginUser, registerUser, logoutUser } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('tb_auth_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed;
      }
    } catch (e) {
      // fallback
    }
    return null;
  });

  const login = async (email, password) => {
    const res = await loginUser(email, password);
    if (res.success && res.data?.user) {
      const userData = res.data.user;
      const token = res.data.token || `token_${Date.now()}`;
      setUser(userData);
      localStorage.setItem('tb_auth_user', JSON.stringify(userData));
      localStorage.setItem('tb_auth_token', token);
      return { success: true, user: userData };
    }
    return { success: false, error: res.error || 'Invalid credentials' };
  };

  const register = async (userData) => {
    const res = await registerUser(userData);
    if (res.success && res.data?.user) {
      const newUser = res.data.user;
      const token = res.data.token || `token_${Date.now()}`;
      setUser(newUser);
      localStorage.setItem('tb_auth_user', JSON.stringify(newUser));
      localStorage.setItem('tb_auth_token', token);
      return { success: true, user: newUser };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const logout = async () => {
    try {
      if (user?.email) {
        await logoutUser(user.email, user.role);
      }
    } catch (e) {
      // ignore network errors on logout
    } finally {
      setUser(null);
      localStorage.removeItem('tb_auth_user');
      localStorage.removeItem('tb_auth_token');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        role: user?.role || null,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
