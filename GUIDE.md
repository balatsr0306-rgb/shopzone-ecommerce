# 🛒 ShopZone — Complete DevSecOps Guide
## React + Node.js + PostgreSQL → EKS + Jenkins + ArgoCD + SonarQube + Trivy + Prometheus/Grafana

---

## 📁 Project Structure

```
shopzone/
├── backend/
│   ├── src/
│   │   ├── config/         db.js, migrate.js
│   │   ├── controllers/    auth, product, cart, order
│   │   ├── middleware/     auth.js (JWT)
│   │   └── routes/         index.js
│   ├── sonar-project.properties   ← SonarQube config
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/Navbar/
│   │   ├── context/AppContext.js
│   │   ├── pages/  Home, Product, Cart, Login, Register, Orders, Admin
│   │   └── utils/api.js
│   ├── public/index.html
│   ├── sonar-project.properties   ← SonarQube config
│   ├── Dockerfile
│   └── nginx.conf
│
├── helm/shopzone/                 ← Helm chart (ArgoCD deploys this)
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── backend-deployment.yaml
│       ├── frontend-deployment.yaml
│       └── ingress.yaml
│
├── jenkins/
│   ├── Jenkinsfile                ← Full CI/CD pipeline
│   └── k8s/jenkins-deployment.yaml
│
├── sonarqube/
│   └── k8s/sonarqube-deployment.yaml
│
├── trivy/
│   └── trivy-k8s-scan.sh          ← Local Trivy scan helper
│
├── argocd/
│   ├── argocd-app.yaml
│   └── install-argocd.sh
│
├── monitoring/
│   ├── install-monitoring.sh
│   ├── prometheus-dev.yml
│   └── shopzone-servicemonitor.yaml
│
├── k8s/
│   └── eks-setup.sh               ← One-shot EKS cluster setup
│
└── docker-compose.yml             ← Local dev (all services)
```

---

## 🏗️ Full Architecture

```
Developer → Git Push → GitHub
                          │
                    GitHub Webhook
                          │
                    ┌─────▼──────┐
                    │  Jenkins   │  (Pod inside EKS — no server install)
                    │  Pipeline  │
                    └─────┬──────┘
                          │
          ┌───────────────┼────────────────┐
          │               │                │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │  SonarQube  │ │Docker Build │ │   Trivy     │
   │ Code Quality│ │  + ECR Push │ │ Image Scan  │
   └─────────────┘ └─────────────┘ └─────────────┘
                          │
                   Update Helm values.yaml
                          │
                    ┌─────▼──────┐
                    │  ArgoCD    │  GitOps — watches Helm chart in Git
                    │  Auto-sync │
                    └─────┬──────┘
                          │
               ┌──────────▼───────────┐
               │   AWS EKS Cluster    │
               │  ┌────────────────┐  │
               │  │  shopzone ns   │  │
               │  │  ─ backend ×2  │  │
               │  │  ─ frontend ×2 │  │
               │  └────────────────┘  │
               │  AWS ALB Ingress     │
               └──────────────────────┘
                          │
                   Route53 / Domain
                          │
                    End Users 🌍
```

---

## ✅ PREREQUISITES — Install These First

On your local machine / bastion host:

```bash
# 1. AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip awscliv2.zip && sudo ./aws/install
aws configure          # enter Access Key, Secret, region=ap-south-1, format=json

# 2. eksctl (EKS cluster manager)
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | \
  tar xz -C /tmp && sudo mv /tmp/eksctl /usr/local/bin

# 3. kubectl
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 4. Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 5. Docker (for local builds)
sudo apt install -y docker.io && sudo usermod -aG docker $USER && newgrp docker

# 6. Trivy (for local scan)
sudo apt-get install -y wget apt-transport-https gnupg lsb-release
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | \
  sudo tee -a /etc/apt/sources.list.d/trivy.list
sudo apt-get update && sudo apt-get install -y trivy

# Verify all tools
aws --version && eksctl version && kubectl version --client && helm version && trivy --version
```

---

## 🚀 STEP 1 — Create EKS Cluster

```bash
# Run the setup script (takes ~15 minutes)
chmod +x k8s/eks-setup.sh
./k8s/eks-setup.sh

# Verify cluster
kubectl get nodes
# Expected: 3 nodes in Ready state
```

What `eks-setup.sh` does automatically:
- Creates EKS cluster with managed node group (t3.medium × 3)
- Installs AWS Load Balancer Controller (for ALB Ingress)
- Installs metrics-server (for HPA)
- Creates ECR repositories for backend + frontend
- Configures kubeconfig

---

