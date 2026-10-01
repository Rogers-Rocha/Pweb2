// SERVICE - regras de negócio. Não conhece req/res (independente de HTTP).
const HttpError = require('../errors/HttpError');

const pedidos = [
  { id: 1, usuarioId: 1, item: 'Teclado', total: 150 },
  { id: 2, usuarioId: 1, item: 'Mouse', total: 80 },
  { id: 3, usuarioId: 2, item: 'Monitor', total: 900 },
];

// (Em um projeto real, estas funções chamariam um model/repositório que acessa o banco.)
async function listarDoUsuario(usuarioId) {
  console.log('[service] listarDoUsuario');
  return pedidos.filter(p => p.usuarioId === usuarioId);
}

async function buscarPorId(id, usuarioId) {
  console.log('[service] buscarPorId');
  const pedido = pedidos.find(p => p.id === id);
  if (!pedido) throw new HttpError(404, 'PEDIDO_NAO_ENCONTRADO', `Pedido ${id} não existe`);
  if (pedido.usuarioId !== usuarioId) throw new HttpError(403, 'ACESSO_NEGADO', 'Pedido pertence a outro usuário');
  return pedido;
}

module.exports = { listarDoUsuario, buscarPorId };
