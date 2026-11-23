/* =============================================================================
   Cafetería Origen — lógica del panel de administración
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var usuario = null;
  var productosCache = {};

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function money(valor) {
    return Number(valor || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function raw(valor) {
    // FALLA: no escapa nada. Usar escaparHtml() / textContent.
    return String(valor == null ? '' : valor);
  }

  //FUNCION borrada 


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

  function putJSON(url, cuerpo) {
    return api(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function patchJSON(url, cuerpo) {
    return api(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function feedback(el, mensaje, ok) {
    el.className = 'form-feedback ' + (ok ? 'is-ok' : 'is-error');
    el.textContent = mensaje;
  }

  /* ------------------------------------------------------------------ login */
  function iniciarSesion(evento) {
    evento.preventDefault();
    var caja = $('#login-feedback');
    caja.className = 'form-feedback';

    postJSON('/auth/login', {
      username: $('#login-usuario').value,
      password: $('#login-password').value,
    }).then(function (resp) {
      if (!resp.ok) {
        // FALLA (XSS reflejado): el mensaje del servidor (que incluye el
        // usuario enviado) se pinta con HTML din�mico.
        feedback(caja, 'No pudimos iniciar sesión: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      usuario = resp.data.usuario;
      mostrarPanel();
    });
  }

  function cerrarSesion() {
    postJSON('/auth/logout', {}).then(function () {
      usuario = null;
      $('#vista-login').hidden = false;
      $('#vista-panel').hidden = true;
      $('#admin-user').textContent = '';
    });
  }

  function mostrarPanel() {
    $('#vista-login').hidden = true;
    $('#vista-panel').hidden = false;

    $('#admin-user').textContent =
  'Sesión de ' + usuario.nombre + ' · rol: ' + usuario.rol;

      $('#panel-bienvenida').textContent = 'Hola, ' + usuario.nombre;

    cargarTodo();
  }

  function cargarTodo() {
    cargarResumen();
    cargarPedidos();
    cargarProductos();
    cargarReportes();
    cargarUsuarios();
  }

  /* ---------------------------------------------------------------- resumen */
  function cargarResumen() {
    api('/reportes/facturacion').then(function (f) {
      api('/reportes/mas-vendido').then(function (m) {
        api('/reportes/cantidad-vendida').then(function (c) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación total', value: money(f.data.facturado) },
            { label: 'Pedidos registrados', value: f.data.pedidos },
            {
              label: 'Producto más vendido',
              value: mas ? raw(mas.nombre) : '—',
            },
            {
              label: 'Unidades por tipo',
              value: Object.keys(c.data.cantidadVendida || {})
                .map(function (k) { return k + ': ' + c.data.cantidadVendida[k]; })
                .join(' · ') || '—',
            },
          ];
          var contenedor = $('#kpis');
          contenedor.textContent = '';

          kpis.forEach(function (k) {
              var tarjeta = document.createElement('div');
              tarjeta.className = 'kpi';

              var etiqueta = document.createElement('div');
                etiqueta.className = 'kpi-label';
                etiqueta.textContent = k.label;

                var valor = document.createElement('div');
                valor.className = 'kpi-value';
                valor.textContent = k.value;

                tarjeta.appendChild(etiqueta);
                tarjeta.appendChild(valor);
                contenedor.appendChild(tarjeta);
                });

        });
      });
    });
  }


