# Informe complementario de seguridad

## TP4 — Cafetería Origen

*Materia:* Programación IV
*Universidad:* UTN — Facultad Regional Bahía Blanca
*Proyecto:* Cafetería Origen — Grupo 2
*Fecha:* 25/11/2026

---

## 1. Objetivo

El objetivo de este informe es documentar los resultados de la revisión de seguridad de Cafetería Origen, las correcciones realizadas durante el trabajo práctico y los controles recomendados que quedaron pendientes.

Durante el desarrollo analizamos distintas vulnerabilidades de seguridad, aplicando los conocimientos vistos en la materia y comprobando las correcciones mediante pruebas automatizadas y verificaciones manuales.

Al finalizar esta etapa, obtuvimos los siguientes resultados:

| Verificación                     | Resultado       |
| -------------------------------- | --------------- |
| Tests funcionales                | 28/28 aprobados |
| Tests de seguridad               | 29/29 aprobados |
| Controles críticos del checklist | 37/37 aprobados |
| Controles recomendados           | 3 pendientes    |

Estos resultados muestran que se cumplieron los controles críticos evaluados por las herramientas del proyecto, aunque todavía existen mejoras que podrían implementarse para reforzar su seguridad.

## 2. Correcciones realizadas durante el TP4

Durante el desarrollo del trabajo práctico nos encargamos de identificar, analizar y corregir diferentes vulnerabilidades presentes en la aplicación Cafetería Origen.

Para organizarnos, dividimos las tareas entre los integrantes del grupo, trabajando sobre distintas partes del sistema y aplicando las medidas de seguridad correspondientes.

Entre los problemas abordados se encontraron vulnerabilidades relacionadas con *inyección SQL, Cross-Site Scripting (XSS), Cross-Site Request Forgery (CSRF), validación de entradas, autenticación y sesiones, ataques de fuerza bruta, inyección de comandos y configuración de seguridad*.

Las correcciones incluyeron la utilización de consultas parametrizadas para evitar que las entradas de los usuarios modificaran las instrucciones SQL, el tratamiento seguro de datos mostrados en el frontend y la incorporación de validaciones para impedir el procesamiento de información incorrecta o maliciosa.

También trabajamos en mejorar la autenticación de usuarios, proteger las sesiones, limitar intentos repetidos de inicio de sesión y evitar que se ejecutaran comandos del sistema operativo a partir de datos no confiables.

Otra parte importante fue la configuración de seguridad, donde aplicamos medidas para proteger la información sensible, mejorar los permisos y reducir la exposición innecesaria de datos internos.

Una vez terminadas las correcciones individuales, integramos los cambios en la rama dev del repositorio grupal y verificamos que las distintas soluciones funcionaran correctamente en conjunto.

Durante la revisión final identificamos dos controles críticos adicionales que todavía estaban pendientes:

- *VAL-01:* validación de identificadores en las rutas.
- *CFG-02:* eliminación de secretos escritos directamente en el código.

Realizamos las modificaciones correspondientes y volvimos a ejecutar las pruebas, obteniendo finalmente los 37 controles críticos aprobados.

## 3. Controles recomendados pendientes

Aunque logramos completar los controles críticos evaluados por el checklist, identificamos tres medidas recomendadas que podrían implementarse en una futura mejora.

### 3.1. CSRF-03 — Verificación del origen de las peticiones

*Estado:* Pendiente.

El checklist no detectó una implementación que verifique las cabeceras Origin o Referer en las peticiones HTTP que modifican información.

Aunque la aplicación ya cuenta con tokens anti-CSRF y cookies con SameSite, comprobar el origen de las solicitudes permitiría incorporar una capa adicional de protección.

La mejora propuesta consiste en implementar un middleware que valide el origen de las peticiones POST, PUT, PATCH y DELETE, complementando los mecanismos de seguridad existentes.

### 3.2. AUTH-13 — Credenciales triviales por defecto

*Estado:* Pendiente.

*Archivos involucrados:* src/inicializar.ts y src/config.ts.

Durante la revisión identificamos que algunos usuarios iniciales tienen contraseñas fáciles de adivinar, como admin/admin.

Si bien el proyecto utiliza bcrypt para almacenar las contraseñas de forma segura, esto no impide que una persona intente ingresar utilizando credenciales conocidas.

