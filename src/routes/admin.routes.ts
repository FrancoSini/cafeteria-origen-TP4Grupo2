import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

import { randomBytes } from 'crypto';

import config from '../config';
import * as catalogo from '../services/catalogo.service';
import * as usuarios from '../services/usuarios.service';
import { requiereSesion, requiereRol } from '../middleware/auth';
import type { Usuario } from '../tipos';
import { spawn } from 'child_process';

const router = express.Router();

/**
 * Rutas del panel de administración.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Autorización ausente / escalada de privilegios (OWASP A01:2021)
 * -----------------------------------------------------------------------------
 * Se exige estar autenticado, pero NO se comprueba el rol: `requiereRol` está
 * importado y no se usa. Cualquier usuario autenticado (incluso con rol
 * "cliente") entra al panel y puede:
 *   - crear, editar y BORRAR productos,
 *   - cambiar contraseñas,
 *   - dar de alta usuarios y cambiarles el rol (escalada de privilegios),
 *   - ejecutar comandos en el servidor.
 *
 * Corrección: `router.use(requiereRol('admin'))` sobre las rutas sensibles.
 * -----------------------------------------------------------------------------
 */
router.use(requiereSesion);

/** GET /api/admin/usuarios */
router.get('/usuarios', async (req, res, next) => {
  try {
    res.json({ usuarios: await usuarios.listar() });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/usuarios/:id
 *
 * FALLA — Asignación masiva: se actualiza cualquier campo que llegue en el
 * cuerpo, incluido el `rol`. Un usuario con rol "cliente" puede mandarse
 * `{"rol": "admin"}` y convertirse en administrador.
 */

const ROLES_PERMITIDOS = ['cliente', 'mozo', 'barista', 'admin'] as const;
type RolPermitido = (typeof ROLES_PERMITIDOS)[number];

function esRolPermitido(valor: unknown): valor is RolPermitido {
  return typeof valor === 'string' && (ROLES_PERMITIDOS as readonly string[]).includes(valor);
}

router.put('/usuarios/:id',requiereRol('admin'), async (req, res, next) => {
  try {
    const { username, nombre, rol, password } = req.body || {};
    const cambios: Partial<Usuario> = {};
    if (username !== undefined) cambios.username = username;
    if (nombre !== undefined) cambios.nombre = nombre;
    if (rol !== undefined) {
      if (req.usuario?.rol !== 'admin') {
        return res.status(403).json({ error: 'No tienes permisos para cambiar el rol de este usuario.' });
      }
      if (!esRolPermitido(rol)) {
        return res.status(400).json({ error: 'Rol no válido.' });
      }
      cambios.rol = rol;
    }
    if (password !== undefined) cambios.password = password;

    const usuario = await usuarios.actualizar(req.params.id, cambios);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

/** POST /api/admin/productos — alta de producto. */
router.post('/productos', async (req, res, next) => {
  try {
    const producto = await catalogo.crear(req.body || {});
    res.status(201).json(producto);
  } catch (err) {
    // El nombre del producto es único en la base.
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
    }
    next(err);
  }
});

/** PUT /api/admin/productos/:id */
router.put('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.actualizar(req.params.id, req.body || {});
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/productos/:id
 *
 * FALLA — CSRF: la petición que borra un producto no lleva ningún token y se
 * acepta con un simple GET/POST desde cualquier origen.
 */
router.delete('/productos/:id', async (req, res, next) => {
  try {
    const producto = await catalogo.eliminar(req.params.id);
    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }
    res.json(producto);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/cambiar-contrasena
 *
 * FALLAS: sin token anti-CSRF, sin límite de intentos, y la contraseña nueva
 * se guarda en texto plano.
 */
router.post('/cambiar-contrasena', async (req, res, next) => {
  try {
    const { nueva } = req.body || {};
    if (!nueva) {
      return res.status(400).json({ error: 'Falta la contraseña nueva.' });
    }
    // FALLA: no se valida la longitud ni la complejidad de la contraseña.
    // (`req.usuario!`: requiereSesion ya garantizó que hay un usuario.)
    const usuario = await usuarios.cambiarPassword(req.usuario!.id, nueva);
    res.json({ mensaje: 'Contraseña actualizada.', usuario });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/probar-conexion
 *
 * -----------------------------------------------------------------------------
 * FALLA — Inyección de comandos del sistema operativo (OWASP A03:2021)
 * -----------------------------------------------------------------------------
 * La dirección del proveedor se mete dentro de una cadena de shell.
 * Como `exec` launches /bin/sh -c, los operadores del shell (|, ;, &&, $())
 * se interpretan y permiten ejecutar comandos arbitrarios en el contenedor.
 *
 * Corrección: validar el host contra una LISTA BLANCA y ejecutar el proceso
 * con `spawn('ping', ['-c', '3', host], { shell: false })`, sin pasar por el
 * shell.
 * -----------------------------------------------------------------------------
 */
const HOSTS_PERMITIDOS = new Set(['127.0.0.1', 'localhost', 'db']);

router.post('/probar-conexion', requiereRol('admin'), (req, res) => {
  const { host } = req.body || {};

  if (typeof host !== 'string' || !HOSTS_PERMITIDOS.has(host.trim())) {
    return res.status(400).json({
      error: 'Host no permitido.',
    });
  }

  const hostLimpio = host.trim();
  const comandoMostrado = `ping -c 3 ${hostLimpio}`;
  const child = spawn('ping', ['-c', '3', hostLimpio], { shell: false });

  let stdout = '';
  let stderr = '';
  let spawnError: Error | null = null;

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (err) => {
    spawnError = err;
  });

  child.on('close', (code) => {
    const errorMsg =
      stderr ||
      (spawnError ? spawnError.message : null) ||
      (code !== 0 && code !== null ? `El comando finalizó con código ${code}` : null);

    res.json({
      comando: comandoMostrado,
      salida: stdout,
      error: errorMsg,
    });
  });
});

/**
 * POST /api/admin/subir-archivo
 *
 * -----------------------------------------------------------------------------
 * FALLA — Carga de archivos sin restricciones (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida la extensión, el tipo MIME ni el tamaño del archivo, y se
 * guarda con el nombre que manda el cliente (además sin sanitizar "../", lo
 * que permite escribir fuera de la carpeta de subidas). Los archivos subidos
 * se sirven con express.static desde el mismo origen.
 *
 * Corrección: validar extensión contra lista blanca (.png/.jpg/.svg saneado),
 * verificar el tipo MIME real, limitar el tamaño, generar un nombre aleatorio
 * y guardar fuera del árbol web.
 * -----------------------------------------------------------------------------
 */
/**
 * POST /api/admin/subir-archivo
 * Sube imágenes PNG o JPG de forma segura.
 */
router.post('/subir-archivo', express.json({ limit: '8mb' }), (req, res, next) => {
  try {
    const { nombre, contenidoBase64 } = req.body || {};

    if (
      typeof nombre !== 'string' ||
      typeof contenidoBase64 !== 'string' ||
      !nombre ||
      !contenidoBase64
    ) {
      return res.status(400).json({ error: 'Falta el archivo.' });
    }

    // Solo se permiten extensiones PNG y JPG.
    const extension = path.extname(nombre).toLowerCase();

    if (!['.png', '.jpg', '.jpeg'].includes(extension)) {
      return res.status(400).json({ error: 'Formato de archivo no permitido.' });
    }

    // Se comprueba que el contenido sea Base64 válido.
    const base64Limpio = contenidoBase64.replace(/^data:image\/\w+;base64,/, '');

    if (
      base64Limpio.length === 0 ||
      base64Limpio.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(base64Limpio)
    ) {
      return res.status(400).json({ error: 'Contenido del archivo inválido.' });
    }

    const buffer = Buffer.from(base64Limpio, 'base64');

    // Tamaño máximo: 5 MB.
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'El archivo supera el tamaño permitido.' });
    }

    // Se verifica la firma real del archivo.
    const esPng =
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );

    const esJpg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;

    if (
      (extension === '.png' && !esPng) ||
      ((extension === '.jpg' || extension === '.jpeg') && !esJpg)
    ) {
      return res.status(400).json({ error: 'El contenido no coincide con el formato declarado.' });
    }

    // Se genera un nombre aleatorio, sin usar el nombre del cliente.
    const nombreSeguro = `${randomBytes(16).toString('hex')}${extension}`;
    const destino = path.join(config.uploadsDir, nombreSeguro);

    fs.mkdirSync(config.uploadsDir, { recursive: true });
    fs.writeFileSync(destino, buffer, { flag: 'wx' });

    res.json({
      mensaje: 'Archivo subido.',
      url: `/uploads/${nombreSeguro}`,
      bytes: buffer.length,
    });
  } catch (err) {
    next(err);
  }
});








export default router;
