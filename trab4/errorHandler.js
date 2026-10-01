// MIDDLEWARE 3 - TRATAMENTO DE ERRO
// Reconhecido pelo Express pelos 4 parâmetros (fn.length === 4).
// É o ÚNICO ponto que decide o formato da resposta de erro.
module.exports = function errorHandler(err, req, res, next) {
  // Se os cabeçalhos já foram enviados, só podemos delegar ao handler padrão.
  if (res.headersSent) return next(err);

  const status = err.status || 500;
  const code = err.code || 'ERRO_INTERNO';
  // Em erros 5xx não vazamos detalhes internos ao cliente.
  const message = status >= 500 ? 'Erro interno do servidor' : err.message;

  console.log(`[erro] formatando resposta ${status} (${code})`);
  if (status >= 500) console.error(err);

  res.status(status).json({ erro: { codigo: code, mensagem: message } });
};
