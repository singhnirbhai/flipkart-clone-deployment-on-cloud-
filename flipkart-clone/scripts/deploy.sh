#!/bin/bash
#################################################################
# FLIPKART CLONE - COMPLETE DEPLOYMENT SCRIPT
# 
# Usage:
#   ./deploy.sh dev      - Deploy to development
#   ./deploy.sh prod     - Deploy to production
#   ./deploy.sh monitoring - Deploy monitoring stack
#   ./deploy.sh all      - Deploy everything
#   ./deploy.sh hpa-test - Load test payment service (triggers HPA)
#   ./deploy.sh status   - Show all resources status
#   ./deploy.sh cleanup  - Delete everything
#################################################################

set -e

NAMESPACE_PROD="flipkart"
NAMESPACE_DEV="flipkart-dev"
NAMESPACE_MON="monitoring"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║     FLIPKART CLONE - Kubernetes Deployment          ║"
    echo "║     Microservices + HPA + Monitoring                ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found. Please install kubectl first.${NC}"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Cannot connect to Kubernetes cluster.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}All prerequisites met!${NC}"
}

deploy_monitoring() {
    echo -e "${YELLOW}📊 Deploying monitoring stack (Prometheus + Grafana)...${NC}"
    kubectl create namespace $NAMESPACE_MON --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f k8s/monitoring/prometheus.yaml
    kubectl apply -f k8s/monitoring/grafana.yaml
    
    echo -e "${GREEN}Monitoring deployed:${NC}"
    echo "  Prometheus: http://localhost:30090"
    echo "  Grafana:    http://localhost:30030 (admin/admin123)"
}

deploy_prod() {
    echo -e "${YELLOW}🚀 Deploying to PRODUCTION...${NC}"
    
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/mongodb.yaml -n $NAMESPACE_PROD
    kubectl apply -f k8s/api-gateway.yaml -n $NAMESPACE_PROD
    kubectl apply -f k8s/user-service/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/product-service/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/cart-service/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/payment-service/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/order-service/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/frontend/ -n $NAMESPACE_PROD
    kubectl apply -f k8s/ingress.yaml
    
    echo -e "${GREEN}Production deployment complete!${NC}"
}

deploy_dev() {
    echo -e "${YELLOW}🔧 Deploying to DEVELOPMENT...${NC}"
    
    kubectl create namespace $NAMESPACE_DEV --dry-run=client -o yaml | kubectl apply -f -
    kubectl apply -f k8s/mongodb.yaml -n $NAMESPACE_DEV
    kubectl apply -f k8s/api-gateway.yaml -n $NAMESPACE_DEV
    kubectl apply -f k8s/user-service/ -n $NAMESPACE_DEV
    kubectl apply -f k8s/product-service/ -n $NAMESPACE_DEV
    kubectl apply -f k8s/cart-service/ -n $NAMESPACE_DEV
    kubectl apply -f k8s/payment-service/ -n $NAMESPACE_DEV
    kubectl apply -f k8s/order-service/ -n $NAMESPACE_DEV
    kubectl apply -f k8s/frontend/ -n $NAMESPACE_DEV
    
    echo -e "${GREEN}Development deployment complete!${NC}"
}

hpa_test() {
    echo -e "${YELLOW}🔥 Running HPA load test on payment service...${NC}"
    echo "This will generate CPU load to trigger HPA scaling."
    echo "Watch HPA status: kubectl get hpa -n $NAMESPACE_PROD -w"
    echo ""
    
    # Get payment service pod
    PODS=$(kubectl get pods -n $NAMESPACE_PROD -l app=payment-service -o jsonpath='{.items[*].metadata.name}')
    
    if [ -z "$PODS" ]; then
        echo -e "${RED}No payment-service pods found. Deploy first.${NC}"
        exit 1
    fi
    
    echo "Sending concurrent requests to payment-service..."
    
    # Create a temporary pod to generate load
    kubectl run load-tester --image=busybox --restart=Never -n $NAMESPACE_PROD -- \
        sh -c 'for i in $(seq 1 100); do wget -q -O- http://payment-service:3004/api/payments/stress & done; wait' 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}Load test started!${NC}"
    echo ""
    echo "Monitor HPA scaling:"
    echo "  kubectl get hpa -n $NAMESPACE_PROD -w"
    echo ""
    echo "Watch pods:"
    echo "  kubectl get pods -n $NAMESPACE_PROD -l app=payment-service -w"
    echo ""
    echo "Check metrics:"
    echo "  kubectl port-forward svc/prometheus 9090:9090 -n monitoring"
    echo "  Then open: http://localhost:9090 and query: payment_active_processing"
}

show_status() {
    echo -e "${YELLOW}📋 Current Status:${NC}"
    echo ""
    echo "=== Namespaces ==="
    kubectl get namespaces | grep -E "flipkart|monitoring" || true
    echo ""
    echo "=== Production Pods ==="
    kubectl get pods -n $NAMESPACE_PROD -o wide 2>/dev/null || echo "No production namespace"
    echo ""
    echo "=== HPA Status ==="
    kubectl get hpa -n $NAMESPACE_PROD 2>/dev/null || echo "No HPA configured"
    echo ""
    echo "=== Services ==="
    kubectl get svc -n $NAMESPACE_PROD 2>/dev/null || true
    echo ""
    echo "=== Ingress ==="
    kubectl get ingress -n $NAMESPACE_PROD 2>/dev/null || true
    echo ""
    echo "=== Monitoring Pods ==="
    kubectl get pods -n $NAMESPACE_MON 2>/dev/null || echo "No monitoring namespace"
    echo ""
    echo "=== Node Resources ==="
    kubectl top nodes 2>/dev/null || echo "Metrics server not available"
}

cleanup() {
    echo -e "${RED}⚠️  This will delete ALL Flipkart resources!${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        kubectl delete namespace $NAMESPACE_PROD --ignore-not-found
        kubectl delete namespace $NAMESPACE_DEV --ignore-not-found
        kubectl delete namespace $NAMESPACE_MON --ignore-not-found
        echo -e "${GREEN}All resources cleaned up.${NC}"
    else
        echo "Cleanup cancelled."
    fi
}

# Main
print_header
check_prerequisites

case "$1" in
    dev)
        deploy_dev
        ;;
    prod)
        deploy_prod
        ;;
    monitoring)
        deploy_monitoring
        ;;
    all)
        deploy_monitoring
        deploy_prod
        ;;
    hpa-test)
        hpa_test
        ;;
    status)
        show_status
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo "Usage: $0 {dev|prod|monitoring|all|hpa-test|status|cleanup}"
        echo ""
        echo "  dev         - Deploy to development namespace"
        echo "  prod        - Deploy to production namespace"
        echo "  monitoring  - Deploy Prometheus + Grafana"
        echo "  all         - Deploy monitoring + production"
        echo "  hpa-test    - Load test to trigger HPA scaling"
        echo "  status      - Show deployment status"
        echo "  cleanup     - Delete all resources"
        exit 1
        ;;
esac
