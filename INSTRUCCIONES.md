# Instrucciones: compilar en local y desplegar a la nube

Este archivo lo podés pegar tal cual en el chat de Claude Code (o seguirlo vos mismo a mano en la terminal de VS Code). Los archivos fuente del proyecto ya están en esta carpeta: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/firebase.js`, `.gitignore`.

## Objetivo
1. Instalar dependencias y correr el proyecto en local.
2. Crear un proyecto de Firebase con Firestore y conectar `src/firebase.js`.
3. Subir el código a un repositorio de GitHub.
4. Desplegar la app a Firebase Hosting para que quede pública en internet.

## Paso 1 — Instalar dependencias
```bash
npm install
```

## Paso 2 — Correr en local
```bash
npm run dev
```
Abrir la URL que muestre la terminal (por defecto `http://localhost:5173`) y confirmar que la app carga.

## Paso 3 — Crear el proyecto de Firebase (esto se hace en el navegador, no por terminal)
1. Ir a https://console.firebase.google.com con la cuenta de Google del negocio.
2. "Agregar proyecto" → nombre `4-de-copas` → seguir el asistente.
3. Dentro del proyecto: Build → Firestore Database → Crear base de datos → modo producción → región cercana (ej. `southamerica-east1`).
4. Firestore → Reglas → reemplazar por:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /app/{doc} {
         allow read: if true;
         allow write: if true;
       }
     }
   }
   ```
5. ⚙️ Configuración del proyecto → Tus apps → ícono web `</>` → registrar app → copiar el objeto `firebaseConfig`.

## Paso 4 — Conectar Firebase
Editar `src/firebase.js` y pegar ahí los valores reales copiados en el paso anterior (reemplazar `TU_API_KEY`, `TU_PROYECTO`, etc.).

Volver a correr `npm run dev` y hacer una reserva de prueba: debería aparecer un documento nuevo en Firestore → colección `app`.

## Paso 5 — Subir a GitHub
```bash
git init
git add .
git commit -m "Primera versión de la app de la peña"
git branch -M main
```
Crear un repositorio vacío en https://github.com/new (privado, sin README) y luego:
```bash
git remote add origin https://github.com/TU-USUARIO/4-de-copas-app.git
git push -u origin main
```
(Si se usa VS Code sin terminal: panel "Source Control" → Initialize Repository → Commit → Publish to GitHub.)

## Paso 6 — Instalar Firebase CLI y autenticar
```bash
npm install -g firebase-tools
firebase login
```

## Paso 7 — Inicializar Hosting
```bash
firebase init hosting
```
Responder:
- Use an existing project → elegir el proyecto creado en el Paso 3.
- Public directory → `dist`
- Configure as a single-page app → `y`
- Set up automatic builds and deploys with GitHub → `y` (opcional, recomendado) o `n`
- Overwrite dist/index.html → `N`

## Paso 8 — Compilar y desplegar
```bash
npm run build
firebase deploy
```
Al terminar, la terminal muestra la **Hosting URL** (ej. `https://4-de-copas.web.app`). Esa es la dirección pública final de la app.

## Verificación final
- [ ] `npm run dev` levanta sin errores.
- [ ] Una reserva de prueba aparece en Firestore.
- [ ] El repositorio existe en GitHub y tiene el código.
- [ ] `firebase deploy` terminó sin errores y devolvió una URL `.web.app`.
- [ ] La URL pública abre la app desde el celular, fuera de la red local.
