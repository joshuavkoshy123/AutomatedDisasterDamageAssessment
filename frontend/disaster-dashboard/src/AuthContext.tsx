import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './firebase';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

/* ─────────────────────────────────────────────
   Context
───────────────────────────────────────────── */
const AuthContext = createContext<AuthContextType | null>(null);

/* ─────────────────────────────────────────────
   Provider
───────────────────────────────────────────── */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // true until Firebase resolves the session

  // Listen for Firebase auth state changes (handles page refresh / persistence)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe; // cleanup on unmount
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    localStorage.removeItem('userInfo');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ─────────────────────────────────────────────
   Hook
───────────────────────────────────────────── */
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};