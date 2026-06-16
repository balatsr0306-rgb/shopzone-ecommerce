#!/bin/bash
# ── Trivy standalone scan script (run locally or from Jenkins) ────────────
set -e

IMAGE_BACKEND="${1:-shopzone-backend:latest}"
IMAGE_FRONTEND="${2:-shopzone-frontend:latest}"
REPORT_DIR="${3:-./trivy-reports}"
SEVERITY="${TRIVY_SEVERITY:-CRITICAL,HIGH}"

mkdir -p "$REPORT_DIR"

echo "🔍 Trivy Security Scan — ShopZone"
echo "   Scanning: $IMAGE_BACKEND and $IMAGE_FRONTEND"
echo "   Severity filter: $SEVERITY"
echo ""

# ── Backend image scan ─────────────────────────────────────────────────────
echo "━━━ Backend Image Scan ━━━"
trivy image \
  --severity "$SEVERITY" \
  --format template \
  --template "@/contrib/html.tpl" \
  --output "$REPORT_DIR/backend-image-report.html" \
  "$IMAGE_BACKEND" || true

trivy image \
  --severity "$SEVERITY" \
  --format json \
  --output "$REPORT_DIR/backend-image-report.json" \
  "$IMAGE_BACKEND" || true

trivy image \
  --severity "$SEVERITY" \
  --exit-code 0 \
  "$IMAGE_BACKEND"

# ── Frontend image scan ────────────────────────────────────────────────────
echo ""
echo "━━━ Frontend Image Scan ━━━"
trivy image \
  --severity "$SEVERITY" \
  --format template \
  --template "@/contrib/html.tpl" \
  --output "$REPORT_DIR/frontend-image-report.html" \
  "$IMAGE_FRONTEND" || true

trivy image \
  --severity "$SEVERITY" \
  --format json \
  --output "$REPORT_DIR/frontend-image-report.json" \
  "$IMAGE_FRONTEND" || true

trivy image \
  --severity "$SEVERITY" \
  --exit-code 0 \
  "$IMAGE_FRONTEND"

# ── Filesystem scan (source code / dependencies) ──────────────────────────
echo ""
echo "━━━ Filesystem / Dependency Scan ━━━"
trivy fs \
  --severity "$SEVERITY" \
  --format json \
  --output "$REPORT_DIR/fs-scan.json" \
  . || true

trivy fs --severity "$SEVERITY" . || true

echo ""
echo "✅ Trivy scans complete. Reports saved to: $REPORT_DIR/"
ls -lh "$REPORT_DIR/"
