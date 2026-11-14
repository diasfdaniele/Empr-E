import multer from 'multer';
import { LIMITE_LOGO_EMPRESA } from '../services/autenticacao.js';

const receberLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_LOGO_EMPRESA, files: 1, fields: 30, fieldSize: 20000, parts: 32 },
}).single('logoEmpresa');

export function uploadLogoEmpresa(req, res, next) {
  receberLogo(req, res, (erro) => {
    if (erro) {
      req.erroUpload = erro.code === 'LIMIT_FILE_SIZE'
        ? 'A logo deve ter no máximo 5 MB.'
        : 'Envio inválido. Selecione uma única logo de até 5 MB.';
    }
    next();
  });
}
