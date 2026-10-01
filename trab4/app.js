const express = require('express');
const logger = require('./middlewares/logger');
const auth = require('./middlewares/auth');
const errorHandler = require('./middlewares/errorHandler');
const HttpError = require('./errors/HttpError');
const pedidoController = require('./controllers/pedidoController');

const app = express();

// ORDEM DO PIPELINE (a ordem de registro é a ordem de execução)
app.use(logger);          // 1. log
app.use(express.json());  // 2. parser do corpo
app.use(auth);            // 3. autenticação (pode curto-circuitar)

app.get('/pedidos', pedidoController.listar);        // 4. rota -> controller
app.get('/pedidos/:id', pedidoController.buscar);

app.use((req, res, next) => next(new HttpError(404, 'ROTA_NAO_ENCONTRADA', 'Rota não existe')));

app.use(errorHandler);    // último: middleware de erro (4 argumentos)

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API em http://localhost:${PORT}`));
}
module.exports = app;
