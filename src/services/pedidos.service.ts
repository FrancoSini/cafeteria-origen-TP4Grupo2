import * as db from '../db';
import { calcularPrecio } from '../catalogo';

import type { ErrorHttp, Pedido, PedidoConItems, PedidoItem, Producto } from '../tipos';




// Crea errores de validación que la API responde con estado 400.
function errorValidacion(mensaje: string): ErrorHttp {
  const error = new Error(mensaje) as ErrorHttp;
  error.status = 400;
  return error;
}


/** Un renglón del pedido, tal como llega en el cuerpo de la petición. */
export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

/** Pedido nuevo, tal como llega en el cuerpo de la petición. */
export interface NuevoPedido {
  mesa: string;
  cliente: string;
  items: ItemPedido[];
}

/** Id tal como llega en la URL (texto) o ya convertido. */
type Id = number | string;

/**
 * Servicio de pedidos.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil o insuficiente (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida nada de lo que llega en el cuerpo de la petición:
 *  - `cantidad` puede ser negativa (el total del pedido queda negativo),
 *    cero, un número decimal o un texto.
 *  - No hay un máximo de items ni de cantidad (DoS / facturas absurdas).
 *  - `mesa` y `cliente` no se validan ni se acotan en longitud.
 *  - Si el productoId no existe, la excepción sube y se filtra el stack.
 *
 * La corrección es validar TIPO (entero), RANGO (1..N), LONGITUD y FORMATO
 * de cada campo en el servidor, usando listas blancas.
 * -----------------------------------------------------------------------------
 */

/**
 * Crea un pedido a partir de una lista de items { productoId, cantidad }.
 * Total = suma de calcularPrecio(producto) x cantidad
 */
  export async function crear({ mesa, cliente, items }: NuevoPedido): Promise<PedidoConItems | null> {
  // Se valida que la mesa sea un texto válido y no supere los 20 caracteres.
  if (
    typeof mesa !== 'string' ||
    mesa.trim().length === 0 ||
    mesa.length > 20
  ) {
    throw errorValidacion('La mesa debe ser un texto válido de hasta 20 caracteres.');
  }

  // Se valida que el cliente sea un texto válido y no supere los 100 caracteres.
  if (
    typeof cliente !== 'string' ||
    cliente.trim().length === 0 ||
    cliente.length > 100
  ) {
    throw errorValidacion('El cliente debe ser un texto válido de hasta 100 caracteres.');
  }

  // Se valida que items exista, sea un array y contenga entre 1 y 20 productos.
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    throw errorValidacion('El pedido debe contener entre 1 y 20 productos.');
  }

  const filas: { productoId: number; cantidad: number; precioUnitario: number }[] = [];

  for (const item of items) {
    // Se valida que el productoId sea un entero positivo y la cantidad
    // un entero entre 1 y 100.
    if (
      !item ||
      !Number.isInteger(item.productoId) ||
      item.productoId <= 0 ||
      !Number.isInteger(item.cantidad) ||
      item.cantidad < 1 ||
      item.cantidad > 100
    ) {
      throw errorValidacion('El producto y la cantidad del pedido no son válidos.');
    }

    // Si el producto no existe, se rechaza el pedido antes de calcular el precio.
    const producto = await buscarProducto(item.productoId);

    if (!producto) {
      throw errorValidacion('El producto solicitado no existe.');
    }

    const precioUnitario = calcularPrecio(producto);

    filas.push({
      productoId: producto.id,
      cantidad: item.cantidad,
      precioUnitario,
    });
  }

  const total = filas.reduce(
    (acc, f) => acc + f.precioUnitario * f.cantidad,
    0
  );

  const { rows } = await db.query<Pedido>(
    `INSERT INTO pedidos (mesa, cliente, estado, total)
     VALUES ($1, $2, 'abierto', $3)
     RETURNING *`,
    [mesa.trim(), cliente.trim(), total]
  );

  const pedido = rows[0];

  for (const fila of filas) {
    await db.query(
      `INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [pedido.id, fila.productoId, fila.cantidad, fila.precioUnitario]
    );
  }

  return obtenerConItems(pedido.id);
}


/** Busca un producto por id (helper interno). */
async function buscarProducto(productoId: number): Promise<Producto> {
  const { rows } = await db.query<Producto>('SELECT * FROM productos WHERE id = $1', [productoId]);
  return rows[0];
}

/** Lista pedidos (con filtro opcional por mesa). */

export async function listar(mesa?: string): Promise<Pedido[]> {

  let sql = 'SELECT * FROM pedidos';
  const valores: string[] = [];

  if (mesa) {
    sql += ' WHERE mesa = $1';
    valores.push(mesa);
  }

  sql += ' ORDER BY id DESC';

  const { rows } = await db.query<Pedido>(sql, valores);

  return rows;
}


/** Devuelve un pedido con sus items. */
export async function obtenerConItems(id: Id): Promise<PedidoConItems | null> {
  const { rows: pedidos } = await db.query<Pedido>(
    'SELECT * FROM pedidos WHERE id = $1',
    [id]
  );
  const pedido = pedidos[0];
  if (!pedido) return null;

  const { rows: items } = await db.query<PedidoItem>(
    `SELECT pi.*, pr.nombre AS producto_nombre
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = $1`,
    [id]
  );

  return { ...pedido, items };
}

/** Cambia el estado de un pedido. */
export async function cambiarEstado(id: Id, estado: string): Promise<Pedido | null> {
  const { rows } = await db.query<Pedido>(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estado, id]
  );
  return rows[0] || null;
}