## 🗄️ STEP 2 — Create RDS PostgreSQL

In AWS Console → RDS → Create Database:

```
Engine:        PostgreSQL 15
Template:      Free tier (dev) or Production
DB name:       ecommerce
Username:      postgres
Password:      YourStrongPassword123!
Instance:      db.t3.micro (dev) / db.t3.small (prod)
Storage:       20 GB gp3
VPC:           Same VPC as EKS cluster
Subnet group:  Private subnets
Public access: NO  ← Critical!
Security Group: Allow port 5432 from EKS node SG only
```

Save the RDS endpoint — you'll need it in Step 5.

---

## 🔧 STEP 3 — Deploy Jenkins (as Pod in EKS)

Jenkins runs as a container inside EKS. No server installation needed.

```bash
# Deploy Jenkins pod + service + ingress
kubectl apply -f jenkins/k8s/jenkins-deployment.yaml

# Wait for Jenkins to be ready (~2 minutes)
kubectl rollout status deployment/jenkins -n jenkins --timeout=180s

# Get Jenkins URL
kubectl get ingress -n jenkins
# Visit: http://jenkins.yourdomain.com/jenkins

# Get initial admin password
kubectl exec -n jenkins deployment/jenkins -- \
  cat /var/jenkins_home/secrets/initialAdminPassword
```

### Install Jenkins Plugins

In Jenkins UI → Manage Jenkins → Plugin Manager, install:
```
- Pipeline
- Git + GitHub
- Docker Pipeline
- Kubernetes (for pod agents)
- AWS Credentials
- Pipeline: AWS Steps
- SonarQube Scanner
- HTML Publisher          ← to display Trivy reports
- Blue Ocean (optional, for nice UI)
```

### Configure Jenkins Credentials

Jenkins UI → Manage Jenkins → Credentials → Add:

| ID | Type | Value |
|----|------|-------|
| `AWS_CREDENTIALS` | AWS | Your AWS Access Key + Secret Key |
| `ECR_REGISTRY` | Secret text | `123456789.dkr.ecr.ap-south-1.amazonaws.com` |
| `ARGOCD_SERVER` | Secret text | `argocd.yourdomain.com` |
| `ARGOCD_TOKEN` | Secret text | ArgoCD API token (get in Step 5) |
| `SONAR_HOST_URL` | Secret text | `http://sonarqube.sonarqube.svc:9000/sonar` |
| `SONAR_TOKEN` | Secret text | SonarQube token (get in Step 4) |

---

## 🔍 STEP 4 — Deploy SonarQube (as Pod in EKS)

SonarQube also runs as a pod inside EKS — no external server needed.

```bash
# Required: increase vm.max_map_count on all EKS nodes
# (SonarQube uses Elasticsearch which needs this)
kubectl apply -f - <<'EOF'
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: sysctl-setter
  namespace: kube-system
spec:
  selector:
    matchLabels:
      app: sysctl-setter
  template:
    metadata:
      labels:
        app: sysctl-setter
    spec:
      hostPID: true
      hostIPC: true
      hostNetwork: true
      initContainers:
        - name: set-sysctl
          image: busybox
          command: ["sysctl", "-w", "vm.max_map_count=524288"]
          securityContext:
            privileged: true
      containers:
        - name: pause
          image: gcr.io/google_containers/pause:latest
EOF

# Wait for DaemonSet
kubectl rollout status daemonset/sysctl-setter -n kube-system

# Deploy SonarQube
kubectl apply -f sonarqube/k8s/sonarqube-deployment.yaml

# Wait for SonarQube (takes 2-3 minutes — starts Elasticsearch internally)
kubectl rollout status deployment/sonarqube -n sonarqube --timeout=300s

# Get SonarQube URL
kubectl get ingress -n sonarqube
# Visit: http://sonar.yourdomain.com/sonar
# Default login: admin / admin  ← Change immediately!
```

### Create SonarQube Projects + Token

```
1. Login to SonarQube UI → admin / admin
2. Change password when prompted
3. Create Project → "shopzone-backend"  → Generate token → copy it
4. Create Project → "shopzone-frontend" → same token works
5. Copy token → paste into Jenkins credential "SONAR_TOKEN"
6. Also set Quality Gate:
   SonarQube → Quality Gates → Create → set conditions:
     Coverage < 50% → ERROR
     Duplicated Lines > 10% → ERROR
     Reliability Rating worse than A → ERROR
```

---

## 🛡️ STEP 5 — Trivy Setup (No Deployment Needed)

Trivy runs as a **container inside every Jenkins pipeline run** — no separate deployment. It is already configured in the Jenkinsfile.