function tablaPedidos(filas, conAcciones) {
  var tabla = document.createElement('table');

  if (!filas || filas.length === 0) {
    var mensaje = document.createElement('p');
    mensaje.className = 'empty';
    mensaje.textContent = 'No hay pedidos.';
    tabla.appendChild(mensaje);
    return tabla;
  }

  var thead = document.createElement('thead');
  var encabezado = document.createElement('tr');

  ['#', 'Mesa', 'Cliente', 'Estado', 'Total', 'Fecha'].forEach(function (texto) {
    var th = document.createElement('th');
    th.textContent = texto;
    encabezado.appendChild(th);
  });

  if (conAcciones) {
    var thAcciones = document.createElement('th');
    thAcciones.textContent = 'Acciones';
    encabezado.appendChild(thAcciones);
  }

  thead.appendChild(encabezado);
  tabla.appendChild(thead);

  var tbody = document.createElement('tbody');

  filas.forEach(function (p) {
    var fila = document.createElement('tr');

    [p.id, p.mesa, p.cliente, p.estado, money(p.total),
      new Date(p.creado_en).toLocaleString('es-AR')].forEach(function (dato) {
      var td = document.createElement('td');
      td.textContent = dato == null ? '' : String(dato);
      fila.appendChild(td);
    });

    var celdaEstado = fila.children[3];
    var insignia = document.createElement('span');
    insignia.className = 'badge badge-' + String(p.estado);
    insignia.textContent = p.estado;
    celdaEstado.textContent = '';
    celdaEstado.appendChild(insignia);

    if (conAcciones) {
      var tdAcciones = document.createElement('td');
      var select = document.createElement('select');
      select.dataset.pedido = String(p.id);
      select.className = 'sel-estado';

      ['abierto', 'preparando', 'listo', 'entregado'].forEach(function (estado) {
        var opcion = document.createElement('option');
        opcion.value = estado;
        opcion.textContent = estado;
        opcion.selected = estado === p.estado;
        select.appendChild(opcion);
      });

      tdAcciones.appendChild(select);
      fila.appendChild(tdAcciones);
    }

    tbody.appendChild(fila);
  });

  tabla.appendChild(tbody);
  return tabla;
}
  

  function cargarPedidos() {
  api('/pedidos').then(function (resp) {
    var pedidos = resp.data.pedidos || [];

    $('#tabla-pedidos').replaceChildren(
      tablaPedidos(pedidos, true)
    );

    $('#tabla-ultimos').replaceChildren(
      tablaPedidos(pedidos.slice(0, 5), false)
    );
  });
}

  function cambiarEstado(evento) {
    var select = evento.target.closest('.sel-estado');
    if (!select) return;
    var id = select.getAttribute('data-pedido');
    patchJSON('/pedidos/' + id + '/estado', { estado: select.value }).then(function (resp) {
      if (!resp.ok) {
        alert('No se pudo cambiar el estado: ' + (resp.data.error || 'error'));
      }
      cargarPedidos();
    });
  }

  /* ------------------------------------------------------------- productos */
    function cargarProductos() {
  api('/productos').then(function (resp) {
    var productos = resp.data.productos || [];
    productosCache = {};

    var tabla = $('#tabla-productos');
    tabla.textContent = '';

    var thead = document.createElement('thead');
    var encabezado = document.createElement('tr');

    ['#', 'Nombre', 'Tipo', 'Origen', 'Precio', 'Acciones'].forEach(function (texto) {
      var th = document.createElement('th');
      th.textContent = texto;
      encabezado.appendChild(th);
    });

    thead.appendChild(encabezado);
    tabla.appendChild(thead);

    var tbody = document.createElement('tbody');

    productos.forEach(function (p) {
      productosCache[p.id] = p;

      var fila = document.createElement('tr');

      [p.id, p.nombre, p.tipo, p.variedad || '—', money(p.precio)].forEach(function (dato) {
        var td = document.createElement('td');
        td.textContent = dato == null ? '' : String(dato);
        fila.appendChild(td);
      });

      var acciones = document.createElement('td');
      var boton = document.createElement('button');
      boton.className = 'link-danger';
      boton.dataset.borrar = String(p.id);
      boton.textContent = 'Borrar';

      acciones.appendChild(boton);
      fila.appendChild(acciones);
      tbody.appendChild(fila);
    });

    tabla.appendChild(tbody);
  });
}

  function guardarProducto(evento) {
    evento.preventDefault();
    var caja = $('#producto-feedback');
    var id = $('#producto-id').value;

    var cuerpo = {
      nombre: $('#p-nombre').value,
      tipo: $('#p-tipo').value,
      variedad: $('#p-variedad').value || null,
      tamano: $('#p-tamano').value || null,
      gramos: $('#p-gramos').value ? Number($('#p-gramos').value) : null,
      precio_base: Number($('#p-precio-base').value || 0),
      precio_por_gramo: Number($('#p-precio-gramo').value || 0),
      descripcion: $('#p-descripcion').value,
    };

    var peticion = id ? putJSON('/admin/productos/' + id, cuerpo) : postJSON('/admin/productos', cuerpo);

    peticion.then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo guardar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Producto guardado correctamente.', true);
      $('#form-producto').reset();
      $('#producto-id').value = '';
      cargarProductos();
    });
  }

  function borrarProducto(evento) {
    var btn = evento.target.closest('[data-borrar]');
    if (!btn) return;
    var id = btn.getAttribute('data-borrar');
    if (!confirm('¿Borrar el producto #' + id + '?')) return;

    api('/admin/productos/' + id, { method: 'DELETE' }).then(function (resp) {
      if (!resp.ok) alert('No se pudo borrar: ' + (resp.data.error || 'error'));
      cargarProductos();
    });
  }

  function limpiarFormularioProducto() {
    $('#form-producto').reset();
    $('#producto-id').value = '';
  }

  /* ---------------------------------------------------------------- upload */
  function subirArchivo(evento) {
    evento.preventDefault();
    var caja = $('#upload-feedback');
    var input = $('#archivo-subida');
    if (!input.files || !input.files[0]) {
      feedback(caja, 'Elegí un archivo primero.', false);
      return;
    }

    var archivo = input.files[0];
    var lector = new FileReader();

    lector.onload = function () {
      var base64 = String(lector.result).split(',')[1] || '';
      postJSON('/admin/subir-archivo', {
        nombre: archivo.name,
        contenidoBase64: base64,
      }).then(function (resp) {
        if (!resp.ok) {
          feedback(caja, 'No se pudo subir: ' + (resp.data.error || 'error desconocido'), false);
          return;
        }
        feedback(caja, 'Archivo subido a ' + resp.data.url, true);
      });
    };

    lector.readAsDataURL(archivo);
  }

  /* -------------------------------------------------------------- reportes */
  function cargarReportes() {
    api('/reportes/facturacion').then(function (f) {
      api('/reportes/ticket-promedio').then(function (t) {
        api('/reportes/mas-vendido').then(function (m) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación', value: money(f.data.facturado) },
            { label: 'Pedidos', value: f.data.pedidos },
            { label: 'Ticket promedio', value: money(t.data.promedio) },
            { label: 'Más vendido', value: mas ? raw(mas.nombre) + ' (' + raw(mas.unidades) + ')' : '—' },
          ];
          var contenedor = $('#kpis-reportes');
            contenedor.textContent = '';

            kpis.forEach(function (k) {
              var tarjeta = document.createElement('div');
              tarjeta.className = 'kpi';

              var etiqueta = document.createElement('div');
              etiqueta.className = 'kpi-label';
              etiqueta.textContent = k.label;

              var valor = document.createElement('div');
              valor.className = 'kpi-value';
              valor.textContent = k.value;

              tarjeta.appendChild(etiqueta);
              tarjeta.appendChild(valor);
              contenedor.appendChild(tarjeta);
            });
                      
        });
      });
    });
  }

  function consultarVentas() {
  var caja = $('#reporte-feedback');
  var variedad = $('#reporte-variedad').value;
  var tabla = $('#tabla-ventas');

  api('/reportes/ventas-por-variedad?variedad=' + encodeURIComponent(variedad)).then(function (resp) {
    tabla.replaceChildren();

    if (!resp.ok) {
      feedback(caja, 'Error: ' + (resp.data.error || 'desconocido'), false);
      return;
    }

    var ventas = resp.data.ventas || [];

    var thead = document.createElement('thead');
    var filaEncabezado = document.createElement('tr');

    ['Origen', 'Producto', 'Unidades', 'Total'].forEach(function (titulo, i) {
      var th = document.createElement('th');
      th.textContent = titulo;

      if (i >= 2) {
        th.className = 'num';
      }

      filaEncabezado.appendChild(th);
    });

    thead.appendChild(filaEncabezado);

    var tbody = document.createElement('tbody');

    ventas.forEach(function (v) {
      var fila = document.createElement('tr');

      [v.variedad, v.nombre, v.unidades, money(v.total)].forEach(function (dato, i) {
        var td = document.createElement('td');
        td.textContent = dato;

        if (i >= 2) {
          td.className = 'num';
        }

        fila.appendChild(td);
      });

      tbody.appendChild(fila);
    });

    tabla.appendChild(thead);
    tabla.appendChild(tbody);

    feedback(caja, 'Consulta realizada.', true);
  });
}

  /* -------------------------------------------------------------- usuarios */
  function cargarUsuarios() {
  api('/admin/usuarios').then(function (resp) {
    var usuarios = resp.data.usuarios || [];
    var tabla = $('#tabla-usuarios');

    tabla.replaceChildren();

    var thead = document.createElement('thead');
    var filaEncabezado = document.createElement('tr');

    ['#', 'Usuario', 'Nombre', 'Rol', 'Acciones'].forEach(function (titulo) {
      var th = document.createElement('th');
      th.textContent = titulo;
      filaEncabezado.appendChild(th);
    });

    thead.appendChild(filaEncabezado);

    var tbody = document.createElement('tbody');

    usuarios.forEach(function (u) {
      var fila = document.createElement('tr');

      [u.id, u.username, u.nombre].forEach(function (dato) {
        var td = document.createElement('td');
        td.textContent = dato;
        fila.appendChild(td);
      });

      var tdRol = document.createElement('td');
      var badge = document.createElement('span');
      badge.className = 'badge' + (u.rol === 'admin' ? ' badge-admin' : '');
      badge.textContent = u.rol;
      tdRol.appendChild(badge);
      fila.appendChild(tdRol);

      var tdAcciones = document.createElement('td');
      var select = document.createElement('select');
      select.dataset.usuario = String(u.id);
      select.className = 'sel-rol';

      ['cliente', 'mozo', 'barista', 'admin'].forEach(function (rol) {
        var opcion = document.createElement('option');
        opcion.value = rol;
        opcion.textContent = rol;
        opcion.selected = rol === u.rol;
        select.appendChild(opcion);
      });

      tdAcciones.appendChild(select);
      fila.appendChild(tdAcciones);
      tbody.appendChild(fila);
    });

    tabla.appendChild(thead);
    tabla.appendChild(tbody);
  });
}

  function cambiarRol(evento) {
    var select = evento.target.closest('.sel-rol');
    if (!select) return;
    var id = select.getAttribute('data-usuario');

    putJSON('/admin/usuarios/' + id, { rol: select.value }).then(function (resp) {
      if (!resp.ok) alert('No se pudo actualizar: ' + (resp.data.error || 'error'));
      cargarUsuarios();
    });
  }

  function cambiarPassword(evento) {
    evento.preventDefault();
    var caja = $('#password-feedback');
    postJSON('/admin/cambiar-contrasena', { nueva: $('#nueva-password').value }).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo cambiar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Contraseña actualizada.', true);
      $('#nueva-password').value = '';
    });
  }

  /* ----------------------------------------------------------- herramientas */
  function probarConexion(evento) {
    evento.preventDefault();
    var salida = $('#salida-conexion');
    salida.textContent = 'Probando…';

    postJSON('/admin/probar-conexion', { host: $('#conexion-host').value }).then(function (resp) {
      if (!resp.ok) {
        salida.textContent = 'Error: ' + (resp.data.error || 'desconocido');
        return;
      }
      salida.textContent =
        '$ ' + resp.data.comando + '\n\n' +
        (resp.data.salida || '') +
        (resp.data.error ? '\n[stderr]\n' + resp.data.error : '');
    });
  }

  function verDiagnostico() {
    var salida = $('#salida-diagnostico');
    salida.textContent = 'Cargando…';
    api('/_diagnostico').then(function (resp) {
      salida.textContent = JSON.stringify(resp.data, null, 2);
    });
  }

  /* ------------------------------------------------------------------ tabs */
  function activarTab(evento) {
    var tab = evento.target.closest('.tab');
    if (!tab) return;
    var vista = tab.getAttribute('data-vista');
    $$('.tab').forEach(function (t) { t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === vista);
    });
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    // FALLA (XSS de DOM): se lee un parámetro de la URL y se inyecta con
    // HTML din�mico. Al abrir admin.html?vista=<script>...</script> se ejecuta
    // código en el navegador del admin.
    var params = new URLSearchParams(window.location.search);
    var objetivo = params.get('vista');
    if (objetivo) {
      $('#panel-bienvenida').textContent = 'Panel ' + objetivo;
    }

    $('#form-login').addEventListener('submit', iniciarSesion);
    $('#btn-logout').addEventListener('click', cerrarSesion);
    $('#btn-refrescar').addEventListener('click', cargarTodo);
    $('#tabs').addEventListener('click', activarTab);
    $('#tabla-pedidos').addEventListener('change', cambiarEstado);
    $('#tabla-productos').addEventListener('click', borrarProducto);
    $('#form-producto').addEventListener('submit', guardarProducto);
    $('#btn-limpiar-producto').addEventListener('click', limpiarFormularioProducto);
    $('#form-upload').addEventListener('submit', subirArchivo);
    $('#form-password').addEventListener('submit', cambiarPassword);
    $('#btn-reporte-variedad').addEventListener('click', consultarVentas);
    $('#tabla-usuarios').addEventListener('change', cambiarRol);
    $('#form-conexion').addEventListener('submit', probarConexion);
    $('#btn-diagnostico').addEventListener('click', verDiagnostico);

    // ¿Ya hay sesión?
    api('/auth/yo').then(function (resp) {
      if (resp.ok) {
        usuario = resp.data.usuario;
        mostrarPanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

