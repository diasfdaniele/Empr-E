import multer from 'multer';
import { LIMITE_FOTOS, LIMITE_IMAGEM } from '../services/produtos-vendedor.js';

const receberFotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITE_IMAGEM, files: LIMITE_FOTOS, fields: 30, fieldSize: 20000, parts: 40 },
}).array('imagens', LIMITE_FOTOS);

export function uploadProduto(req, res, next) {
  receberFotos(req, res, (erro) => {
    if (erro) {
      req.erroUpload = erro.code === 'LIMIT_FILE_SIZE'
        ? 'Cada foto deve ter no máximo 5 MB.'
        : 'Envio inválido. Selecione até seis fotos de no máximo 5 MB cada.';
    }
    next();
  });
}