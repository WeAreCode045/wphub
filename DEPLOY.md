# Deploy naar eigen server

## Optie 1: Docker Image builden en pushen

### 1. Build de Docker image lokaal
```bash
docker build -t wphub:latest .
```

### 2. Tag de image voor je registry
```bash
# Als je een registry gebruikt (bijv. Docker Hub, GitHub Container Registry)
docker tag wphub:latest your-registry.com/wphub:latest
docker push your-registry.com/wphub:latest
```

### 3. Deploy op je server
SSH naar je server en run:
```bash
# Pull de nieuwe image
docker pull your-registry.com/wphub:latest

# Stop de oude container
docker stop wphub || true
docker rm wphub || true

# Start de nieuwe container
docker run -d \
  --name wphub \
  -p 80:80 \
  --restart unless-stopped \
  your-registry.com/wphub:latest
```

## Optie 2: Direct builden op server (sneller voor kleine wijzigingen)

### 1. Push code naar repository
```bash
git add .
git commit -m "Fix: Add Nginx SPA routing for /login"
git push
```

### 2. SSH naar server en deploy
```bash
# SSH naar je server
ssh user@pluginhub.code045.nl

# Ga naar de app directory
cd /path/to/wphub

# Pull laatste wijzigingen
git pull

# Rebuild Docker image
docker build -t wphub:latest .

# Stop oude container en start nieuwe
docker stop wphub && docker rm wphub
docker run -d \
  --name wphub \
  -p 80:80 \
  --restart unless-stopped \
  wphub:latest

# Check logs
docker logs -f wphub
```

## Optie 3: Met docker-compose (aanbevolen)

### 1. Maak docker-compose.yml op je server:
```yaml
version: '3.8'

services:
  wphub:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
    environment:
      - NODE_ENV=production
```

### 2. Deploy
```bash
# SSH naar server
ssh user@pluginhub.code045.nl

# Ga naar app directory
cd /path/to/wphub

# Pull wijzigingen
git pull

# Rebuild en restart
docker-compose up -d --build

# Check status
docker-compose logs -f
```

## Verificatie

Na deployment, test deze URLs:
- https://pluginhub.code045.nl/ - Homepage
- https://pluginhub.code045.nl/login - Login pagina (zou nu moeten werken!)
- https://pluginhub.code045.nl/dashboard - Dashboard

## Troubleshooting

### Als /login nog steeds 404 geeft:
```bash
# Check of Nginx config correct is geladen
docker exec wphub cat /etc/nginx/conf.d/default.conf

# Check Nginx logs
docker logs wphub

# Herstart Nginx binnen de container
docker exec wphub nginx -s reload
```

### Check welke files in de container zitten:
```bash
docker exec wphub ls -la /usr/share/nginx/html
```

Je zou moeten zien:
- index.html
- assets/
- Andere static files

## Wijzigingen in deze deploy

✅ **nginx.conf toegevoegd** - SPA routing configuratie  
✅ **Dockerfile aangepast** - Nginx config wordt gekopieerd  
✅ **try_files directive** - Alle routes worden naar index.html gestuurd  

Dit zorgt ervoor dat React Router alle routes kan afhandelen, inclusief `/login`!
