import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { mockCadastrar, mockLogin, mockLogout, mockGetSessao } from '../services/pedidos';
import { Usuario } from '../types';

interface AuthContextType {
  user: { uid: string } | null;
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string, tipo: 'motoboy' | 'lojista') => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string, tipo: 'motoboy' | 'lojista') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ uid: string } | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sessao = await mockGetSessao();
      if (sessao) {
        setUsuario(sessao);
        setUser({ uid: sessao.id });
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, senha: string, tipo: 'motoboy' | 'lojista') => {
    const u = await mockLogin(email, senha);
    if (u.tipo !== tipo) {
      throw new Error(`Este login é para ${u.tipo === 'motoboy' ? 'Motoboy' : 'Lojista'}`);
    }
    setUsuario(u);
    setUser({ uid: u.id });
  };

  const cadastrar = async (nome: string, email: string, senha: string, tipo: 'motoboy' | 'lojista') => {
    const u = await mockCadastrar(nome, email, senha, tipo);
    setUsuario(u);
    setUser({ uid: u.id });
  };

  const logout = async () => {
    await mockLogout();
    setUsuario(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, usuario, loading, login, cadastrar, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);