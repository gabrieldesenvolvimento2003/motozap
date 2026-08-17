import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { storage } from '../storage';
import { API_URL } from '../services/api';

interface AuthContextType {
  user: { uid: string } | null;
  usuario: { id: string; nome: string; email: string; tipo: string } | null;
  loading: boolean;
  login: (email: string, senha: string, tipo: 'motoboy' | 'lojista') => Promise<void>;
  cadastrarLojista: (nome: string, email: string, senha: string) => Promise<void>;
  ativarMotoboy: (codigo: string, nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [usuario, setUsuario] = useState<{ id: string; nome: string; email: string; tipo: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const userId = await storage.getItem('userId');
      const userData = await storage.getItem('userData');
      if (userId && userData) {
        try {
          setUsuario(JSON.parse(userData));
          setUser({ uid: userId });
        } catch {
          // dados corrompidos
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, senha: string, tipo: 'motoboy' | 'lojista') => {
    const endpoint = tipo === 'lojista' ? '/lojista/session' : '/session';
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Credenciais inválidas');

    // Busca dados do usuário
    const userRes = await fetch(`${API_URL}/usuarios`);
    const usuarios = await userRes.json();
    const u = usuarios.find((x: any) => x.id === data.userId);
    if (!u) throw new Error('Usuário não encontrado');

    await storage.setItem('userId', data.userId);
    await storage.setItem('userData', JSON.stringify(u));
    setUsuario(u);
    setUser({ uid: data.userId });
  };

  const cadastrarLojista = async (nome: string, email: string, senha: string) => {
    const res = await fetch(`${API_URL}/lojista/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao cadastrar');

    const u = { id: data.id, nome: data.nome, email: data.email, tipo: 'lojista' };
    await storage.setItem('userId', data.id);
    await storage.setItem('userData', JSON.stringify(u));
    setUsuario(u);
    setUser({ uid: data.id });
  };

  const ativarMotoboy = async (codigo: string, nome: string, email: string, senha: string) => {
    const res = await fetch(`${API_URL}/motoboy/ativar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nome, email, senha }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao ativar');

    const u = { id: data.id, nome: data.nome, email: data.email, tipo: 'motoboy' };
    await storage.setItem('userId', data.id);
    await storage.setItem('userData', JSON.stringify(u));
    setUsuario(u);
    setUser({ uid: data.id });
  };

  const logout = async () => {
    await storage.removeItem('userId');
    await storage.removeItem('userData');
    setUsuario(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, usuario, loading, login, cadastrarLojista, ativarMotoboy, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
