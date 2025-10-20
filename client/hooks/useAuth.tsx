import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiService } from '../services/apiService';

interface User {
  id: string;
  email: string;
  name: string;
  accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
  tenantId: string;
  tenantName: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, key: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  error: string | null; // Adicionado para o erro de login
  setError: (message: string | null) => void; // Adicionado para definir o erro
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Estado para gerenciar erros de login
  const [isAuthenticated, setIsAuthenticated] = useState(false); // Estado para gerenciar autenticação

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        console.log('No access token found');
        setIsLoading(false);
        return;
      }

      // Set token in apiService
      apiService.setToken(token);

      console.log('Checking auth status with token...');
      const response = await apiService.getProfile();
      console.log('Auth check successful:', response.user);
      setUser(response.user);
      setIsAuthenticated(true);
      setError(null);
    } catch (error: any) {
      console.error('Auth check failed:', error);

      // Clear tokens if refresh failed or no refresh token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      apiService.clearToken();
      setUser(null);
      setIsAuthenticated(false);
      setError('Sessão expirada. Por favor, faça login novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true); // Inicia o carregamento
    setError(null); // Limpa erros anteriores
    try {
      const data = await apiService.login(email, password); // usa JSON direto do apiService

      if (data.tokens) {
        localStorage.setItem('access_token', data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.tokens.refreshToken); // ✅ CORREÇÃO CRÍTICA
        apiService.setToken(data.tokens.accessToken); // Define o token para futuras requisições
        setUser(data.user);
        setIsAuthenticated(true);
        setError(null);
      } else {
        setError('Login falhou: Tokens não recebidos.');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err: any) {
      let errorMessage = err?.message || 'Login failed';

      // Verificar se é erro de tenant inativo
      if (errorMessage.includes('Renove Sua Conta')) {
        errorMessage = 'Renove Sua Conta ou Entre em contato com o Administrador do Sistema';
      } else if (errorMessage.toLowerCase().includes('invalid')) {
        errorMessage = 'Email ou senha inválidos.';
      }

      setError(errorMessage);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false); // Finaliza o carregamento
    }
  };

  const register = async (email: string, password: string, name: string, key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.register(email, password, name, key); // usa JSON direto

      if (data.tokens) {
        localStorage.setItem('access_token', data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.tokens.refreshToken);
        apiService.setToken(data.tokens.accessToken);
        setUser(data.user);
        setIsAuthenticated(true);
        setError(null);
      } else {
        setError('Registro falhou: Tokens não recebidos.');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err: any) {
      let errorMessage = err?.message || 'Registration failed';

      if (errorMessage.includes('EMAIL_ALREADY_EXISTS')) {
        errorMessage = 'Este email já está em uso.';
      } else if (errorMessage.includes('Chave de acesso inválida')) {
        errorMessage = 'Chave de acesso inválida.';
      }

      setError(errorMessage);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      apiService.clearToken();
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated,
    error,
    setError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}