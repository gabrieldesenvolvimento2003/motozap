// Cliente HTTP pra sync server (server/sync.js na porta 7777)
// Substitui mock.ts — mesmas assinaturas, fetch + polling 2s
// Sessão é guardada em storage local (currentUserId), enviada no header X-User-Id.

import { storage } from '../storage';
import { Pedido, FormaPagamento, Usuario, Loja } from '../types';

// URL do sync server. Em produção, aponta pra Railway/Render etc.
// Em dev (localhost), aponta pro seu PC.
// Em runtime, ler de process.env.EXPO_PUBLIC_API_URL — Expo expõe ao bundle web/native.
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:7777';
const BASE = API_BASE;
const SESSION_KEY = 'currentUserId';

// ============ Sessão local ============

async function getCurrentUserId(): Promise<string | null> {
  return storage.getItem(SESSION_KEY);
}

async function setCurrentUserId(id: string | null): Promise<void> {
  if (id == null) await storage.removeItem(SESSION_KEY);
  else await storage.setItem(SESSION_KEY, id);
}

// ============ Fetch helper ============

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const userId = await getCurrentUserId();
  if (userId) headers['X-User-Id'] = userId;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

// ============ Auth ============

export async function apiCadastrar(nome: string, email: string, senha: string, tipo: 'motoboy' | 'lojista'): Promise<Usuario> {
  const u = await request<Usuario>('POST', '/usuarios', { nome, email, senha, tipo });
  await setCurrentUserId(u.id);
  return u;
}

export async function apiLogin(email: string, senha: string): Promise<Usuario> {
  const { userId } = await request<{ userId: string }>('POST', '/session', { email, senha });
  await setCurrentUserId(userId);
  // Busca o user completo
  const all = await request<Usuario[]>('GET', '/usuarios');
  const u = all.find(x => x.id === userId);
  if (!u) throw new Error('usuário sumiu');
  return u;
}

export async function apiLogout(): Promise<void> {
  try { await request('DELETE', '/session'); } catch {}
  await setCurrentUserId(null);
}

export async function apiGetSessao(): Promise<Usuario | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  try {
    const all = await request<Usuario[]>('GET', '/usuarios');
    return all.find(x => x.id === userId) || null;
  } catch {
    return null;
  }
}

// ============ Pedidos ============

function normalizePedido(p: any): Pedido {
  return {
    ...p,
    createdAt: new Date(p.createdAt),
    updatedAt: new Date(p.updatedAt),
    historico: (p.historico || []).map((h: any) => ({
      status: h.status,
      timestamp: new Date(h.timestamp),
      observacao: h.observacao,
    })),
  };
}

export async function apiCriarPedido(
  comandaNumero: string,
  clienteNome: string,
  clienteEndereco: string,
  clienteTelefone: string,
  valorTotal: number,
  fotoComanda?: string,
  formasPagamento: FormaPagamento[] = [],
  valorPedido?: number,
  distancia?: number,
  clienteReferencia?: string,
  clienteLat?: number,
  clienteLon?: number,
): Promise<string> {
  const { id } = await request<{ id: string }>('POST', '/pedidos', {
    comandaNumero, clienteNome, clienteEndereco, clienteTelefone, valorTotal,
    valorPedido, distancia, fotoComanda, formasPagamento, clienteReferencia,
    clienteLat, clienteLon,
  });
  return id;
}

export async function apiExcluirPedido(pedidoId: string): Promise<void> {
  await request('DELETE', `/pedidos/${pedidoId}`);
}

export async function apiAtualizarStatus(
  pedidoId: string,
  novoStatus: Pedido['status'],
  formasPagamento?: FormaPagamento[],
  subStatus?: Pedido['subStatus'] | null,
): Promise<void> {
  const body: any = { status: novoStatus };
  if (subStatus !== undefined) body.subStatus = subStatus;
  if (novoStatus === 'entregue' && formasPagamento) {
    body.formasPagamento = formasPagamento;
  }
  await request('PATCH', `/pedidos/${pedidoId}`, body);
}

// ============ Lojas ============

export async function apiListarLojas(): Promise<Loja[]> {
  return request<Loja[]>('GET', '/lojas');
}

export async function apiCriarLoja(nome: string): Promise<Loja> {
  return request<Loja>('POST', '/lojas', { nome });
}

export async function apiObterPedidosPorLoja(code: string): Promise<Pedido[]> {
  const raw = await request<any[]>('GET', `/lojas/pedidos?code=${encodeURIComponent(code)}`);
  return raw.map(normalizePedido);
}

export async function apiObterPedidos(motoboyId?: string): Promise<Pedido[]> {
  const path = motoboyId ? `/pedidos?motoboyId=${encodeURIComponent(motoboyId)}` : '/pedidos';
  const raw = await request<any[]>('GET', path);
  return raw.map(normalizePedido);
}

// ============ Subscribe (polling 2s, mesma API do mock anterior) ============

export function apiSubscribeTodosPedidos(callback: (pedidos: Pedido[]) => void): () => void {
  let active = true;
  const tick = async () => {
    if (!active) return;
    try {
      const pedidos = await apiObterPedidos();
      callback(pedidos);
    } catch (e) {
      // silencioso — pode ser transient (server reiniciando)
    }
  };
  tick();
  const interval = setInterval(tick, 2000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}

export function apiSubscribePedidosDoMotoboy(motoboyId: string, callback: (pedidos: Pedido[]) => void): () => void {
  let active = true;
  const tick = async () => {
    if (!active) return;
    try {
      const pedidos = await apiObterPedidos(motoboyId);
      callback(pedidos);
    } catch {}
  };
  tick();
  const interval = setInterval(tick, 2000);
  return () => {
    active = false;
    clearInterval(interval);
  };
}
