// CONTROLLER - traduz HTTP <-> aplicação. Sem regra de negócio.
// No Express 5, handlers async que rejeitam vão automaticamente para next(err).
const pedidoService = require('../services/pedidoService');

async function listar(req, res) {
  console.log('[controller] listar');
  const pedidos = await pedidoService.listarDoUsuario(req.user.id);
  res.status(200).json(pedidos);
}

async function buscar(req, res) {
  console.log('[controller] buscar');
  const id = Number(req.params.id);
  const pedido = await pedidoService.buscarPorId(id, req.user.id);
  res.status(200).json(pedido);
}

module.exports = { listar, buscar };
