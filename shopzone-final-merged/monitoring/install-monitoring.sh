#!/bin/bash
# Install Prometheus + Grafana on EKS using Helm
set -e

echo "📊 Installing Prometheus + Grafana Stack..."

# Add Helm repos
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=ShopZone@2024 \
  --set grafana.service.type=LoadBalancer \
  --set alertmanager.enabled=true \
  --wait

echo ""
echo "✅ Monitoring installed!"
echo ""
echo "Grafana URL:"
kubectl get svc -n monitoring monitoring-grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
echo ""
echo "Grafana login:  admin / ShopZone@2024"
