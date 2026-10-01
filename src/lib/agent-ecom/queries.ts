import type { DatabaseSync } from "node:sqlite";

// As 7 funções do contrato "tools/functions necessárias" do doc de validação.
// Toda query aqui filtra manualmente por user_id — é o equivalente de RLS
// neste projeto, já que SQLite não tem RLS (ver nota em sqlite/migrations/0000_init.sql).

export interface ProdutoRow {
  id: string;
  user_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category: string | null;
  brand: string | null;
  status: "active" | "inactive" | "archived";
  price: number | null;
  cost: number | null;
  weight_grams: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

interface VarianteRow {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  attributes: string;
}

interface ImagemRow {
  id: string;
  storage_path: string;
  position: number;
  alt_text: string | null;
}

interface SaldoRow {
  id: string;
  variant_id: string | null;
  quantity: number;
  reserved: number;
  low_stock_threshold: number;
}

export interface ProdutoCompleto extends ProdutoRow {
  variantes: VarianteRow[];
  imagens: ImagemRow[];
  saldos: SaldoRow[];
}

/** getProduto — informe sku OU produtoId. */
export function getProduto(
  db: DatabaseSync,
  userId: string,
  input: { sku?: string | undefined; produtoId?: string | undefined },
): ProdutoCompleto | null {
  let produto: ProdutoRow | undefined;

  if (input.produtoId) {
    produto = db
      .prepare(`SELECT * FROM products WHERE id = ? AND user_id = ?`)
      .get(input.produtoId, userId) as unknown as ProdutoRow | undefined;
  } else if (input.sku) {
    produto = db
      .prepare(
        `SELECT * FROM products WHERE sku = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(input.sku, userId) as unknown as ProdutoRow | undefined;
  } else {
    throw new Error("Informe sku ou produtoId.");
  }

  if (!produto) return null;

  return {
    ...produto,
    variantes: db
      .prepare(
        `SELECT id, name, sku, price, attributes FROM product_variants WHERE product_id = ? ORDER BY created_at`,
      )
      .all(produto.id) as unknown as VarianteRow[],
    imagens: db
      .prepare(
        `SELECT id, storage_path, position, alt_text FROM product_images WHERE product_id = ? ORDER BY position`,
      )
      .all(produto.id) as unknown as ImagemRow[],
    saldos: db
      .prepare(
        `SELECT id, variant_id, quantity, reserved, low_stock_threshold FROM inventory_balances WHERE product_id = ?`,
      )
      .all(produto.id) as unknown as SaldoRow[],
  };
}

export interface CamposFaltantesResult {
  produto_id: string;
  campos_faltantes: string[];
}

const CAMPOS_CADASTRO: ReadonlyArray<{ campo: string; vazio: (p: ProdutoRow) => boolean }> = [
  { campo: "sku", vazio: (p) => !p.sku },
  { campo: "barcode", vazio: (p) => !p.barcode },
  { campo: "description", vazio: (p) => !p.description },
  { campo: "category", vazio: (p) => !p.category },
  { campo: "brand", vazio: (p) => !p.brand },
  { campo: "price", vazio: (p) => p.price === null },
  { campo: "cost", vazio: (p) => p.cost === null },
  { campo: "weight_grams", vazio: (p) => p.weight_grams === null },
  { campo: "length_cm", vazio: (p) => p.length_cm === null },
  { campo: "width_cm", vazio: (p) => p.width_cm === null },
  { campo: "height_cm", vazio: (p) => p.height_cm === null },
];

export function getCamposFaltantes(
  db: DatabaseSync,
  userId: string,
  produtoId: string,
): CamposFaltantesResult {
  const produto = db
    .prepare(`SELECT * FROM products WHERE id = ? AND user_id = ?`)
    .get(produtoId, userId) as unknown as ProdutoRow | undefined;
  if (!produto) throw new Error("Produto não encontrado.");

  const campos_faltantes = CAMPOS_CADASTRO.filter((c) => c.vazio(produto)).map((c) => c.campo);

  const imagens = db
    .prepare(`SELECT COUNT(*) as total FROM product_images WHERE product_id = ?`)
    .get(produtoId) as { total: number };
  if (imagens.total === 0) campos_faltantes.push("imagens");

  return { produto_id: produtoId, campos_faltantes };
}

export interface CorrespondenciaCatalogo {
  produto_id: string;
  nome: string;
  sku: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  description: string | null;
}

/**
 * Não existe (nem poderia existir) um catálogo global no schema atual: a
 * REGRA FIXA do prompt proíbe misturar dados entre contas. "Catálogo interno"
 * aqui é uma busca nos produtos que O PRÓPRIO vendedor já cadastrou, para
 * reaproveitar dado real (outro SKU do mesmo modelo/marca) em vez de inventar.
 */
export function buscarProdutoCatalogo(
  db: DatabaseSync,
  userId: string,
  input: { nome: string; marca?: string | undefined; modelo?: string | undefined },
): CorrespondenciaCatalogo[] {
  const termos = [input.nome, input.modelo].filter((t): t is string => Boolean(t && t.trim()));
  if (termos.length === 0) return [];

  const condicoes = termos.map(() => `name LIKE ?`).join(" OR ");
  const params: string[] = termos.map((t) => `%${t.trim()}%`);

  let sql = `SELECT id as produto_id, name as nome, sku, brand, category, price, description
             FROM products WHERE user_id = ? AND (${condicoes})`;
  const allParams: string[] = [userId, ...params];

  if (input.marca && input.marca.trim()) {
    sql += ` AND brand = ?`;
    allParams.push(input.marca.trim());
  }

  sql += ` ORDER BY updated_at DESC LIMIT 5`;

  return db.prepare(sql).all(...allParams) as unknown as CorrespondenciaCatalogo[];
}

export interface EstoqueAtualResult {
  produto_id: string;
  quantidade_atual: number;
  reservado: number;
  disponivel: number;
  saldos: Array<{ variant_id: string | null; quantidade: number; reservado: number }>;
}

export function getEstoqueAtual(
  db: DatabaseSync,
  userId: string,
  produtoId: string,
): EstoqueAtualResult {
  const produto = db
    .prepare(`SELECT id FROM products WHERE id = ? AND user_id = ?`)
    .get(produtoId, userId);
  if (!produto) throw new Error("Produto não encontrado.");

  const saldos = db
    .prepare(`SELECT variant_id, quantity, reserved FROM inventory_balances WHERE product_id = ?`)
    .all(produtoId) as unknown as Array<{
    variant_id: string | null;
    quantity: number;
    reserved: number;
  }>;

  const quantidade_atual = saldos.reduce((sum, s) => sum + s.quantity, 0);
  const reservado = saldos.reduce((sum, s) => sum + s.reserved, 0);

  return {
    produto_id: produtoId,
    quantidade_atual,
    reservado,
    disponivel: Math.max(0, quantidade_atual - reservado),
    saldos: saldos.map((s) => ({
      variant_id: s.variant_id,
      quantidade: s.quantity,
      reservado: s.reserved,
    })),
  };
}

export interface PontoVenda {
  data: string;
  quantidade: number;
}

export interface HistoricoVendasResult {
  produto_id: string;
  periodo_dias: number;
  serie: PontoVenda[];
  total_vendido: number;
  media_venda_dia: number;
}

/**
 * Fonte real é inventory_movements (type='sale'), não a tabela `sales`: sales
 * não tem product_id (é um registro por pedido, com título em texto livre),
 * então não dá pra somar vendas por produto ali sem heurística de texto.
 */
export function getHistoricoVendas(
  db: DatabaseSync,
  userId: string,
  input: { produtoId: string; periodoDias?: number | undefined },
): HistoricoVendasResult {
  const periodo_dias = input.periodoDias && input.periodoDias > 0 ? input.periodoDias : 30;
  const desde = new Date(Date.now() - periodo_dias * 24 * 60 * 60 * 1000).toISOString();

  const movimentos = db
    .prepare(
      `SELECT created_at, quantity FROM inventory_movements
       WHERE user_id = ? AND product_id = ? AND type = 'sale' AND created_at >= ?
       ORDER BY created_at`,
    )
    .all(userId, input.produtoId, desde) as unknown as Array<{
    created_at: string;
    quantity: number;
  }>;

  const porDia = new Map<string, number>();
  for (const mov of movimentos) {
    const dia = mov.created_at.slice(0, 10);
    porDia.set(dia, (porDia.get(dia) ?? 0) + Math.abs(mov.quantity));
  }

  const serie = [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, quantidade]) => ({ data, quantidade }));

  const total_vendido = serie.reduce((sum, p) => sum + p.quantidade, 0);

  return {
    produto_id: input.produtoId,
    periodo_dias,
    serie,
    total_vendido,
    media_venda_dia: Number((total_vendido / periodo_dias).toFixed(2)),
  };
}

export interface ProdutoEstoqueBaixo {
  produto_id: string;
  nome: string;
  sku: string | null;
  quantidade_atual: number;
  reservado: number;
  disponivel: number;
  limiar: number;
}

export function listarEstoqueBaixo(
  db: DatabaseSync,
  userId: string,
  limiarOpcional?: number,
): ProdutoEstoqueBaixo[] {
  const rows = db
    .prepare(
      `SELECT p.id as produto_id, p.name as nome, p.sku, p.low_stock_threshold,
              COALESCE(SUM(ib.quantity), 0) as quantidade_atual,
              COALESCE(SUM(ib.reserved), 0) as reservado
       FROM products p
       LEFT JOIN inventory_balances ib ON ib.product_id = p.id
       WHERE p.user_id = ? AND p.status = 'active'
       GROUP BY p.id`,
    )
    .all(userId) as unknown as Array<{
    produto_id: string;
    nome: string;
    sku: string | null;
    low_stock_threshold: number;
    quantidade_atual: number;
    reservado: number;
  }>;

  const resultado: ProdutoEstoqueBaixo[] = [];
  for (const r of rows) {
    const limiar = limiarOpcional ?? r.low_stock_threshold;
    const disponivel = Math.max(0, r.quantidade_atual - r.reservado);
    if (disponivel > limiar) continue;
    resultado.push({
      produto_id: r.produto_id,
      nome: r.nome,
      sku: r.sku,
      quantidade_atual: r.quantidade_atual,
      reservado: r.reservado,
      disponivel,
      limiar,
    });
  }

  return resultado.sort((a, b) => a.disponivel - b.disponivel);
}

export interface ProdutoSemMovimentacao {
  produto_id: string;
  nome: string;
  sku: string | null;
  quantidade_atual: number;
  dias_sem_venda: number;
  ultima_venda: string | null;
}

export function listarSemMovimentacao(
  db: DatabaseSync,
  userId: string,
  diasSemVenda: number,
): ProdutoSemMovimentacao[] {
  const rows = db
    .prepare(
      `SELECT p.id as produto_id, p.name as nome, p.sku, p.created_at,
              COALESCE((SELECT SUM(ib.quantity) FROM inventory_balances ib WHERE ib.product_id = p.id), 0) as quantidade_atual,
              (SELECT MAX(im.created_at) FROM inventory_movements im WHERE im.product_id = p.id AND im.type = 'sale') as ultima_venda
       FROM products p
       WHERE p.user_id = ? AND p.status = 'active'`,
    )
    .all(userId) as unknown as Array<{
    produto_id: string;
    nome: string;
    sku: string | null;
    created_at: string;
    quantidade_atual: number;
    ultima_venda: string | null;
  }>;

  const agora = Date.now();
  const resultado: ProdutoSemMovimentacao[] = [];

  for (const r of rows) {
    if (r.quantidade_atual <= 0) continue;
    const referencia = r.ultima_venda ?? r.created_at;
    const diasParados = Math.floor(
      (agora - new Date(referencia).getTime()) / (24 * 60 * 60 * 1000),
    );
    if (diasParados < diasSemVenda) continue;
    resultado.push({
      produto_id: r.produto_id,
      nome: r.nome,
      sku: r.sku,
      quantidade_atual: r.quantidade_atual,
      dias_sem_venda: diasParados,
      ultima_venda: r.ultima_venda,
    });
  }

  return resultado.sort((a, b) => b.dias_sem_venda - a.dias_sem_venda);
}
