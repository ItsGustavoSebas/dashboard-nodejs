# --- Etapa 1: Compilación (Build) ---
# Usa una imagen de Node 18 (o la que uses)
FROM node:18 AS builder

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala TODAS las dependencias (incluyendo devDependencies como 'typescript')
RUN npm install

# Copia todo el código fuente
COPY . .

# Ejecuta el script de compilación (tsc)
RUN npm run build

# --- Etapa 2: Producción (Final) ---
# Usa una imagen 'slim' más ligera para producción
FROM node:18-slim

WORKDIR /app

# Copia los archivos de dependencias de nuevo
COPY package*.json ./

# Instala SOLO las dependencias de producción
RUN npm ci --only=production

# Copia cualquier otra cosa que necesites en producción (ej. carpetas 'config', 'migrations')
# Descomenta y ajusta si es necesario.
# COPY --from=builder /app/config ./config
# COPY --from=builder /app/migrations ./migrations

# Tu app debe escuchar en el puerto que Google le da.
# Tu código debe usar process.env.PORT
ENV PORT 8080
EXPOSE 8080

# El comando para iniciar tu app (debe coincidir con tu script 'start')
CMD [ "node", "index.js" ]