# Modelo de datos
Tablas: users, products, sales, sale_items, expenses, cash_closures.
Fechas en ISO string.
Montos en COP enteros.
Relaciones:
- sales.user_id -> users.id
- sale_items.sale_id -> sales.id
- sale_items.product_id -> products.id
