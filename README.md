# Software de Gestión – Cerradura Inteligente

## Descripción general

Este repositorio contiene el **software de gestión desarrollado para el proyecto de Cerradura Inteligente**, enfocado exclusivamente en la **capa de software**. El sistema fue construido utilizando **Django (backend)** y **React (frontend)**, siguiendo principios de desarrollo web moderno, separación de responsabilidades y arquitectura cliente–servidor.

El objetivo principal de este software es **administrar, controlar y monitorear el funcionamiento del prototipo**, sirviendo como una plataforma de gestión que centraliza la lógica de negocio, la persistencia de datos y la interfaz de administración.

Este proyecto está orientado a **demostrar habilidades de desarrollo de software**, no a presentar un producto comercial final.

---

## Objetivos del software

* Diseñar una **API backend robusta y mantenible**.
* Implementar una **aplicación frontend desacoplada**, clara y escalable.
* Gestionar información relacionada con accesos, estados y control del sistema.
* Aplicar buenas prácticas de desarrollo: modularidad, control de versiones y documentación.

---

## Alcance del proyecto

Incluye:

* Backend desarrollado en Django.
* Frontend desarrollado en React.
* Comunicación cliente–servidor mediante API REST.
* Persistencia de datos y lógica de negocio.
* Validación funcional del sistema en entorno de prototipo.

No incluye:

* Despliegue en producción.
* Seguridad a nivel industrial o certificaciones.
* Pruebas con usuarios finales.

---

## Arquitectura del sistema

El sistema sigue una **arquitectura cliente–servidor**:

* **Backend (Django)**: expone una API REST encargada de la lógica de negocio, validaciones y acceso a datos.
* **Frontend (React)**: consume la API y presenta una interfaz de gestión clara e interactiva.
* **Base de datos**: almacena información relacionada con accesos, estados y registros del sistema.

Esta separación permite escalabilidad, mantenibilidad y facilidad de pruebas.

---

## Tecnologías utilizadas

### Backend

* Python
* Django
* Django REST Framework

### Frontend

* JavaScript
* React
* HTML / CSS

### Otras herramientas

* Git y GitHub
* API REST
* Markdown para documentación

---

## Estructura del repositorio

```text
smartlock-project
¦   .gitignore
¦   
+---backend
¦   ¦   .env
¦   ¦   manage.py
¦   ¦   requirements.txt
¦   ¦   
¦   +---accounts
¦   +---config         
¦   +---env    
¦   +---locks
¦               
+---frontend
    +---node_modules       
    +---public       
    +---src
```

---

## Instalación y ejecución

### Backend

1. Crear un entorno virtual:

   ```bash
   python -m venv venv
   ```
2. Activar el entorno virtual.
3. Instalar dependencias:

   ```bash
   pip install -r requirements.txt
   ```
4. Ejecutar migraciones:

   ```bash
   python manage.py migrate
   ```
5. Iniciar el servidor:

   ```bash
   python manage.py runserver
   ```

### Frontend

1. Instalar dependencias:

   ```bash
   npm install
   ```
2. Iniciar el servidor:

   ```bash
   npm run dev
   ```

---

## Funcionalidades principales

* Gestión de accesos y usuarios.
* Administración de registros relacionados con accesos.
* Comunicación en tiempo real o periódica con el backend.
* Interfaz web para monitoreo y control.

---

## Validación y pruebas

El software fue validado mediante:

* Pruebas funcionales del backend (endpoints y lógica de negocio).
* Verificación de consumo correcto de la API desde el frontend.
* Pruebas manuales de flujo completo del sistema.

Estas validaciones confirmaron el correcto funcionamiento del software dentro del alcance definido.

---

## Posibles mejoras futuras

* Implementación de autenticación y autorización avanzada.
* Pruebas automatizadas (unitarias e integración).
* Despliegue en la nube.
* Mejora de la interfaz de usuario.

---

## Autor

Juan Diego Campos Quiñones

---

## Nota

Este repositorio demuestra competencias en **desarrollo backend y frontend**, diseño de APIs, arquitectura cliente–servidor y buenas prácticas de ingeniería de software, aplicadas en un proyecto realista y bien documentado.
