import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('care_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile');
      setUser(res.data);
    } catch (err) {
      console.error('[AuthContext] Token verification failed:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('care_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const startSession = async (request) => {
    const res = await request;
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('care_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = (formData) => startSession(api.post('/auth/register', formData));
  const registerStaff = (formData) => startSession(api.post('/auth/staff/register', formData));
  const applyAsDoctor = (formData) => startSession(api.post('/auth/doctor/apply', formData));
  const googleLogin = (credential) => startSession(api.post('/auth/google', { credential }));

  const logout = () => {
    localStorage.removeItem('care_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, registerStaff, applyAsDoctor, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
