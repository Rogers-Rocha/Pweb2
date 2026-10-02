// MIDDLEWARE 1 - LOG
// Primeira camada do pipeline. Registra a entrada e, na "volta",
// usa o evento 'finish' do res (o Express NÃO é uma cebola literal).
module.exports = function logger(req, res, next) {
  const inicio = Date.now();
  console.log(`[log]  -> ${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const ms = Date.now() - inicio;
    console.log(`[log]  <- ${req.method} ${req.originalUrl} ${res.statusCode} (${ms}ms)`);
  });

  next();
};
