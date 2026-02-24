# SQL Scripts — eCommerce Database

## Archivos

| Archivo | Descripción |
|---|---|
| `01_schema.sql` | Crea la base de datos `ecommerce` y todas las tablas |
| `02_seed_data.sql` | Inserta datos de prueba |

## Instrucciones

```bash
# 1. Conectar a MariaDB
mysql -u root -p

# 2. Ejecutar schema (crea la BD y todas las tablas)
source /ruta/completa/sql/01_schema.sql

# 3. Ejecutar datos de prueba
source /ruta/completa/sql/02_seed_data.sql
```

## Usuarios de prueba

| Email | Contraseña | Rol |
|---|---|---|
| `admin@ecommerce.com` | `password123` | ADMIN |
| `gestor@ecommerce.com` | `password123` | ORDER_MANAGER |
| `cliente1@email.com` | `password123` | CUSTOMER |
| `cliente2@email.com` | `password123` | CUSTOMER |
| `cliente3@email.com` | `password123` | CUSTOMER |

## Datos incluidos

- 5 usuarios (1 admin, 1 gestor, 3 clientes)
- 9 categorías (con subcategorías)
- 8 productos (con variantes: talla, color, almacenamiento)
- 3 métodos de envío
- 3 métodos de pago (Stripe, PayPal, contrareembolso)
- 3 cupones de descuento
- 3 pedidos de ejemplo
- 3 reseñas
- 2 artículos de blog
- 3 páginas legales
- Configuración del sitio
