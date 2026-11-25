/**
 * Gestión de sesiones.
 */

import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';

import type { Sesion, UsuarioSesion } from '../tipos';

export const sesiones = new Map<string, Sesion>();

const DURACION_SESION_MS = 30 * 60 * 1000; 


export function leerCookies(req: Request): Record<string, string> {
  const cookies: Record<string, string> = {};
  const header = req.headers.cookie;
  if (!header) return cookies;
  for (const parte of header.split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    const nombre = parte.slice(0, separador).trim();
    const valor = parte.slice(separador + 1).trim();
    if (nombre) cookies[nombre] = decodeURIComponent(valor);
  }
  return cookies;
}


export function crearSesion(req: Request, res: Response, usuario: UsuarioSesion): string {

  destruirSesion(req);

  const id = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  const ahora = Date.now();
  const usarSecure = process.env.NODE_ENV === 'production' || Boolean(req.secure);

  sesiones.set(id, {
    usuario,
    creadaEn: ahora,
    expiraEn: ahora + DURACION_SESION_MS,
    csrfToken,
  });

  res.cookie('sid', id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: usarSecure,
    maxAge: DURACION_SESION_MS,
  });

  res.cookie('csrf', csrfToken, {
    path: '/',
    sameSite: 'lax',
    secure: usarSecure,
    maxAge: DURACION_SESION_MS,
  });

  return id;
}

export function obtenerSesion(req: Request): Sesion | null {
  const cookies = leerCookies(req);
  const id = cookies.sid;
  if (!id) return null;

  const sesion = sesiones.get(id);
  if (!sesion) return null;

  if (sesion.expiraEn !== null && Date.now() > sesion.expiraEn) {
    sesiones.delete(id);
    return null;
  }

  return sesion;
}


export function destruirSesion(req: Request): void {
  const cookies = leerCookies(req);
  const id = cookies.sid;
  if (id) sesiones.delete(id);
}

export function verificarCsrf(req: Request, res: Response, next: (err?: unknown) => void): void {
  const metodo = req.method.toUpperCase();

  if (['GET', 'HEAD', 'OPTIONS'].includes(metodo)) {
    return next();
  }

  const cookies = leerCookies(req);
  const sesion = obtenerSesion(req);


  if (!sesion) {
    return next();
  }

  const tokenCookie = cookies.csrf;
  const tokenEnviado = req.headers['x-csrf-token'] || req.body?._csrf;

  if (
    !tokenCookie ||
    !tokenEnviado ||
    tokenCookie !== sesion.csrfToken ||
    tokenEnviado !== sesion.csrfToken
  ) {
    res.status(403).json({ error: 'Token CSRF inválido o ausente.' });
    return;
  }

  next();
}
