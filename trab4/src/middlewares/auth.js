// MIDDLEWARE 2 - AUTENTICAÇÃO FICTÍCIA
// Aceita apenas "Authorization: Bearer token-valido".
// Se falhar, INTERROMPE o pipeline (short-circuit): o controller nunca roda.
// Note que ele não escreve a resposta: delega via next(err).
const HttpError = require('../errors/HttpError');

const TOKENS = { 'token-valido': { id: 1, nome: 'Ana' } };

module.exports = function auth(req, res, next) {
  console.log('[auth] verificando credenciais');

  const header = req.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  const usuario = TOKENS[token];

  if (!usuario) {
    console.log('[auth] FALHOU -> next(err), pipeline desviado para o errorHandler');
    return next(new HttpError(401, 'NAO_AUTENTICADO', 'Token ausente ou inválido'));
  }

  req.user = usuario;   // enriquece a requisição para as camadas seguintes
  next();
};