Además, la inicialización de la base de datos puede restablecer contraseñas existentes.

La mejora recomendada consiste en eliminar las contraseñas predeterminadas del código fuente y configurar credenciales iniciales seguras mediante variables de entorno.

### 3.3. CFG-05 — Ejecutar Docker sin privilegios de root

*Estado:* Pendiente.

*Archivo involucrado:* Dockerfile.

El checklist indicó que no se encontró una configuración explícita para ejecutar la aplicación con un usuario sin privilegios.

La mejora propuesta consiste en crear o utilizar un usuario con permisos limitados dentro del contenedor y ajustar los permisos de las carpetas necesarias para su funcionamiento.

Esto permitiría aplicar el principio de mínimos privilegios y reducir el impacto de una posible vulnerabilidad.

---
## 4. Configuración del entorno después de las correcciones de seguridad
El proyecto original incluye un README proporcionado por la cátedra, que contiene las instrucciones iniciales de ejecución y la descripción de las vulnerabilidades propuestas para el trabajo práctico. Como parte de las correcciones de seguridad realizadas por el grupo, se modificó la configuración para utilizar variables de entorno. Por este motivo, documentamos a continuación los pasos necesarios para ejecutar correctamente la versión corregida, sin modificar el material original proporcionado por el docente.
Durante la revisión final del TP4 realizamos una modificación importante relacionada con la gestión de secretos y la configuración de la aplicación.

Anteriormente, algunas contraseñas y secretos estaban definidos directamente en el código fuente. Para mejorar la seguridad, modificamos la configuración para utilizar variables de entorno, evitando almacenar estos valores sensibles en el repositorio.

Por este motivo, **antes de ejecutar el proyecto es necesario crear un archivo `.env`**.

### Pasos para ejecutar el proyecto

**1. Crear el archivo `.env`**

Desde la carpeta principal del repositorio, ejecutar:

```powershell
Copy-Item .env.example .env
```

Este comando crea una copia del archivo de ejemplo, que contiene las variables necesarias para configurar la aplicación.

**2. Configurar las variables de entorno**

Abrir el archivo `.env` y completar las siguientes variables:

| Variable | Función |
|---|---|
| `DB_PASSWORD` | Contraseña de conexión a PostgreSQL. |
| `SESSION_SECRET` | Secreto utilizado para proteger las sesiones y generar tokens anti-CSRF. |
| `DB_USER` | Usuario de PostgreSQL utilizado por la aplicación. |
| `APP_PORT` | Puerto desde el cual se accede al sistema. |

La variable `SESSION_SECRET` debe contener un valor aleatorio y difícil de predecir.

Para generarlo desde Windows PowerShell se pueden utilizar los siguientes comandos:

```powershell
$b = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($b)
[BitConverter]::ToString($b).Replace('-', '')
```

El resultado debe copiarse como valor de `SESSION_SECRET` en el archivo `.env`.

**Importante:** el archivo `.env` contiene información sensible, por lo que está excluido del control de versiones mediante `.gitignore` y no debe subirse a GitHub.

Si la base de datos ya fue inicializada, es necesario utilizar la contraseña correspondiente a esa instalación, ya que modificar el archivo `.env` no cambia automáticamente la contraseña almacenada en PostgreSQL.

**3. Iniciar la aplicación**

Con las variables configuradas, ejecutar:

```powershell
docker compose config --quiet
docker compose up -d --build
```

Una vez iniciado el proyecto, se puede acceder desde el navegador a:

`http://localhost:8080`

Siempre que se utilice el puerto predeterminado.

**4. Comprobar el funcionamiento**

Para ejecutar las pruebas del proyecto:

```powershell
docker compose exec app npm test
docker compose exec app npm run test:seguridad
docker compose exec app npm run check:security
```

En la última verificación realizada se obtuvieron 28 tests funcionales aprobados, 29 tests de seguridad aprobados y 37 controles críticos del checklist cubiertos.

### Importancia de esta modificación

Esta corrección nos permitió aplicar una buena práctica de seguridad: separar las credenciales y los secretos del código fuente.

Además, comprendimos que una modificación de seguridad puede requerir cambios en la configuración del entorno y en el procedimiento de ejecución del proyecto.

