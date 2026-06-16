#!/bin/bash
# Jenkins Credentials Setup — run after Jenkins is deployed
# Creates all 6 credentials the Jenkinsfile needs via REST API
set -e

JENKINS_URL="http://jenkins.yourdomain.com"   # ← change
JENKINS_USER="admin"
JENKINS_PASSWORD=$(kubectl -n jenkins exec deploy/jenkins -- \
  cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || echo 'FILL_IN')

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION="ap-south-1"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
ARGOCD_SERVER=$(kubectl get svc argocd-server -n argocd \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
SONAR_HOST_URL="http://sonarqube.sonarqube.svc.cluster.local:9000/sonar"
SONAR_TOKEN="FILL_IN_FROM_SONARQUBE_UI"   # ← generate in SonarQube UI

create_credential() {
  local id=$1 secret=$2 desc=$3
  curl -sf -X POST "${JENKINS_URL}/credentials/store/system/domain/_/createCredentials" \
    --user "${JENKINS_USER}:${JENKINS_PASSWORD}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "json={
      \"\": \"0\",
      \"credentials\": {
        \"scope\": \"GLOBAL\",
        \"id\": \"${id}\",
        \"secret\": \"${secret}\",
        \"description\": \"${desc}\",
        \"\$class\": \"org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl\"
      }
    }" && echo "✅ Created: ${id}" || echo "⚠️  ${id} may already exist"
}

echo "Creating Jenkins credentials..."
create_credential "ECR_REGISTRY"   "${ECR_REGISTRY}"   "AWS ECR Registry URL"
create_credential "ARGOCD_SERVER"  "${ARGOCD_SERVER}"  "ArgoCD Server hostname"
create_credential "SONAR_HOST_URL" "${SONAR_HOST_URL}" "SonarQube server URL"
create_credential "SONAR_TOKEN"    "${SONAR_TOKEN}"    "SonarQube analysis token"

echo ""
echo "Add manually in Jenkins UI (Manage Jenkins → Credentials):"
echo "  AWS_CREDENTIALS  → Kind: AWS Credentials (Key ID + Secret)"
echo "  ARGOCD_TOKEN     → Kind: Secret text (argocd account generate-token --account admin)"
