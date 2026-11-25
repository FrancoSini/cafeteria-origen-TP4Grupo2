/* =============================================================================
   Cafetería Origen — lógica del sitio público
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var CARRITO_KEY = 'origen.carrito';

  var estado = {
    tipo: '',
    variedad: '',
    q: '',
    carrito: cargarCarrito(),
  };

  /* ---------------------------------------------------------------- utils */
  function $(sel) { return document.querySelector(sel); }

  function money(valor) {
    var n = Number(valor || 0);
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function raw(valor) {
    // FALLA: esta función NO escapa nada, devuelve el valor tal cual.
    // La forma correcta de renderizar texto del servidor es escaparHtml()
    // (o textContent en vez de innerHTML).
    return String(valor == null ? '' : valor);
  }

  function api(url, opciones) {
    return fetch(API + url, opciones).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function postJSON(url, cuerpo) {
    return api(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function guardarCarrito() {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(estado.carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function cargarCarrito() {
    try {
      return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  

  /* ------------------------------------------------------------- catálogo */
  function urlCatalogo() {
    var params = new URLSearchParams();
    if (estado.tipo) params.set('tipo', estado.tipo);
    if (estado.variedad) params.set('variedad', estado.variedad);
    if (estado.q) params.set('q', estado.q);
    var s = params.toString();
    return '/productos' + (s ? '?' + s : '');
  }

  function cargarProductos() {
    return api(urlCatalogo()).then(function (resp) {
      if (!resp.ok) {
        renderErrorProductos(resp.data && resp.data.error);
        return;
      }
      renderProductos(resp.data.productos);
      renderResultado(resp.data.filtros, resp.data.total);
    });
  }

  
function renderProductos(productos) {
  var grid = $('#productos-grid');

  // Limpiamos el catálogo de forma segura
  grid.replaceChildren();

  if (!productos || productos.length === 0) {
    var vacio = document.createElement('p');
    vacio.className = 'empty';
    vacio.textContent = 'No encontramos productos con esos filtros.';
    grid.appendChild(vacio);
    return;
  }

  productos.forEach(function (p) {
    window.__productos[p.id] = p;

    // Tarjeta del producto
    var articulo = document.createElement('article');
    articulo.className = 'product-card';

    // Parte superior: nombre y precio
    var superior = document.createElement('div');
    superior.className = 'product-top';

    var nombre = document.createElement('h3');
    nombre.className = 'product-name';
    nombre.textContent = p.nombre || '';

    var precio = document.createElement('span');
    precio.className = 'product-price';
    precio.textContent = money(p.precio);

    superior.appendChild(nombre);
    superior.appendChild(precio);

    // Etiquetas: tipo, variedad y tamaño
    var etiquetas = document.createElement('div');
    etiquetas.className = 'product-tags';

    function agregarEtiqueta(valor, clase) {
      if (!valor) return;

      var etiqueta = document.createElement('span');
      etiqueta.className = clase;
      etiqueta.textContent = String(valor);
      etiquetas.appendChild(etiqueta);
    }

    agregarEtiqueta(p.tipo, 'tag');
    agregarEtiqueta(p.variedad, 'tag tag-origen');
    agregarEtiqueta(p.tamano, 'tag');

    // Descripción del producto
    var descripcion = document.createElement('p');
    descripcion.className = 'product-desc';
    descripcion.textContent = p.descripcion || '';

    // Botón para agregar al carrito
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn-ghost btn-agregar';
    boton.textContent = 'Agregar';
    boton.setAttribute('data-id', String(p.id));

    // Armamos la tarjeta
    articulo.appendChild(superior);
    articulo.appendChild(etiquetas);
    articulo.appendChild(descripcion);
    articulo.appendChild(boton);

    // Agregamos el producto al catálogo
    grid.appendChild(articulo);
  });
}


  
  
function renderProductos(productos) {
  var grid = $('#productos-grid');
  grid.replaceChildren();

  if (!productos || productos.length === 0) {
    var vacio = document.createElement('p');
    vacio.className = 'empty';
    vacio.textContent = 'No encontramos productos con esos filtros.';
    grid.appendChild(vacio);
    return;
  }

  productos.forEach(function (p) {
    window.__productos[p.id] = p;

    var articulo = document.createElement('article');
    articulo.className = 'product-card';

    var superior = document.createElement('div');
    superior.className = 'product-top';

    var nombre = document.createElement('h3');
    nombre.className = 'product-name';
    nombre.textContent = p.nombre || '';

    var precio = document.createElement('span');
    precio.className = 'product-price';
    precio.textContent = money(p.precio);

    superior.appendChild(nombre);
    superior.appendChild(precio);

    var etiquetas = document.createElement('div');
    etiquetas.className = 'product-tags';

    function agregarEtiqueta(valor, clase) {
      if (!valor) return;

      var etiqueta = document.createElement('span');
      etiqueta.className = clase;
      etiqueta.textContent = String(valor);
      etiquetas.appendChild(etiqueta);
    }

    agregarEtiqueta(p.tipo, 'tag');
    agregarEtiqueta(p.variedad, 'tag tag-origen');
    agregarEtiqueta(p.tamano, 'tag');

    var descripcion = document.createElement('p');
    descripcion.className = 'product-desc';
    descripcion.textContent = p.descripcion || '';

    var boton = document.createElement('button');
    boton.className = 'btn btn-ghost btn-agregar';
    boton.textContent = 'Agregar';
    boton.setAttribute('data-id', String(p.id));

    articulo.appendChild(superior);
    articulo.appendChild(etiquetas);
    articulo.appendChild(descripcion);
    articulo.appendChild(boton);

    grid.appendChild(articulo);
  });
}
  
  function renderErrorProductos(mensaje) {
    var grid = $('#productos-grid');

    var error = document.createElement('p');
    error.className = 'empty';
    error.textContent =
      'No se pudo cargar el menú: ' +
      (mensaje || 'error desconocido');

    grid.replaceChildren(error);
  }


  /* --------------------------------------------------------------- carrito */
  function agregarAlCarrito(productoId) {
    var existente = null;
    for (var i = 0; i < estado.carrito.length; i++) {
      if (String(estado.carrito[i].id) === String(productoId)) existente = estado.carrito[i];
    }
    if (existente) {
      existente.cantidad += 1;
    } else {
      estado.carrito.push({
        id: productoId,
        nombre: window.__productos[productoId] ? window.__productos[productoId].nombre : 'Producto',
        precio: window.__productos[productoId] ? window.__productos[productoId].precio : 0,
        cantidad: 1,
      });
    }
    guardarCarrito();
    renderCarrito();
  }

  function cambiarCantidad(indice, delta) {
    var item = estado.carrito[indice];
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function quitarDelCarrito(indice) {
    estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  
function renderCarrito() {
  var cont = $('#carrito');
  var lista = $('#resumen-carrito');
  var total = 0;

  cont.replaceChildren();
  lista.replaceChildren();

  if (estado.carrito.length === 0) {
    var vacio = document.createElement('p');
    vacio.className = 'empty';
    vacio.textContent = 'El carrito está vacío.';
    cont.appendChild(vacio);
    $('#resumen-total').textContent = money(0);
    return;
  }

  estado.carrito.forEach(function (item, i) {
    var subtotal = item.precio * item.cantidad;
    total += subtotal;

    var fila = document.createElement('div');
    fila.className = 'cart-item';

    var info = document.createElement('div');

    var nombre = document.createElement('div');
    nombre.className = 'cart-item-name';
    nombre.textContent = item.nombre;

    var precio = document.createElement('div');
    precio.className = 'cart-item-meta';
    precio.textContent = money(item.precio) + ' c/u';

    info.appendChild(nombre);
    info.appendChild(precio);

    var controles = document.createElement('div');
    controles.className = 'qty-control';

    function crearBoton(texto, accion) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.textContent = texto;
      boton.setAttribute('data-acc', accion);
      boton.setAttribute('data-i', String(i));
      return boton;
    }

    var menos = crearBoton('−', 'menos');
    var cantidad = document.createElement('span');
    cantidad.textContent = String(item.cantidad);
    var mas = crearBoton('+', 'mas');

    controles.appendChild(menos);
    controles.appendChild(cantidad);
    controles.appendChild(mas);

    var acciones = document.createElement('div');

    var precioTotal = document.createElement('div');
    precioTotal.className = 'cart-item-price';
    precioTotal.textContent = money(subtotal);

    var quitar = crearBoton('Quitar', 'quitar');
    quitar.className = 'link-danger';

    acciones.appendChild(precioTotal);
    acciones.appendChild(quitar);

    fila.appendChild(info);
    fila.appendChild(controles);
    fila.appendChild(acciones);

    cont.appendChild(fila);

    var elementoResumen = document.createElement('li');
    var detalle = document.createElement('span');
    detalle.textContent = item.nombre + ' × ' + item.cantidad;

    var importe = document.createElement('span');
    importe.textContent = money(subtotal);

    elementoResumen.appendChild(detalle);
    elementoResumen.appendChild(importe);
    lista.appendChild(elementoResumen);
  });

  $('#resumen-total').textContent = money(total);
}


  /* ---------------------------------------------------------------- pedidos */
  function enviarPedido(evento) {
    evento.preventDefault();
    var feedback = $('#pedido-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Enviando…';

    postJSON('/pedidos', {
      mesa: $('#pedido-mesa').value,
      cliente: $('#pedido-cliente').value,
      items: estado.carrito.map(function (item) {
        return { productoId: item.id, cantidad: item.cantidad };
      }),
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor se pinta con innerHTML.
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No pudimos enviar el pedido: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Pedido #' + resp.data.id + ' recibido! Total ' + money(resp.data.total) +
        '. Te atendemos en la mesa ' + resp.data.mesa + '.';
      estado.carrito = [];
      guardarCarrito();
      renderCarrito();
      $('#form-pedido').reset();
    }).catch(function () {
      feedback.className = 'form-feedback is-error';
      feedback.textContent = 'Error de conexión con el servidor.';
    });
  }

  /* --------------------------------------------------------------- reseñas */
  
function cargarReseñas() {
  return api('/comentarios').then(function (resp) {
    var cont = $('#lista-resenas');

    if (!resp.ok || !resp.data.comentarios ||
        resp.data.comentarios.length === 0) {
      var vacio = document.createElement('p');
      vacio.className = 'empty';
      vacio.textContent = 'Todavía no hay reseñas. ¡Sé el primero!';
      cont.replaceChildren(vacio);
      return;
    }

    cont.replaceChildren();

    resp.data.comentarios.forEach(function (c) {
      var articulo = document.createElement('article');
      articulo.className = 'review';

      var cabecera = document.createElement('div');
      cabecera.className = 'review-head';

      var autor = document.createElement('span');
      autor.className = 'review-author';
      autor.textContent = c.autor || '';

      var estrellas = document.createElement('span');
      estrellas.className = 'review-stars';

      var cantidad = Number(c.calificacion || 0);
      estrellas.textContent = '★'.repeat(
        Math.max(0, Math.min(5, cantidad))
      );

      var texto = document.createElement('p');
      texto.className = 'review-text';
      texto.textContent = c.texto || '';

      cabecera.appendChild(autor);
      cabecera.appendChild(estrellas);

      articulo.appendChild(cabecera);
      articulo.appendChild(texto);

      cont.appendChild(articulo);
    });
  });
}


  function enviarReseña(evento) {
    evento.preventDefault();
    var feedback = $('#resena-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Publicando…';

    postJSON('/comentarios', {
      autor: $('#resena-autor').value,
      texto: $('#resena-texto').value,
      calificacion: Number($('#resena-calificacion').value),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No se pudo publicar: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Gracias por tu reseña!';
      $('#form-resena').reset();
      cargarReseñas();
    });
  }

  /* ------------------------------------------------------------- listeners */
  function init() {
    window.__productos = {};

    // Filtros
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        estado.tipo = chip.getAttribute('data-tipo');
        cargarProductos();
      });
    });

    $('#filtro-variedad').addEventListener('change', function (e) {
      estado.variedad = e.target.value;
      cargarProductos();
    });

    var temporizador = null;
    $('#filtro-busqueda').addEventListener('input', function (e) {
      estado.q = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarProductos, 250);
    });

    // Carrito (delegación de eventos)
    $('#productos-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-agregar');
      if (!btn) return;
      agregarAlCarrito(btn.getAttribute('data-id'));
    });

    $('#carrito').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i'));
      var accion = btn.getAttribute('data-acc');
      if (accion === 'mas') cambiarCantidad(i, 1);
      else if (accion === 'menos') cambiarCantidad(i, -1);
      else if (accion === 'quitar') quitarDelCarrito(i);
    });

    $('#form-pedido').addEventListener('submit', enviarPedido);
    $('#form-resena').addEventListener('submit', enviarReseña);

    // Carga inicial
    api(urlCatalogo()).then(function (resp) {
      if (resp.ok) {
        (resp.data.productos || []).forEach(function (p) { window.__productos[p.id] = p; });
        renderProductos(resp.data.productos);
        renderResultado(resp.data.filtros, resp.data.total);
      } else {
        renderErrorProductos(resp.data.error);
      }
    });
    cargarReseñas();
    renderCarrito();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
