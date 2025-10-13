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
      setIsAuthenticated(true); // Define como autenticado se o token for válido
    } catch (error: any) {
      console.error('Auth check failed:', error);

      // Try to refresh token first
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken && (error?.response?.status === 401 || error?.response?.status === 403)) {
        try {
          console.log('Attempting token refresh...');
          const refreshResponse = await apiService.refreshToken(refreshToken);
          setUser(refreshResponse.user);
          localStorage.setItem('access_token', refreshResponse.tokens.accessToken); // Atualiza o access token
          localStorage.setItem('refresh_token', refreshResponse.tokens.refreshToken); // Atualiza o refresh token
          apiService.setToken(refreshResponse.tokens.accessToken); // Atualiza o token no apiService
          setIsAuthenticated(true);
          setError(null); // Limpa o erro se a atualização for bem-sucedida
          return;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }
      }

      // Clear tokens if refresh failed or no refresh token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      apiService.clearToken();
      setUser(null);
      setIsAuthenticated(false); // Define como não autenticado se o refresh falhar
      setError('Sessão expirada. Por favor, faça login novamente.'); // Define um erro genérico para expiração
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true); // Inicia o carregamento
    setError(null); // Limpa erros anteriores
    try {
      const response = await apiService.login(email, password);
      const data = response.data; // Assumindo que a resposta da apiService já é o JSON parseado

      if (data.tokens) {
        localStorage.setItem('access_token', data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.tokens.refreshToken); // ✅ CORREÇÃO CRÍTICA
        apiService.setToken(data.tokens.accessToken); // Define o token para futuras requisições
        setUser(data.user);
        setIsAuthenticated(true);
        setError(null);
      } else {
        // Lidar com caso onde não há tokens retornados (embora o backend deva retornar sempre)
        setError('Login falhou: Tokens não recebidos.');
        setIsAuthenticated(false);
      }
    } catch (err: any) {
        const errorData = err.response?.data;
        let errorMessage = err.response?.data?.error || err.message || 'Login failed';

        // Verificar se é erro de tenant inativo
        if (errorData?.code === 'TENANT_INACTIVE' || errorMessage.includes('Renove Sua Conta')) {
          errorMessage = 'Renove Sua Conta ou Entre em contato com o Administrador do Sistema';
        } else if (err.response?.status === 401 || err.response?.status === 403) {
            errorMessage = 'Email ou senha inválidos.';
        }

        setError(errorMessage);
        setIsAuthenticated(false); // Garante que está como não autenticado em caso de erro
        setUser(null); // Garante que o usuário está nulo
      } finally {
        setIsLoading(false); // Finaliza o carregamento
      }
  };

  const register = async (email: string, password: string, name: string, key: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.register(email, password, name, key);
      const data = response.data;
      if (data.tokens) {
        localStorage.setItem('access_token', data.tokens.accessToken);
        localStorage.setItem('refresh_token', data.tokens.refreshToken);
        apiService.setToken(data.tokens.accessToken);
        setUser(data.user);
        setIsAuthenticated(true);
      } else {
        setError('Registro falhou: Tokens não recebidos.');
        setIsAuthenticated(false);
      }
    } catch (err: any) {
        const errorData = err.response?.data;
        let errorMessage = err.response?.data?.error || err.message || 'Registration failed';

        if (errorData?.code === 'EMAIL_ALREADY_EXISTS') {
            errorMessage = 'Este email já está em uso.';
        } else if (errorData?.code === 'INVALID_KEY') {
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