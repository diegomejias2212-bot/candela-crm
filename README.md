# Candela CRM

Sistema de gestión de ventas y clientes para Candela Coffee Roasters.

## Despliegue en Railway

1. Conectar repositorio a Railway
2. Railway detecta automáticamente Node.js
3. El servidor arranca en el puerto configurado por $PORT

## Variables de Entorno

- `PORT` - Puerto del servidor (Railway lo asigna automáticamente)
- `NODE_ENV` - Ambiente (production/development)

## Endpoints

- `GET /` - Interfaz web del CRM
- `GET /api/data` - Obtener todos los datos
- `POST /api/data` - Guardar datos

## Desarrollo Local

```bash
npm start
# Acceder en http://localhost:5000
```
