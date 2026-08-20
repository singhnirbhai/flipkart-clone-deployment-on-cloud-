╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║                          FLIPKART CLONE - COMPLETE ARCHITECTURE FLOW                            ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  1. CI/CD PIPELINE FLOW (JENKINS)                                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  Developer Push to Git
          │
          ▼
  ┌─────────────────┐
  │   JENKINS       │
  │   PIPELINE      │
  └────────┬────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 1:       │────▶│  Git Checkout     │
  │  CHECKOUT       │     │  (Pull Code)      │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 2:       │────▶│  Docker Build     │
  │  BUILD          │     │  (All 6 images)   │
  │  (PARALLEL)     │     │  - frontend       │
  └────────┬────────┘     │  - user-service   │
           │              │  - product-service │
           │              │  - cart-service    │
           │              │  - payment-service │
           │              │  - order-service   │
           │              └──────────────────┘
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 3:       │────▶│  Unit Tests       │
  │  TEST           │     │  (npm test)       │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 4:       │────▶│  Trivy Scanner    │
  │  SECURITY SCAN  │     │  (Vuln check)     │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 5:       │────▶│  Docker Hub       │
  │  PUSH           │     │  (Push images)    │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 6:       │────▶│  kubectl apply    │
  │  DEPLOY DEV     │     │  -n flipkart-dev  │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 7:       │────▶│  API Tests        │
  │  INTEGRATION    │     │  (Health checks)  │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 8:       │────▶│  kubectl apply    │
  │  DEPLOY PROD    │     │  -n flipkart      │
  │  (Manual Gate)  │     │  + HPA + Ingress  │
  └────────┬────────┘     └──────────────────┘
           │
  ┌────────▼────────┐     ┌──────────────────┐
  │  STAGE 9:       │────▶│  Verify Pods      │
  │  VERIFY         │     │  HPA Status       │
  └────────┬────────┘     │  Ingress Status   │
           │              └──────────────────┘
           ▼
  ┌─────────────────┐
  │  ✅ DEPLOYED!   │
  └─────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  2. KUBERNETES ARCHITECTURE                                                                     ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

                          ┌─────────────────────┐
                          │     INGRESS          │
                          │  (flipkart.local)    │
                          └──────────┬───────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
                    ▼                │                 │
           ┌────────────────┐       │                 │
           │   FRONTEND     │       │                 │
           │   (React)      │       │                 │
           │   Port: 80     │       │                 │
           └────────────────┘       │                 │
                                    │                 │
                    ┌───────────────▼──────────┐      │
                    │      API GATEWAY         │      │
                    │   (NGINX Load Balancer)  │      │
                    │   Port: 3000             │      │
                    └───────────────┬──────────┘      │
                                    │                 │
            ┌───────────┬───────────┼───────────┬─────┘
            │           │           │           │
            ▼           ▼           ▼           ▼
   ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ USER SERVICE │ │ PRODUCT  │ │ CART     │ │ PAYMENT  │
   │              │ │ SERVICE  │ │ SERVICE  │ │ SERVICE  │
   │ Port: 3001  │ │ Port:3002│ │ Port:3003│ │ Port:3004│
   │ Replicas: 2 │ │ Rep: 2   │ │ Rep: 2   │ │ Rep: 2-10│
   └──────┬───────┘ └────┬─────┘ └────┬─────┘ │ HPA ⚡   │
          │              │            │        └────┬─────┘
          │              │            │             │
          └──────────┬───┘────────────┘             │
                     │                              │
              ┌──────▼──────────────────────────────▼─────┐
              │              MONGODB                       │
              │   (Single instance, multiple databases)   │
              └───────────────────────────────────────────┘

   + ORDER SERVICE (Port: 3005, Replicas: 2) → MongoDB


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  3. HPA (Horizontal Pod Autoscaler) FLOW - PAYMENT SERVICE                                      ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                         HPA SCALING FLOW                                │
  └──────────────────────────────────────────────────────────────────────────┘

  STEP 1: Metrics Collection
  ───────────────────────────
  ┌──────────────┐     /metrics      ┌──────────────────┐
  │ PAYMENT      │ ─────────────────▶ │ PROMETHEUS       │
  │ SERVICE      │   (CPU, Memory,   │ (Scrapes every   │
  │ PODS         │    ActivePayments, │  15 seconds)     │
  │              │    RequestRate)    │                  │
  └──────────────┘                   └────────┬─────────┘
                                              │
  STEP 2: HPA Query                            │
  ─────────────────                            ▼
                                     ┌──────────────────┐
                                     │ HPA CONTROLLER   │
                                     │ (Checks every    │
                                     │  15 seconds)     │
                                     └────────┬─────────┘
                                              │
  STEP 3: Decision                            ▼
  ─────────────────
                                     ┌──────────────────┐
                                     │  THRESHOLD?      │
                                     │                  │
                                     │ CPU > 60%?       │──YES──▶ SCALE UP
                                     │ Memory > 70%?    │         (Add 2 pods)
                                     │ ActivePay > 5?   │
                                     │                  │
                                     │ All below?       │──YES──▶ SCALE DOWN
                                     │                  │         (Remove 1 pod)
                                     └──────────────────┘

  STEP 4: Scaling Details
  ───────────────────────
  ┌─────────────────────────────────────────────────────────────┐
  │  MIN REPLICAS: 2                                           │
  │  MAX REPLICAS: 10                                          │
  │                                                             │
  │  SCALE UP:                                                  │
  │  ─────────                                                  │
  │  • Stabilization Window: 60 seconds                        │
  │  • Policy: Add 2 pods OR 100% (whichever is more)          │
  │  • Checked every: 60 seconds                               │
  │                                                             │
  │  SCALE DOWN:                                                │
  │  ───────────                                                │
  │  • Stabilization Window: 300 seconds (5 min safety)        │
  │  • Policy: Remove 1 pod at a time                          │
  │  • Checked every: 120 seconds                              │
  └─────────────────────────────────────────────────────────────┘

  STEP 5: Custom Metrics for Payment Service
  ───────────────────────────────────────────
  ┌───────────────────────────────────────────────────────┐
  │  METRIC                    │  THRESHOLD  │  ACTION    │
  ├───────────────────────────────────────────────────────┤
  │  CPU Utilization           │  > 60%      │  Scale Up  │
  │  Memory Utilization        │  > 70%      │  Scale Up  │
  │  payment_active_processing │  > 5 pods   │  Scale Up  │
  │  http_requests_total       │  > 100/min  │  Scale Up  │
  └───────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  4. MONITORING ARCHITECTURE                                                                     ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────────────────────────────────────────────────────────┐
  │                      MONITORING STACK                                │
  └──────────────────────────────────────────────────────────────────────┘

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ PAYMENT      │     │ USER         │     │ PRODUCT      │
  │ SERVICE      │     │ SERVICE      │     │ SERVICE      │
  │ /metrics     │     │ /metrics     │     │ /metrics     │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                    │                     │
         │         ┌──────────┼──────────┐          │
         │         │          │          │          │
  ┌──────▼─────────▼──────────▼──────────▼──────────▼───────┐
  │                    PROMETHEUS                            │
  │   Port: 30090 (NodePort)                                │
  │                                                          │
  │   Scrape Targets:                                        │
  │   • All payment-service pods (auto-discovered)          │
  │   • All user-service pods                               │
  │   • All product-service pods                            │
  │   • All cart-service pods                               │
  │   • All order-service pods                              │
  │   • Kubernetes node metrics                             │
  │                                                          │
  │   Alert Rules:                                           │
  │   • HighCPUUsage (payment-service)                      │
  │   • PaymentServiceDown                                  │
  │   • HighMemoryUsage                                     │
  │   • PodRestartLoop                                      │
  │   • NodeNotReady                                        │
  │   • PodPendingTooLong                                   │
  └───────────────────────┬──────────────────────────────────┘
                          │
                          ▼
  ┌──────────────────────────────────────────────────────┐
  │                      GRAFANA                          │
  │   Port: 30030 (NodePort)                             │
  │   Login: admin / admin123                             │
  │                                                       │
  │   Dashboard: "Flipkart Cluster Overview"             │
  │   ┌─────────────────────────────────────────────┐    │
  │   │  Panel 1: Active Payments (per pod)         │    │
  │   │  Panel 2: HTTP Requests/sec by service      │    │
  │   │  Panel 3: CPU Usage (payment-service)       │    │
  │   │  Panel 4: Memory Usage (payment-service)    │    │
  │   │  Panel 5: HPA Current Replicas (stat)       │    │
  │   │  Panel 6: HPA Desired Replicas (stat)       │    │
  │   │  Panel 7: Request Distribution (piechart)   │    │
  │   │  Panel 8: Pod Status Table                  │    │
  │   └─────────────────────────────────────────────┘    │
  └──────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  5. USER FLOW (End-to-End Shopping Experience)                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  1. LOGIN │──▶│ 2. BROWSE│──▶│ 3. CART  │──▶│4.CHECKOUT│──▶│ 5. PAY   │
  │  /register│   │ Products │   │  Add/Remove│  │  Address │   │  UPI/Card│
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
       │               │               │               │               │
       ▼               ▼               ▼               ▼               ▼
  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │User Svc  │    │Product   │    │Cart Svc  │    │Order Svc │    │Payment   │
  │(Register/│    │Svc       │    │(CRUD)    │    │(Create)  │    │Svc       │
  │ Login)   │    │(List/Get)│    │          │    │          │    │(Process) │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  6. NETWORK POLICIES & PORT MAP                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  ┌───────────────────────────────────────────────────────────────┐
  │ SERVICE           │ INTERNAL PORT │ EXTERNAL PORT │ PROTOCOL │
  ├───────────────────────────────────────────────────────────────┤
  │ Frontend          │ 80            │ 80 (Ingress)  │ HTTP     │
  │ API Gateway       │ 3000          │ -             │ HTTP     │
  │ User Service      │ 3001          │ -             │ HTTP     │
  │ Product Service   │ 3002          │ -             │ HTTP     │
  │ Cart Service      │ 3003          │ -             │ HTTP     │
  │ Payment Service   │ 3004          │ -             │ HTTP     │
  │ Order Service     │ 3005          │ -             │ HTTP     │
  │ MongoDB           │ 27017         │ -             │ TCP      │
  │ Prometheus        │ 9090          │ 30090         │ HTTP     │
  │ Grafana           │ 3000          │ 30030         │ HTTP     │
  └───────────────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  7. QUICK START COMMANDS                                                                         ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝

  # Build all Docker images
  docker build -t flipkart/frontend:latest ./frontend
  docker build -t flipkart/user-service:latest ./backend/user-service
  docker build -t flipkart/product-service:latest ./backend/product-service
  docker build -t flipkart/cart-service:latest ./backend/cart-service
  docker build -t flipkart/payment-service:latest ./backend/payment-service
  docker build -t flipkart/order-service:latest ./backend/order-service

  # Deploy everything
  ./scripts/deploy.sh all

  # Check HPA status
  kubectl get hpa -n flipkart -w

  # Watch payment-service pods scale
  kubectl get pods -n flipkart -l app=payment-service -w

  # Run HPA demo
  ./scripts/hpa-demo.sh

  # Access monitoring
  kubectl port-forward svc/prometheus 9090:9090 -n monitoring
  kubectl port-forward svc/grafana 3000:3000 -n monitoring

  # View all resources
  ./scripts/deploy.sh status
