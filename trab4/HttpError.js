// Erro de domínio HTTP: carrega status e código. NÃO formata resposta;
// apenas descreve o que deu errado. Quem formata é o errorHandler.
class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}
module.exports = HttpError;
