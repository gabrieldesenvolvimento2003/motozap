// Mock auth + database local (substitui Firebase pra MVP)
// Tudo persiste no localStorage (web) ou AsyncStorage (celular)

import { storage } from '../storage';
import { Pedido, FormaPagamento, Usuario } from '../types';

const KEY_USUARIOS = 'mock_usuarios';
const KEY_SESSAO = 'mock_sessao';
const KEY_PEDIDOS = 'mock_pedidos';

interface StoredUser {
  id: string;
  nome: string;
  email: string;
  senha: string;
  tipo: 'motoboy' | 'lojista';
}

interface Sessao {
  userId: string;
}

// ============ AUTH ============

export async function mockCadastrar(nome: string, email: string, senha: string, tipo: 'motoboy' | 'lojista'): Promise<Usuario> {
  const raw = await storage.getItem(KEY_USUARIOS);
  const usuarios: StoredUser[] = raw ? JSON.parse(raw) : [];

  if (usuarios.find(u => u.email === email)) {
    throw new Error('Email já cadastrado');
  }

  const novoUser: StoredUser = {
    id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    nome,
    email,
    senha,
    tipo,
  };
  usuarios.push(novoUser);
  await storage.setItem(KEY_USUARIOS, JSON.stringify(usuarios));
  await storage.setItem(KEY_SESSAO, JSON.stringify({ userId: novoUser.id } as Sessao));

  return { id: novoUser.id, nome, email, tipo };
}

export async function mockLogin(email: string, senha: string): Promise<Usuario> {
  const raw = await storage.getItem(KEY_USUARIOS);
  const usuarios: StoredUser[] = raw ? JSON.parse(raw) : [];

  const user = usuarios.find(u => u.email === email && u.senha === senha);
  if (!user) throw new Error('Email ou senha incorretos');

  await storage.setItem(KEY_SESSAO, JSON.stringify({ userId: user.id } as Sessao));
  return { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
}

export async function mockLogout(): Promise<void> {
  await storage.removeItem(KEY_SESSAO);
}

export async function mockGetSessao(): Promise<Usuario | null> {
  const sessaoRaw = await storage.getItem(KEY_SESSAO);
  if (!sessaoRaw) return null;
  const sessao: Sessao = JSON.parse(sessaoRaw);

  const usuariosRaw = await storage.getItem(KEY_USUARIOS);
  if (!usuariosRaw) return null;
  const usuarios: StoredUser[] = JSON.parse(usuariosRaw);

  const user = usuarios.find(u => u.id === sessao.userId);
  if (!user) return null;
  return { id: user.id, nome: user.nome, email: user.email, tipo: user.tipo };
}

// ============ PEDIDOS ============

interface StoredPedido extends Pedido {}

export async function mockCriarPedido(
  motoboyId: string,
  motoboyNome: string,
  comandaNumero: string,
  clienteNome: string,
  clienteEndereco: string,
  clienteTelefone: string,
  valorTotal: number,
  formasPagamento: FormaPagamento[] = [],
  valorPedido?: number,
): Promise<string> {
  const raw = await storage.getItem(KEY_PEDIDOS);
  const pedidos: StoredPedido[] = raw ? JSON.parse(raw) : [];

  const novoPedido: StoredPedido = {
    id: 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    motoboyId,
    motoboyNome,
    comandaNumero,
    clienteNome,
    clienteEndereco,
    clienteTelefone,
    valorTotal,
    valorPedido: valorPedido || 0,
    formasPagamento,
    status: 'pendente',
    createdAt: new Date(),
    updatedAt: new Date(),
    historico: [{ status: 'pendente', timestamp: new Date() }],
  };

  pedidos.push(novoPedido);
  await storage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos));
  return novoPedido.id;
}

export async function mockAtualizarStatus(pedidoId: string, novoStatus: Pedido['status']): Promise<void> {
  const raw = await storage.getItem(KEY_PEDIDOS);
  const pedidos: StoredPedido[] = raw ? JSON.parse(raw) : [];

  const idx = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return;

  pedidos[idx].status = novoStatus;
  pedidos[idx].updatedAt = new Date();
  pedidos[idx].historico.push({ status: novoStatus, timestamp: new Date() });

  await storage.setItem(KEY_PEDIDOS, JSON.stringify(pedidos));
}

export async function mockObterPedidos(): Promise<Pedido[]> {
  const raw = await storage.getItem(KEY_PEDIDOS);
  if (!raw) return [];
  const pedidos: StoredPedido[] = JSON.parse(raw);
  return pedidos.map(p => ({
    ...p,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    historico: p.historico.map(h => ({ ...h, timestamp: new Date(h.timestamp) })),
  }));
}

// Simula tempo real: poll a cada 2s
export function mockSubscribeTodosPedidos(callback: (pedidos: Pedido[]) => void): () => void {
  let active = true;
  const tick = async () => {
    if (!active) return;
    const pedidos = await mockObterPedidos();
    callback(pedidos);
  };
  tick();
  const interval = setInterval(tick, 2000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

export function mockSubscribePedidosDoMotoboy(motoboyId: string, callback: (pedidos: Pedido[]) => void): () => void {
  let active = true;
  const tick = async () => {
    if (!active) return;
    const pedidos = (await mockObterPedidos()).filter(p => p.motoboyId === motoboyId);
    callback(pedidos);
  };
  tick();
  const interval = setInterval(tick, 2000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}