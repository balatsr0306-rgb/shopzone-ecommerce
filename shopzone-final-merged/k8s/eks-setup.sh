#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# ShopZone EKS Cluster Setup — using YOUR existing shopzone-vpc
# VPC:  vpc-016ee8add8c12b1cf  (10.0.0.0/16)
#
# Architecture:
#   EKS Nodes  → Private subnets (ap-south-1a, ap-south-1b)
#   ALB / LB   → Public  subnets (ap-south-1a, ap-south-1b)
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Your VPC details (already discovered) ────────────────────────────────────
CLUSTER_NAME="shopzone-cluster"
REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

VPC_ID="vpc-016ee8add8c12b1cf"

# Public subnets  → ALB will use these
PUB_SUBNET_1A="subnet-0660ebda52b33e398"   # ap-south-1a  10.0.0.0/20
PUB_SUBNET_1B="subnet-062bc75ee246c2230"   # ap-south-1b  10.0.16.0/20

# Private subnets → EKS nodes + pods run here
PRIV_SUBNET_1A="subnet-0e3064b26c89d01b2"  # ap-south-1a  10.0.128.0/20
PRIV_SUBNET_1B="subnet-077f938b983bdadc1"  # ap-south-1b  10.0.144.0/20

echo "============================================================"
echo " ShopZone EKS Setup"
echo " Account : $ACCOUNT_ID"
echo " Region  : $REGION"
echo " VPC     : $VPC_ID"
echo "============================================================"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0 — Fix subnet settings + add required EKS/ALB tags
# (Must be done before eksctl runs, otherwise ALB controller can't find subnets)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[0/5] Tagging subnets and enabling public IP on public subnets..."

# Enable auto-assign public IP on public subnets (required for ALB)
aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_SUBNET_1A \
  --map-public-ip-on-launch
aws ec2 modify-subnet-attribute \
  --subnet-id $PUB_SUBNET_1B \
  --map-public-ip-on-launch

# Tag public subnets — ALB controller discovers subnets by these tags
aws ec2 create-tags --resources $PUB_SUBNET_1A $PUB_SUBNET_1B --tags \
  Key=kubernetes.io/cluster/${CLUSTER_NAME},Value=shared \
  Key=kubernetes.io/role/elb,Value=1

# Tag private subnets — EKS nodes + internal LBs use these
aws ec2 create-tags --resources $PRIV_SUBNET_1A $PRIV_SUBNET_1B --tags \
  Key=kubernetes.io/cluster/${CLUSTER_NAME},Value=shared \
  Key=kubernetes.io/role/internal-elb,Value=1

# Tag the VPC itself
aws ec2 create-tags --resources $VPC_ID --tags \
  Key=kubernetes.io/cluster/${CLUSTER_NAME},Value=shared

echo "✅ Subnet tags applied"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Create EKS Cluster inside your VPC
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[1/5] Creating EKS cluster in your shopzone-vpc..."

eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --version 1.30 \
  --vpc-private-subnets=$PRIV_SUBNET_1A,$PRIV_SUBNET_1B \
  --vpc-public-subnets=$PUB_SUBNET_1A,$PUB_SUBNET_1B \
  --nodegroup-name shopzone-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 2 \
  --nodes-max 5 \
  --node-private-networking \
  --managed \
  --with-oidc \
  --alb-ingress-access \
  --asg-access \
  --external-dns-access \
  --full-ecr-access

# Update kubeconfig
aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME

echo "✅ EKS cluster created"
kubectl get nodes

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — AWS Load Balancer Controller
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[2/5] Installing AWS Load Balancer Controller..."

# Download and create IAM policy
curl -sL https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json \
  -o /tmp/alb-iam-policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file:///tmp/alb-iam-policy.json \
  2>/dev/null || echo "Policy already exists, continuing..."

# Create IAM service account for ALB controller
eksctl create iamserviceaccount \
  --cluster=$CLUSTER_NAME \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --role-name AmazonEKSLoadBalancerControllerRole \
  --attach-policy-arn=arn:aws:iam::${ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=$CLUSTER_NAME \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller \
  --set region=$REGION \
  --set vpcId=$VPC_ID \
  --wait

echo "✅ ALB Controller installed"
kubectl get deployment -n kube-system aws-load-balancer-controller

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — ECR Repositories
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[3/5] Creating ECR repositories..."

aws ecr create-repository --repository-name shopzone-backend  --region $REGION 2>/dev/null || true
aws ecr create-repository --repository-name shopzone-frontend --region $REGION 2>/dev/null || true

ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
echo "✅ ECR ready: $ECR_REGISTRY"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Namespace + Secrets + ConfigMap
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[4/5] Creating shopzone namespace, secrets, configmap..."

kubectl create namespace shopzone --dry-run=client -o yaml | kubectl apply -f -

# DB password secret  (replace YourRDSPassword with your actual RDS password)
kubectl create secret generic shopzone-db-secret \
  --from-literal=DB_PASSWORD=YourRDSPassword \
  -n shopzone \
  --dry-run=client -o yaml | kubectl apply -f -

# JWT secret (auto-generated)
kubectl create secret generic shopzone-app-secret \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  -n shopzone \
  --dry-run=client -o yaml | kubectl apply -f -

# App config
kubectl create configmap shopzone-config \
  --from-literal=FRONTEND_URL=http://placeholder.com \
  -n shopzone \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Namespace and secrets created"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Print summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "✅ EKS SETUP COMPLETE"
echo "============================================================"
echo ""
echo "Cluster : $CLUSTER_NAME"
echo "VPC     : $VPC_ID  (shopzone-vpc)"
echo "Nodes   : $(kubectl get nodes --no-headers | wc -l) running"
echo "ECR     : $ECR_REGISTRY"
echo ""
echo "Next steps:"
echo "  1. Update RDS password in secret:"
echo "     kubectl create secret generic shopzone-db-secret \\"
echo "       --from-literal=DB_PASSWORD=<YOUR_ACTUAL_PASSWORD> \\"
echo "       -n shopzone --dry-run=client -o yaml | kubectl apply -f -"
echo ""
echo "  2. Build & push images to ECR:"
echo "     aws ecr get-login-password --region $REGION | \\"
echo "       docker login --username AWS --password-stdin $ECR_REGISTRY"
echo "     docker build -t $ECR_REGISTRY/shopzone-backend:latest ./backend"
echo "     docker build -t $ECR_REGISTRY/shopzone-frontend:latest ./frontend"
echo "     docker push $ECR_REGISTRY/shopzone-backend:latest"
echo "     docker push $ECR_REGISTRY/shopzone-frontend:latest"
echo ""
echo "  3. Deploy application:"
echo "     kubectl apply -f k8s/backend-deployment.yaml"
echo "     kubectl apply -f k8s/frontend-deployment.yaml"
echo "     kubectl apply -f k8s/ingress.yaml"
echo ""
echo "  4. Install ArgoCD:  ./argocd/install-argocd.sh"
echo "  5. Deploy Jenkins:  kubectl apply -f jenkins/k8s/jenkins-deployment.yaml"
echo "  6. Install Monitoring: ./monitoring/install-monitoring.sh"
echo "============================================================"
