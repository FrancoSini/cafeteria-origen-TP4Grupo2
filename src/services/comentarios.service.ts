import * as db from '../db';
import type { Comentario } from '../tipos';

/** Datos de una reseña nueva, tal como llegan en el cuerpo de la petición. */
export interface NuevoComentario {
  autor?: string | null;
  texto: string;
  calificacion: number;
}

/**
 * Servicio de comentarios / reseñas de la cafetería.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida longitud, ni formato, ni que la calificación esté en rango.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Cross-Site Scripting almacenado (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * El texto del comentario se guarda tal cual y luego se devuelve en las
 * respuestas JSON que la web inserta en el DOM. Como el cliente lo pinta con
 * innerHTML, el script queda almacenado en la base y se ejecuta en el
 * navegador de CADA visitante (incluidos los administradores).
 *
 * Corrección: escapar/sanear la salida en el cliente (textContent en vez de
 * innerHTML) o, mejor, sanitizar en el servidor y aplicar CSP como capa extra.
 */

const MAX_AUTOR_CHARS = 80;
const MAX_TEXTO_CHARS = 500;

function errorCliente(mensaje: string): Error & { status: number } {
  const err = new Error(mensaje) as Error & { status: number };
  err.status = 400;
  return err;
}

/** Lista todos los comentarios, del más nuevo al más viejo. */
export async function listar(): Promise<Comentario[]> {
  const { rows } = await db.query<Comentario>(
    'SELECT * FROM comentarios ORDER BY id DESC'
  );
  return rows;
}

/** Crea un comentario. */
export async function crear({ autor, texto, calificacion }: NuevoComentario): Promise<Comentario> {
  if (typeof texto !== 'string' || texto.trim().length === 0) {
    throw errorCliente('El texto de la reseña es obligatorio.');
  }

  const textoLimpio = texto.trim();
  if (textoLimpio.length > MAX_TEXTO_CHARS) {
    throw errorCliente(`La reseña no puede superar los ${MAX_TEXTO_CHARS} caracteres.`);
  }

  let autorLimpio: string | null = null;
  if (autor !== undefined && autor !== null) {
    if (typeof autor !== 'string') {
      throw errorCliente('El autor no es válido.');
    }
    const recorte = autor.trim();
    if (recorte.length > MAX_AUTOR_CHARS) {
      throw errorCliente(`El nombre del autor no puede superar los ${MAX_AUTOR_CHARS} caracteres.`);
    }
    autorLimpio = recorte.length > 0 ? recorte : null;
  }

  const califNum = Number(calificacion);
  if (!Number.isInteger(califNum) || califNum < 1 || califNum > 5) {
    throw errorCliente('La calificación debe ser un número entero entre 1 y 5.');
  }

  const { rows } = await db.query<Comentario>(
    `INSERT INTO comentarios (autor, texto, calificacion)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [autorLimpio, textoLimpio, califNum]
  );
  return rows[0];
}

/** Elimina un comentario. */
export async function eliminar(id: number | string): Promise<Comentario | null> {
  const { rows } = await db.query<Comentario>(
    'DELETE FROM comentarios WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0] || null;
}