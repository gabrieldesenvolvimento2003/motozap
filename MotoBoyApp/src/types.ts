export interface Pedido {
  id: string;
  motoboyId: string;
  motoboyNome: string;
  lojaCode?: string;
  comandaNumero: string;
  clienteNome: string;
  clienteEndereco: string;
  clienteTelefone: string;
  clienteReferencia?: string; // ponto de referência (ex: "Sem referência", "Perto da padaria")
  valorTotal: number;   // taxa de entrega (quanto o motoboy ganha)
  valorPedido: number;   // valor do pedido (quanto o cliente paga)
  formasPagamento: FormaPagamento[];
  fotoComanda?: string; // URI local da foto tirada da comanda
  distancia?: number;   // km da loja até o cliente
  clienteLat?: number;  // lat do cliente (pra navegação)
  clienteLon?: number;  // lon do cliente (pra navegação)
  status: 'pendente' | 'saiu' | 'a_caminho' | 'cheguei' | 'entregue' | 'cancelado';
  subStatus?: 'contatando' | 'contato_ok' | 'cobrando'; // passo dentro de "cheguei"
  createdAt: Date;
  updatedAt: Date;
  historico: HistoricoStatus[];
}

export interface FormaPagamento {
  tipo: 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito';
  valor: number;
}

export interface HistoricoStatus {
  status: Pedido['status'];
  timestamp: Date;
  observacao?: string;
}

export interface Usuario {
  id: string;
  nome: string;
  tipo: 'motoboy' | 'lojista';
  email: string;
}

export interface Loja {
  id: string;
  motoboyId: string;
  nome: string;
  code: string;
}
