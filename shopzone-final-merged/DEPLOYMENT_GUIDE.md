# ShopZone — Final Deployment Guide
## 10-Step Pipeline with Your shopzone-vpc

**VPC:** vpc-016ee8add8c12b1cf (10.0.0.0/16)
**Region:** ap-south-1

---

## Before You Start

```bash
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGION="ap-south-1"
export ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
```

---

## Step 1 — Create EKS Cluster in Your VPC

Edit `k8s/eks-setup.sh` — fill in 2 values:
- `DB_PASSWORD=YourRDSPassword`  → your actual RDS password (set after Step 2)
- `FRONTEND_URL=https://shopzone.yourdomain.com` → your domain

```bash
chmod +x k8s/eks-setup.sh
./k8s/eks-setup.sh
```

Cluster uses:
- Nodes in private subnets: 10.0.128.0/20, 10.0.144.0/20
- ALB in public subnets:    10.0.0.0/20,   10.0.16.0/20

---

## Step 2 — Create RDS PostgreSQL (AWS Console)

1. RDS → Create → PostgreSQL 15
2. VPC: shopzone-vpc (vpc-016ee8add8c12b1cf)
3. Subnet group: use private subnets (10.0.128/144)
4. Security group: allow port 5432 from EKS node SG
5. DB name: `ecommerce`, User: `postgres`

Then update the secret:
```bash
kubectl create secret generic shopzone-db-secret \
  --from-literal=DB_PASSWORD=YOUR_ACTUAL_PASSWORD \
  -n shopzone --dry-run=client -o yaml | kubectl apply -f -
```

---

## Step 3 — Deploy Jenkins

```bash
kubectl apply -f jenkins/k8s/jenkins-deployment.yaml
kubectl rollout status deployment/jenkins -n jenkins --timeout=180s

# Get admin password
kubectl exec -n jenkins deploy/jenkins -- \
  cat /var/jenkins_home/secrets/initialAdminPassword

# Access (port-forward if no domain yet)
kubectl port-forward svc/jenkins 8080:8080 -n jenkins
```

---

## Step 4 — Deploy SonarQube

```bash
kubectl apply -f sonarqube/k8s/sonarqube-deployment.yaml
kubectl rollout status deployment/sonarqube -n sonarqube --timeout=300s
kubectl port-forward svc/sonarqube 9000:9000 -n sonarqube
# Login: admin / admin → change password → generate token (save it)
```

---

## Step 5 — Build Images & Trivy Scan

```bash
# Login to ECR
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Build
docker build -t $ECR_REGISTRY/shopzone-backend:latest  ./backend
docker build -t $ECR_REGISTRY/shopzone-frontend:latest ./frontend

# Scan before push
trivy image --severity CRITICAL,HIGH $ECR_REGISTRY/shopzone-backend:latest
trivy image --severity CRITICAL,HIGH $ECR_REGISTRY/shopzone-frontend:latest

# Push (only after clean scan)
docker push $ECR_REGISTRY/shopzone-backend:latest
docker push $ECR_REGISTRY/shopzone-frontend:latest
```

---

## Step 6 — Deploy ArgoCD

Edit `argocd/argocd-app.yaml` — update:
- `repoURL:` → your GitHub repo URL
- `value:` → your ECR registry (`ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com`)

```bash
chmod +x argocd/install-argocd.sh
./argocd/install-argocd.sh
# This also applies argocd-app.yaml automatically
```

---

## Step 7 — Configure Helm values.yaml

Edit `helm/shopzone/values.yaml` — update 3 lines:
```yaml
global:
  imageRegistry: "123456789012.dkr.ecr.ap-south-1.amazonaws.com"
ingress:
  host: shopzone.yourdomain.com
postgresql:
  host: "your-rds-endpoint.ap-south-1.rds.amazonaws.com"
```

---

## Step 8 — Run DB Migrations

Edit `k8s/db-migration-job.yaml` — replace ACCOUNT_ID and RDS endpoint:
```bash
kubectl apply -f k8s/db-migration-job.yaml
kubectl logs -f job/shopzone-db-migration -n shopzone
```

---

## Step 9 — Deploy Application & Monitoring

```bash
# Deploy app manually (or let ArgoCD handle it)
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# Get ALB URL
kubectl get ingress -n shopzone

# Install monitoring
chmod +x monitoring/install-monitoring.sh
./monitoring/install-monitoring.sh
kubectl apply -f monitoring/shopzone-servicemonitor.yaml
```

---

## Step 10 — Configure Jenkins Pipeline

```bash
chmod +x jenkins/k8s/jenkins-credentials-setup.sh
./jenkins/k8s/jenkins-credentials-setup.sh
```

Then in Jenkins UI:
- New Item → Pipeline → name: `shopzone`
- Pipeline from SCM → your Git repo → branch: main
- Script Path: `jenkins/Jenkinsfile`
- Build Now

---

## Final File Structure

```
shopzone-final/
├── k8s/
│   ├── eks-setup.sh              ← UPDATED (uses your shopzone-vpc)
│   ├── backend-deployment.yaml   ← NEW
│   ├── frontend-deployment.yaml  ← NEW
│   ├── ingress.yaml              ← NEW (pinned to your public subnets)
│   └── db-migration-job.yaml     ← NEW
├── helm/shopzone/
│   ├── Chart.yaml
│   ├── values.yaml               ← UPDATED (VPC subnet annotations)
│   └── templates/                ← unchanged
├── argocd/
│   ├── argocd-app.yaml           ← UPDATED (improved sync options)
│   └── install-argocd.sh
├── jenkins/
│   ├── Jenkinsfile
│   └── k8s/
│       ├── jenkins-deployment.yaml
│       └── jenkins-credentials-setup.sh  ← NEW
├── sonarqube/k8s/sonarqube-deployment.yaml
├── monitoring/
│   ├── install-monitoring.sh
│   ├── shopzone-servicemonitor.yaml  ← UPDATED (+ PrometheusRules)
│   ├── grafana-dashboard.json
│   └── prometheus-dev.yml
├── trivy/
├── backend/
├── frontend/
├── docker-compose.yml
└── DEPLOYMENT_GUIDE.md           ← NEW
```
