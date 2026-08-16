// Pedidos service — usa sync server (server/sync.js na 7777)
// ponytail: trocar api por Firebase/Supabase quando for validar com dados reais

import { Pedido, FormaPagamento } from '../types';
import {
  apiCriarPedido,
  apiAtualizarStatus,
  apiExcluirPedido,
  apiSubscribePedidosDoMotoboy,
  apiSubscribeTodosPedidos,
} from './api';

// Re-exports da API pra AuthContext
export { apiCadastrar as mockCadastrar, apiLogin as mockLogin, apiLogout as mockLogout, apiGetSessao as mockGetSessao } from './api';

export async function criarPedido(
  _motoboyId: string,
  _motoboyNome: string,
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
  return apiCriarPedido(
    comandaNumero, clienteNome, clienteEndereco, clienteTelefone,
    valorTotal, fotoComanda, formasPagamento, valorPedido, distancia, clienteReferencia,
    clienteLat, clienteLon,
  );
}

export async function atualizarStatusPedido(
  pedidoId: string,
  novoStatus: Pedido['status'],
  formasPagamento?: FormaPagamento[],
  subStatus?: Pedido['subStatus'] | null,
): Promise<void> {
  return apiAtualizarStatus(pedidoId, novoStatus, formasPagamento, subStatus);
}

export async function excluirPedido(pedidoId: string): Promise<void> {
  return apiExcluirPedido(pedidoId);
}

export function subscribePedidosDoMotoboy(motoboyId: string, callback: (pedidos: Pedido[]) => void) {
  return apiSubscribePedidosDoMotoboy(motoboyId, callback);
}

export function subscribeTodosPedidos(callback: (pedidos: Pedido[]) => void) {
  return apiSubscribeTodosPedidos(callback);
}