For local scans before pushing:

```bash
# Scan a Docker image locally
trivy image shopzone-backend:latest

# Scan only CRITICAL vulnerabilities (fast)
trivy image --severity CRITICAL shopzone-backend:latest

# Scan source code / dependencies
trivy fs ./backend
trivy fs ./frontend

# Generate HTML report
trivy image --format template \
  --template "@contrib/html.tpl" \
  --output report.html \
  shopzone-backend:latest
open report.html

# Using the helper script
chmod +x trivy/trivy-k8s-scan.sh
./trivy/trivy-k8s-scan.sh shopzone-backend:latest shopzone-frontend:latest ./reports
```

---

## 🔄 STEP 6 — Deploy ArgoCD

```bash
chmod +x argocd/install-argocd.sh
./argocd/install-argocd.sh

# Get ArgoCD URL + initial password (printed by the script)
# Visit: http://argocd.yourdomain.com
# Login: admin / <printed password>

# Change password
argocd account update-password

# Generate ArgoCD API token for Jenkins
# ArgoCD UI → Settings → Accounts → jenkins → Generate Token
# Copy → paste into Jenkins credential "ARGOCD_TOKEN"
```

### Deploy the ShopZone App to ArgoCD

```bash
# Edit argocd/argocd-app.yaml — change:
#   spec.source.repoURL → your GitHub repo URL
#   spec.source.helm.parameters → your ECR account ID

# Apply
kubectl apply -f argocd/argocd-app.yaml

# Watch sync
kubectl get application shopzone -n argocd -w
```

---

## ⚙️ STEP 7 — Configure Helm values for Production

Edit `helm/shopzone/values.yaml`:

```yaml
global:
  imageRegistry: "123456789.dkr.ecr.ap-south-1.amazonaws.com"  # ← your ECR

ingress:
  host: shopzone.yourdomain.com   # ← your domain

# Also update these after creating RDS
# (create K8s secret separately — don't commit passwords to Git)
```

Create the DB secret in K8s:

```bash
kubectl create namespace shopzone

kubectl create secret generic shopzone-db-secret \
  --namespace shopzone \
  --from-literal=DB_HOST=your-rds.ap-south-1.rds.amazonaws.com \
  --from-literal=DB_PASSWORD=YourStrongPassword123! \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32)
```

---

## 🗄️ STEP 8 — Run Database Migrations

```bash
# Run migrations via a one-off K8s Job
kubectl run migrations \
  --image=123456789.dkr.ecr.ap-south-1.amazonaws.com/shopzone-backend:latest \
  --restart=Never \
  --namespace=shopzone \
  --env-from=secret/shopzone-db-secret \
  --command -- node src/config/migrate.js

# Watch logs
kubectl logs -f migrations -n shopzone

# Promote a user to admin after registering via the UI
kubectl exec -n shopzone deployment/shopzone-backend -- \
  node -e "require('./src/config/db').query(\"UPDATE users SET role='admin' WHERE email='your@email.com'\")"
```

---

## 📊 STEP 9 — Set Up Monitoring (Prometheus + Grafana)

```bash
chmod +x monitoring/install-monitoring.sh
./monitoring/install-monitoring.sh

# Apply ServiceMonitor so Prometheus scrapes the backend /metrics endpoint
kubectl apply -f monitoring/shopzone-servicemonitor.yaml

# Get Grafana URL
kubectl get svc -n monitoring monitoring-grafana
# Login: admin / ShopZone@2024

# Import dashboards in Grafana UI:
#   Dashboard ID 11159 → Node.js Application Dashboard
#   Dashboard ID 6417  → Kubernetes Pod Metrics
#   Upload: monitoring/grafana-dashboard.json (ShopZone custom dashboard)
```

---

## 🔗 STEP 10 — Set Up Jenkins Pipeline

```bash
# In Jenkins UI:
# New Item → Pipeline → Name: shopzone

# Configure:
#   GitHub Project: https://github.com/yourorg/shopzone
#   Build Triggers: GitHub hook trigger for GITScm polling
#   Pipeline: Pipeline script from SCM
#     SCM: Git
#     Repository URL: https://github.com/yourorg/shopzone.git
#     Credentials: github-credentials
#     Branch: */main
#     Script Path: jenkins/Jenkinsfile

# In GitHub:
# Settings → Webhooks → Add webhook
#   Payload URL: http://jenkins.yourdomain.com/jenkins/github-webhook/
#   Content type: application/json
#   Events: Push + Pull Request
```

---

## 🔁 How the Full CI/CD Flow Works

