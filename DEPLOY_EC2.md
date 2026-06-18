# 🚀 Guía de Deploy en AWS EC2 — ControlTrack

## Arquitectura

```
Internet → EC2 (Ubuntu 22.04)
              ├── Nginx (puerto 80/443)  → Frontend (build estático)
              ├── FastAPI (puerto 8000)  → Backend Python
              └── MySQL (puerto 3306)   → Base de datos local
```

---

## 1. Crear instancia EC2

- AMI: **Ubuntu Server 22.04 LTS**
- Tipo: `t3.small` (mínimo recomendado) o `t2.micro` (free tier)
- Security Group — abrir puertos:
  | Puerto | Protocolo | Desde     | Para qué          |
  |--------|-----------|-----------|-------------------|
  | 22     | TCP       | Tu IP     | SSH               |
  | 80     | TCP       | 0.0.0.0/0 | HTTP (frontend)   |
  | 443    | TCP       | 0.0.0.0/0 | HTTPS (opcional)  |
  | 8000   | TCP       | 0.0.0.0/0 | API (temporal)    |

---

## 2. Conectarse y preparar el servidor

```bash
ssh -i tu-key.pem ubuntu@TU_IP_EC2

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y python3-pip python3-venv mysql-server nginx git unzip
```

---

## 3. Configurar MySQL

```bash
sudo mysql_secure_installation
# Seguir el wizard (anotar tu contraseña root)

sudo mysql -u root -p
```

```sql
-- Dentro de MySQL:
CREATE DATABASE controltrack CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'controltrack'@'localhost' IDENTIFIED BY 'controltrack2024';
GRANT ALL PRIVILEGES ON controltrack.* TO 'controltrack'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## 4. Subir y configurar el Backend

```bash
# Opción A: subir por SCP desde tu máquina local
scp -i tu-key.pem -r ./backend ubuntu@TU_IP_EC2:/home/ubuntu/controltrack/

# Opción B: clonar desde GitHub (si subiste el código ahí)
# git clone https://github.com/tu-usuario/controltrack.git
```

```bash
cd /home/ubuntu/controltrack/backend

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
cp .env.example .env
nano .env
```

**Editar `.env`** con tus datos reales:
```env
FULLTRACK_BASE_URL=http://ws.fulltrack2.com
FULLTRACK_APIKEY=TU_API_KEY_REAL
FULLTRACK_SECRET=TU_SECRET_KEY_REAL

DB_HOST=localhost
DB_PORT=3306
DB_USER=controltrack
DB_PASS=controltrack2024
DB_NAME=controltrack

ADMIN_USER=admin
ADMIN_PASSWORD=TU_PASSWORD_SEGURO
```

### Probar que el backend arranca:
```bash
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
# Ctrl+C para detener
```

---

## 5. Configurar Backend como servicio (systemd)

```bash
sudo nano /etc/systemd/system/controltrack.service
```

```ini
[Unit]
Description=ControlTrack FastAPI Backend
After=network.target mysql.service

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/controltrack/backend
Environment="PATH=/home/ubuntu/controltrack/backend/venv/bin"
ExecStart=/home/ubuntu/controltrack/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable controltrack
sudo systemctl start controltrack
sudo systemctl status controltrack
```

---

## 6. Build y deploy del Frontend

**En tu máquina LOCAL:**
```bash
cd frontend

# Crear .env de producción
echo "VITE_API_URL=http://TU_IP_EC2:8000" > .env

npm install
npm run build
# Genera la carpeta dist/

# Subir a EC2
scp -i tu-key.pem -r dist ubuntu@TU_IP_EC2:/home/ubuntu/controltrack/frontend-dist
```

---

## 7. Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/controltrack
```

```nginx
server {
    listen 80;
    server_name TU_IP_EC2;  # o tu dominio

    # Frontend (archivos estáticos)
    root /home/ubuntu/controltrack/frontend-dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy al Backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> ⚠️ Si usas Nginx como proxy para la API, cambia en el frontend:
> `.env` → `VITE_API_URL=http://TU_IP_EC2` (sin el :8000, Nginx hace el ruteo)

```bash
sudo ln -s /etc/nginx/sites-available/controltrack /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 8. Primer uso — Sincronizar con Fulltrack

1. Abre `http://TU_IP_EC2` en el navegador
2. Inicia sesión con `admin` / tu contraseña
3. Haz clic en **"Sincronizar"** (botón azul arriba a la derecha)
4. El sistema llama a los 4 endpoints de Fulltrack y llena la BD

---

## 9. Comandos útiles en producción

```bash
# Ver logs del backend en tiempo real
sudo journalctl -u controltrack -f

# Reiniciar backend (tras cambios)
sudo systemctl restart controltrack

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log

# Actualizar el frontend (desde local → EC2)
npm run build && scp -i tu-key.pem -r dist ubuntu@IP:/home/ubuntu/controltrack/frontend-dist
```

---

## 10. Arquitectura de carpetas final en EC2

```
/home/ubuntu/controltrack/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── crud.py
│   ├── requirements.txt
│   ├── .env               ← nunca subir a GitHub
│   └── venv/
└── frontend-dist/         ← build estático de Vite
    ├── index.html
    └── assets/
```

---

## ✅ Checklist de deploy

- [ ] EC2 corriendo con Ubuntu 22.04
- [ ] MySQL instalado y BD `controltrack` creada
- [ ] Backend corriendo como servicio systemd
- [ ] `.env` con las keys reales de Fulltrack
- [ ] Frontend buildeado y en `/frontend-dist`
- [ ] Nginx configurado y corriendo
- [ ] Primer sync exitoso desde el dashboard
- [ ] Security Group: puerto 22 restringido a tu IP
