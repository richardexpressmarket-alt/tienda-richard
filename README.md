# Richard Express Market 🛒

Tienda online completa con panel admin, vendedor y boletas.

## Configuración

### 1. Clonar y instalar
```bash
npm install
```

### 2. Crear archivo .env en la raíz del proyecto
```
VITE_SUPABASE_URL=https://XXXXXXXX.supabase.co
VITE_SUPABASE_KEY=tu_anon_key
VITE_WHATSAPP=51924545856
```

### 3. Configurar Supabase Storage
En el panel de Supabase:
- Ve a **Storage** → **New bucket**
- Nombre: `imagenes`
- Marca como **Public bucket** ✅
- Clic en **Create bucket**

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

### 5. Construir para producción
```bash
npm run build
```

## Roles
- **Admin**: `/admin` — gestiona productos, categorías, ve ventas y usuarios
- **Vendedor**: `/vendedor` — punto de venta físico con boletas
- **Comprador**: página principal, sin login requerido

## Primer usuario admin
1. Regístrate desde `/login`
2. Ve a Supabase → Table Editor → perfiles
3. Cambia tu rol a `admin` manualmente
4. Desde ahí puedes cambiar roles de otros usuarios desde el panel