Por eso consideramos importante dejar documentados estos pasos, para que cualquier integrante del grupo o el docente pueda configurar y ejecutar la aplicación correctamente.

---

## 5. Experiencia durante el desarrollo

Durante el desarrollo del TP4 pudimos poner en práctica diferentes conceptos de ciberseguridad que habíamos desarrollado en teoria dada por la cátedra.

Una de las principales dificultades fue identificar vulnerabilidades en una aplicación que, a simple vista, funcionaba correctamente. Al analizar el código y realizar las pruebas comprendimos que un sistema puede cumplir con sus funcionalidades y, al mismo tiempo, presentar problemas importantes de seguridad.

El trabajo nos permitió entender mejor cómo se originan las vulnerabilidades y por qué es necesario tomar medidas de prevención desde el momento en que se desarrolla una aplicación.

También aprendimos que no existe una única solución para todos los problemas de seguridad. Cada vulnerabilidad requiere analizar sus causas y aplicar las medidas correspondientes, como validar entradas, separar los datos del código, controlar permisos, proteger sesiones y configurar correctamente los servicios.

Otro aspecto importante fue la utilización de herramientas como Docker, Git y GitHub.

Docker nos permitió ejecutar la aplicación y la base de datos en un entorno controlado, mientras que Git facilitó la organización del trabajo mediante ramas individuales, commits y Pull Requests.

La integración grupal también fue una parte fundamental del proceso. Cada integrante realizó sus correcciones y posteriormente tuvimos que comprobar que todas las modificaciones funcionaran juntas sin afectar el comportamiento de la aplicación.

Finalmente, las pruebas automatizadas nos ayudaron a verificar los resultados. En lugar de asumir que una vulnerabilidad estaba corregida, ejecutamos los tests correspondientes y analizamos sus resultados.

Esto nos permitió detectar problemas, realizar ajustes y comprobar que las funcionalidades principales continuaran funcionando correctamente.

## 6. Reflexión grupal

Consideramos que este trabajo práctico fue una experiencia importante para nuestra formación como futuros programadores, porque nos permitió comprender la ciberseguridad desde el punto de vista del desarrollo de software.

&#x20;Sin embargo, al trabajar sobre una aplicación concreta pudimos observar cómo pequeños errores de programación o configuración pueden generar vulnerabilidades.

Uno de los principales aprendizajes fue comprender que la seguridad no debe agregarse únicamente al finalizar un proyecto, sino que tiene que estar presente durante todo el desarrollo.

También entendimos que no alcanza con corregir una falla de manera aislada. Es necesario comprobar que la solución funcione, que no afecte otras partes del sistema y que los distintos controles de seguridad se complementen.

El trabajo en equipo fue otro aspecto positivo. La división de tareas nos permitió abordar diferentes vulnerabilidades, mientras que la integración de los cambios nos ayudó a mejorar la organización, la comunicación y el uso de herramientas de control de versiones.

## 7. Conclusión

Con el desarrollo del TP4 de Cafetería Origen logramos aplicar los conocimientos teóricos de ciberseguridad a una aplicación web de práctica.

A lo largo del trabajo identificamos y corregimos vulnerabilidades de distintas categorías, incorporando medidas de protección y verificando las modificaciones mediante pruebas automatizadas.

Después de integrar las correcciones realizadas por todos los integrantes, obtuvimos los siguientes resultados:

- *28 de 28 tests funcionales aprobados.*
- *29 de 29 tests de seguridad aprobados.*
- *37 de 37 controles críticos del checklist cubiertos.*

También identificamos tres controles recomendados que quedaron documentados para una futura mejora: la verificación del origen de las peticiones, la eliminación de credenciales triviales y la ejecución del contenedor sin privilegios de root.

Decidimos mantener estas recomendaciones documentadas sin realizar nuevas modificaciones, ya que los controles críticos evaluados estaban cubiertos y buscábamos conservar la estabilidad de la aplicación.

Como conclusión, este trabajo nos permitió comprender que desarrollar software seguro no consiste solamente en solucionar vulnerabilidades, sino también en prevenirlas, comprobar las correcciones, trabajar de manera organizada y reconocer los aspectos que todavía pueden mejorarse.

---

*Estado final del proyecto según las verificaciones realizadas:* 57 tests aprobados, 37 controles críticos cubiertos y 3 controles recomendados pendientes.