```
git push → GitHub webhook → Jenkins pipeline starts
    │
    ├─ Stage 1: Checkout code
    │
    ├─ Stage 2: npm test (backend + frontend in parallel)
    │
    ├─ Stage 3: SonarQube scan (backend + frontend in parallel)
    │           └─ Quality Gate check — FAILS pipeline if code quality < threshold
    │
    ├─ Stage 4: ECR Login
    │
    ├─ Stage 5: docker build (backend + frontend in parallel)
    │
    ├─ Stage 6: Trivy scan (3 parallel scans)
    │           ├─ Trivy image scan: backend Docker image
    │           ├─ Trivy image scan: frontend Docker image
    │           └─ Trivy fs scan: source + node_modules dependencies
    │           └─ FAILS pipeline if CRITICAL CVEs found in images
    │
    ├─ Stage 7: docker push → ECR (only runs if ALL scans pass)
    │
    ├─ Stage 8: Update helm/shopzone/values.yaml with new image tag → git push
    │
    ├─ Stage 9: Trigger ArgoCD sync via API
    │
    └─ Stage 10: kubectl rollout status → verify pods healthy
```

---

## 💻 LOCAL DEVELOPMENT

```bash
# Start core services only (DB + Backend + Frontend)
docker-compose up -d db backend frontend

# Run migrations (first time)
docker exec shopzone_backend node src/config/migrate.js

# Start with SonarQube for local code quality checks
docker-compose --profile security up -d

# Start with monitoring (Prometheus + Grafana)
docker-compose --profile monitoring up -d

# Start everything
docker-compose --profile security --profile monitoring up -d

# Access points:
# App frontend:  http://localhost:3000
# Backend API:   http://localhost:5000
# SonarQube:     http://localhost:9000   (admin/admin)
# Prometheus:    http://localhost:9090
# Grafana:       http://localhost:3001   (admin/shopzone2024)
```

---

## 🔒 Security Checklist

- [ ] RDS in private subnet (no public access)
- [ ] EKS nodes in private subnet (behind ALB)
- [ ] SG: RDS allows port 5432 from EKS node SG only
- [ ] JWT_SECRET is a strong random 32+ char string
- [ ] DB passwords stored in K8s Secrets, not in Git
- [ ] SonarQube Quality Gate enabled and blocking pipeline
- [ ] Trivy blocking pipeline on CRITICAL CVEs
- [ ] HTTPS enabled via ACM on ALB
- [ ] sonar-project.properties committed, but SONAR_TOKEN in Jenkins credentials only
- [ ] All .env files in .gitignore
- [ ] ECR image scanning enabled (AWS Console → ECR → repo → Scanning)
- [ ] Regular `trivy image` scans of running images scheduled

---

## 🛠️ Useful Commands

```bash
# ── Kubernetes ──────────────────────────────────────────────────────────
kubectl get pods -n shopzone               # List app pods
kubectl logs -f deployment/shopzone-backend -n shopzone   # Backend logs
kubectl exec -it deploy/shopzone-backend -n shopzone -- sh # Shell into pod
kubectl rollout restart deployment/shopzone-backend -n shopzone # Force redeploy

# ── Jenkins ─────────────────────────────────────────────────────────────
kubectl get pods -n jenkins                # Jenkins pod status
kubectl logs -f deployment/jenkins -n jenkins  # Jenkins logs

# ── SonarQube ───────────────────────────────────────────────────────────
kubectl get pods -n sonarqube
kubectl logs -f deployment/sonarqube -n sonarqube

# ── Trivy local scan ─────────────────────────────────────────────────────
trivy image --severity CRITICAL,HIGH shopzone-backend:latest
trivy fs --severity CRITICAL,HIGH ./backend

# ── ArgoCD ──────────────────────────────────────────────────────────────
kubectl get application shopzone -n argocd
argocd app sync shopzone
argocd app history shopzone

# ── Monitoring ──────────────────────────────────────────────────────────
kubectl get pods -n monitoring
kubectl port-forward svc/monitoring-grafana 3001:80 -n monitoring
```

---

## 🔢 All Service URLs Summary

| Service | URL | Default Login |
|---------|-----|---------------|
| ShopZone App | https://shopzone.yourdomain.com | Register via UI |
| Jenkins | http://jenkins.yourdomain.com/jenkins | admin / (initial password from pod) |
| SonarQube | http://sonar.yourdomain.com/sonar | admin / admin (change immediately) |
| ArgoCD | http://argocd.yourdomain.com | admin / (initial from secret) |
| Grafana | http://grafana.yourdomain.com | admin / ShopZone@2024 |
| Prometheus | Internal only (port-forward) | — |

