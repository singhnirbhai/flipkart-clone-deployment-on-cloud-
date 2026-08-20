###############################################################################
#  FLIPKART CLONE - COMPLETE DEPLOYMENT GUIDE
#  Step-by-Step: Prerequisites → Build → Deploy → Monitor → HPA Test
###############################################################################

This file contains EVERY step needed to deploy the Flipkart Clone project
on Kubernetes with Jenkins CI/CD, Monitoring, and HPA auto-scaling.

Read this file LINE BY LINE. Don't skip any step.
###############################################################################


================================================================================
TABLE OF CONTENTS
================================================================================

  PART 1: PREREQUISITES (Software Install)
  PART 2: LOCAL DEVELOPMENT SETUP
  PART 3: DOCKER BUILD & TEST
  PART 4: KUBERNETES CLUSTER SETUP (Minikube / EKS / GKE)
  PART 5: DEPLOY MONITORING (Prometheus + Grafana)
  PART 6: DEPLOY APPLICATION (All Microservices)
  PART 7: CONFIGURE INGRESS
  PART 8: VERIFY DEPLOYMENT
  PART 9: JENKINS SETUP & PIPELINE
  PART 10: HPA DEMONSTRATION (Payment Service Scaling)
  PART 11: ACCESS YOUR WEBSITE
  PART 12: TROUBLESHOOTING


================================================================================
PART 1: PREREQUISITES
================================================================================

Step 1.1 - Install Docker
----------------------------

  # macOS
  brew install --cask docker

  # Ubuntu/Debian
  sudo apt update
  sudo apt install docker.io -y
  sudo usermod -aG docker $USER
  newgrp docker

  # Verify
  docker --version
  docker info


Step 1.2 - Install kubectl
----------------------------

  # macOS
  brew install kubectl

  # Linux
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x kubectl
  sudo mv kubectl /usr/local/bin/

  # Verify
  kubectl version --client


Step 1.3 - Install Minikube (for local)
-----------------------------------------

  # macOS
  brew install minikube

  # Linux
  curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
  sudo install minikube-linux-amd64 /usr/local/bin/minikube

  # Verify
  minikube version


Step 1.4 - Install Jenkins
-----------------------------

  # macOS
  brew install jenkins-lts

  # Linux (Docker method - recommended)
  docker run -d \
    --name jenkins \
    -p 8080:8080 \
    -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home \
    -v /var/run/docker.sock:/var/run/docker.sock \
    jenkins/jenkins:lts

  # Get initial admin password
  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword

  # Install these Jenkins plugins:
  #   - Pipeline
  #   - Docker Pipeline
  #   - Kubernetes
  #   - Git
  #   - Blue Ocean
  #   - Credentials Binding
  #   - Slack Notification (optional)


Step 1.5 - Install Helm (for Prometheus/Grafana)
--------------------------------------------------

  # macOS
  brew install helm

  # Linux
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

  # Verify
  helm version


================================================================================
PART 2: LOCAL DEVELOPMENT SETUP
================================================================================

Step 2.1 - Clone the project
-------------------------------

  cd /path/to/your/workspace
  # Project is already at: flipkart-clone/

  ls flipkart-clone/
  # You should see: frontend/ backend/ k8s/ jenkins/ scripts/ ARCHITECTURE.md


Step 2.2 - Install frontend dependencies
------------------------------------------

  cd flipkart-clone/frontend
  npm install
  npm start

  # Website opens at http://localhost:3000
  # Press Ctrl+C to stop


Step 2.3 - Install backend dependencies (all 5 services)
-----------------------------------------------------------

  cd flipkart-clone/backend

  for service in user-service product-service cart-service payment-service order-service; do
    echo "Installing $service..."
    cd $service
    npm install
    cd ..
  done


Step 2.4 - Test services locally (optional)
----------------------------------------------

  # Terminal 1
  cd backend/user-service && node server.js

  # Terminal 2
  cd backend/product-service && node server.js

  # Terminal 3
  cd backend/payment-service && node server.js

  # Test
  curl http://localhost:3001/api/users/health
  curl http://localhost:3002/api/products/health
  curl http://localhost:3004/api/payments/health


================================================================================
PART 3: DOCKER BUILD & TEST
================================================================================

Step 3.1 - Build all Docker images
--------------------------------------

  cd flipkart-clone

  echo "Building Frontend..."
  docker build -t flipkart/frontend:latest ./frontend

  echo "Building User Service..."
  docker build -t flipkart/user-service:latest ./backend/user-service

  echo "Building Product Service..."
  docker build -t flipkart/product-service:latest ./backend/product-service

  echo "Building Cart Service..."
  docker build -t flipkart/cart-service:latest ./backend/cart-service

  echo "Building Payment Service..."
  docker build -t flipkart/payment-service:latest ./backend/payment-service

  echo "Building Order Service..."
  docker build -t flipkart/order-service:latest ./backend/order-service

  # Verify all images
  docker images | grep flipkart

  # Expected output:
  # flipkart/frontend         latest   xxxx   5 seconds ago
  # flipkart/user-service     latest   xxxx   5 seconds ago
  # flipkart/product-service  latest   xxxx   5 seconds ago
  # flipkart/cart-service     latest   xxxx   5 seconds ago
  # flipkart/payment-service  latest   xxxx   5 seconds ago
  # flipkart/order-service    latest   xxxx   5 seconds ago


Step 3.2 - Test Docker image locally
---------------------------------------

  # Test payment-service
  docker run -d \
    --name test-payment \
    -p 3004:3004 \
    flipkart/payment-service:latest

  curl http://localhost:3004/api/payments/health

  # Expected: {"status":"healthy","service":"payment-service",...}

  # Cleanup
  docker stop test-payment && docker rm test-payment


Step 3.3 - Push to Docker Hub
--------------------------------

  # Login to Docker Hub
  docker login
  # Enter your Docker Hub username and password

  # Set your username
  DOCKER_USER="your-dockerhub-username"

  # Tag and push all images
  for service in frontend user-service product-service cart-service payment-service order-service; do
    docker tag flipkart/$service:latest $DOCKER_USER/flipkart-$service:latest
    docker push $DOCKER_USER/flipkart-$service:latest
    echo "Pushed $service"
  done

  # Verify on Docker Hub website: https://hub.docker.com/u/$DOCKER_USER


================================================================================
PART 4: KUBERNETES CLUSTER SETUP
================================================================================

----- OPTION A: Minikube (Local) -----

Step 4.1A - Start Minikube
------------------------------

  # Start with recommended resources
  minikube start \
    --cpus=4 \
    --memory=8192 \
    --driver=docker

  # Enable required addons
  minikube addons enable ingress
  minikube addons enable metrics-server
  minikube addons enable dashboard

  # Verify cluster
  kubectl cluster-info
  kubectl get nodes

  # Open Minikube dashboard (optional)
  minikube dashboard


----- OPTION B: AWS EKS (Production) -----

Step 4.1B - Create EKS cluster
---------------------------------

  # Install AWS CLI
  curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
  sudo installer -pkg AWSCLIV2.pkg -target /

  # Configure AWS
  aws configure
  # Enter: Access Key, Secret Key, Region (ap-south-1), Output (json)

  # Install eksctl
  brew tap weaveworks/tap
  brew install weaveworks/tap/eksctl

  # Create cluster
  eksctl create cluster \
    --name flipkart-cluster \
    --region ap-south-1 \
    --nodes 3 \
    --node-type t3.medium \
    --with-oidc

  # Update kubeconfig
  aws eks update-kubeconfig --region ap-south-1 --name flipkart-cluster

  # Verify
  kubectl get nodes
  kubectl cluster-info


----- OPTION C: Google GKE (Production) -----

Step 4.1C - Create GKE cluster
---------------------------------

  # Install gcloud CLI
  curl https://sdk.cloud.google.com | bash
  gcloud init

  # Create cluster
  gcloud container clusters create flipkart-cluster \
    --zone asia-south1-a \
    --num-nodes 3 \
    --machine-type e2-standard-4

  # Get credentials
  gcloud container clusters get-credentials flipkart-cluster \
    --zone asia-south1-a

  # Verify
  kubectl get nodes


Step 4.2 - Enable Metrics Server (required for HPA)
-------------------------------------------------------

  # For Minikube (already enabled above)
  # For EKS/GKE, install metrics-server:

  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

  # If using self-signed certs, patch it:
  kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
    {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"},
    {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-preferred-address-types=InternalIP"}
  ]'

  # Wait 2 minutes, then verify
  kubectl top nodes
  kubectl top pods -n kube-system


================================================================================
PART 5: DEPLOY MONITORING (Prometheus + Grafana)
================================================================================

Step 5.1 - Create monitoring namespace
------------------------------------------

  kubectl create namespace monitoring


Step 5.2 - Create RBAC for Prometheus
-----------------------------------------

  # Prometheus needs permission to watch pods across namespaces
  cat <<EOF | kubectl apply -f -
  apiVersion: v1
  kind: ServiceAccount
  metadata:
    name: prometheus
    namespace: monitoring
  ---
  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRole
  metadata:
    name: prometheus
  rules:
    - apiGroups: [""]
      resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
      verbs: ["get", "list", "watch"]
    - apiGroups: ["extensions"]
      resources: ["ingresses"]
      verbs: ["get", "list", "watch"]
    - nonResourceURLs: ["/metrics"]
      verbs: ["get"]
  ---
  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRoleBinding
  metadata:
    name: prometheus
  roleRef:
    apiGroup: rbac.authorization.k8s.io
    kind: ClusterRole
    name: prometheus
  subjects:
    - kind: ServiceAccount
      name: prometheus
      namespace: monitoring
  EOF


Step 5.3 - Deploy Prometheus
-------------------------------

  cd flipkart-clone

  kubectl apply -f k8s/monitoring/prometheus.yaml

  # Wait for pod to be ready
  kubectl wait --for=condition=Ready pod -l app=prometheus -n monitoring --timeout=120s

  # Verify
  kubectl get pods -n monitoring
  kubectl get svc -n monitoring


Step 5.4 - Deploy Grafana
----------------------------

  kubectl apply -f k8s/monitoring/grafana.yaml

  # Wait for pod
  kubectl wait --for=condition=Ready pod -l app=grafana -n monitoring --timeout=120s

  # Verify
  kubectl get pods -n monitoring


Step 5.5 - Access monitoring (Minikube)
------------------------------------------

  # Prometheus
  minikube service prometheus -n monitoring --url
  # Opens at: http://127.0.0.1:XXXXX

  # Grafana
  minikube service grafana -n monitoring --url
  # Login: admin / admin123

  # OR use port-forward (works everywhere)
  kubectl port-forward svc/prometheus 9090:9090 -n monitoring &
  kubectl port-forward svc/grafana 3000:3000 -n monitoring &

  # Open in browser:
  # Prometheus: http://localhost:9090
  # Grafana:    http://localhost:3000


Step 5.6 - Verify Prometheus is scraping services
-----------------------------------------------------

  # Open Prometheus UI
  # Run this query in the query bar:
  up{namespace="flipkart"}

  # You should see all your service pods with value=1 (meaning they're up)

  # Check payment service metrics:
  payment_active_processing


================================================================================
PART 6: DEPLOY APPLICATION (All Microservices)
================================================================================

Step 6.1 - Create flipkart namespace
----------------------------------------

  kubectl apply -f k8s/namespace.yaml

  # Verify
  kubectl get namespace flipkart


Step 6.2 - Deploy MongoDB
-----------------------------

  kubectl apply -f k8s/mongodb.yaml -n flipkart

  # Wait for MongoDB to be ready
  kubectl wait --for=condition=Ready pod -l app=mongodb -n flipkart --timeout=120s

  # Verify
  kubectl get pods -n flipkart


Step 6.3 - Deploy API Gateway (NGINX)
-----------------------------------------

  kubectl apply -f k8s/api-gateway.yaml -n flipkart

  kubectl wait --for=condition=Ready pod -l app=api-gateway -n flipkart --timeout=120s

  # Verify
  kubectl get pods -n flipkart -l app=api-gateway


Step 6.4 - Deploy User Service
---------------------------------

  kubectl apply -f k8s/user-service/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=user-service -n flipkart --timeout=120s


Step 6.5 - Deploy Product Service
------------------------------------

  kubectl apply -f k8s/product-service/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=product-service -n flipkart --timeout=120s


Step 6.6 - Deploy Cart Service
---------------------------------

  kubectl apply -f k8s/cart-service/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=cart-service -n flipkart --timeout=120s


Step 6.7 - Deploy Payment Service (with HPA)
-----------------------------------------------

  kubectl apply -f k8s/payment-service/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=payment-service -n flipkart --timeout=120s


Step 6.8 - Deploy Order Service
-----------------------------------

  kubectl apply -f k8s/order-service/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=order-service -n flipkart --timeout=120s


Step 6.9 - Deploy Frontend
-------------------------------

  kubectl apply -f k8s/frontend/ -n flipkart

  kubectl wait --for=condition=Ready pod -l app=frontend -n flipkart --timeout=120s


Step 6.10 - Verify ALL pods are running
------------------------------------------

  kubectl get pods -n flipkart -o wide

  # Expected output (all pods should be Running):
  # NAME                                READY   STATUS    RESTARTS   AGE
  # api-gateway-xxxxx                   1/1     Running   0          2m
  # cart-service-xxxxx                  1/1     Running   0          2m
  # cart-service-xxxxx                  1/1     Running   0          2m
  # frontend-xxxxx                      1/1     Running   0          1m
  # mongodb-xxxxx                       1/1     Running   0          3m
  # order-service-xxxxx                 1/1     Running   0          1m
  # order-service-xxxxx                 1/1     Running   0          1m
  # payment-service-xxxxx               1/1     Running   0          1m
  # payment-service-xxxxx               1/1     Running   0          1m
  # product-service-xxxxx               1/1     Running   0          2m
  # product-service-xxxxx               1/1     Running   0          2m
  # user-service-xxxxx                  1/1     Running   0          2m
  # user-service-xxxxx                  1/1     Running   0          2m


================================================================================
PART 7: CONFIGURE INGRESS
================================================================================

Step 7.1 - Apply Ingress manifest
-------------------------------------

  kubectl apply -f k8s/ingress.yaml


Step 7.2 - Get Ingress URL
------------------------------

  # Minikube
  minikube addons enable ingress
  minikube ip
  # Use the IP shown (e.g., 192.168.49.2)

  # Add to /etc/hosts (macOS/Linux):
  sudo sh -c 'echo "$(minikube ip) flipkart.local" >> /etc/hosts'

  # EKS/GKE - Get Load Balancer URL
  kubectl get ingress -n flipkart
  # Use the ADDRESS shown

  # For all platforms, also test via port-forward:
  kubectl port-forward svc/api-gateway 3000:3000 -n flipkart &
  # Website accessible at: http://localhost:3000


Step 7.3 - Test Ingress
---------------------------

  # If using /etc/hosts entry
  curl http://flipkart.local/api/products/health

  # Expected: {"status":"healthy","service":"product-service"}

  curl http://flipkart.local/api/payments/health

  # Expected: {"status":"healthy","service":"payment-service",...}


================================================================================
PART 8: VERIFY DEPLOYMENT
================================================================================

Step 8.1 - Check all resources
---------------------------------

  echo "=== Namespaces ==="
  kubectl get ns | grep flipkart

  echo "=== All Pods ==="
  kubectl get pods -n flipkart -o wide

  echo "=== All Services ==="
  kubectl get svc -n flipkart

  echo "=== HPA Status ==="
  kubectl get hpa -n flipkart

  echo "=== Ingress ==="
  kubectl get ingress -n flipkart

  echo "=== Deployment Status ==="
  kubectl get deployments -n flipkart

  echo "=== Replicasets ==="
  kubectl get rs -n flipkart


Step 8.2 - Test each service health endpoint
-----------------------------------------------

  # Port forward API Gateway
  kubectl port-forward svc/api-gateway 3000:3000 -n flipkart &

  # Test each service
  curl http://localhost:3000/health
  curl http://localhost:3000/api/users/health
  curl http://localhost:3000/api/products/health
  curl http://localhost:3000/api/cart/health
  curl http://localhost:3000/api/payments/health
  curl http://localhost:3000/api/orders/health


Step 8.3 - Test payment processing
--------------------------------------

  curl -X POST http://localhost:3000/api/payments/process \
    -H "Content-Type: application/json" \
    -d '{
      "orderId": "ORD001",
      "userId": "user123",
      "amount": 2999,
      "method": "upi",
      "upiId": "user@upi"
    }'

  # Expected: {"success":true,"transactionId":"TXN...","amount":2999,...}


================================================================================
PART 9: JENKINS SETUP & PIPELINE
================================================================================

Step 9.1 - Start Jenkins
----------------------------

  # If using Docker
  docker start jenkins

  # Open Jenkins UI
  # http://localhost:8080

  # Enter initial admin password:
  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword


Step 9.2 - Install required plugins
---------------------------------------

  Manage Jenkins → Plugins → Available Plugins → Install:

  ✓ Pipeline
  ✓ Docker Pipeline
  ✓ Kubernetes
  ✓ Git
  ✓ Blue Ocean
  ✓ Credentials Binding
  ✓ NodeJS (for frontend builds)
  ✓ HTML Publisher (for reports)

  Restart Jenkins after installing plugins.


Step 9.3 - Configure Docker Hub credentials
----------------------------------------------

  Manage Jenkins → Credentials → System → Global → Add Credentials:

  Kind: Username with Password
  Scope: Global
  Username: your-dockerhub-username
  Password: your-dockerhub-password
  ID: docker-hub
  Description: Docker Hub Credentials


Step 9.4 - Configure Kubernetes Cloud (optional but recommended)
-------------------------------------------------------------------

  Manage Jenkins → Manage Clouds → New Cloud → Kubernetes

  Name: flipkart-k8s
  Kubernetes URL: https://kubernetes.default.svc (or your cluster URL)
  Kubernetes Namespace: jenkins

  (For Minikube, get the URL: kubectl cluster-info | grep server)


Step 9.5 - Create Pipeline Job
----------------------------------

  1. Click "New Item"
  2. Enter name: flipkart-deploy
  3. Select: Pipeline
  4. Click OK

  5. In Configuration:
     - Pipeline section:
       - Definition: Pipeline script from SCM
       - SCM: Git
       - Repository URL: your-git-repo-url
       - Branch Specifier: */main
       - Script Path: jenkins/Jenkinsfile

  6. Click Save


Step 9.6 - Run the Pipeline
-------------------------------

  1. Go to flipkart-deploy job
  2. Click "Build Now"
  3. Watch the pipeline execute in Blue Ocean

  Pipeline stages will run:
  ✓ Checkout
  ✓ Build (all 6 services in parallel)
  ✓ Test
  ✓ Security Scan
  ✓ Push to Docker Hub
  ✓ Deploy to Dev
  ✓ Integration Tests
  ✓ Deploy to Production (requires manual approval)
  ✓ Verify Deployment


Step 9.7 - Configure Webhook (Auto-trigger on Git push)
----------------------------------------------------------

  In Jenkins job configuration:
  - Build Triggers → Poll SCM: H/5 * * * * (polls every 5 min)
  - OR use GitHub webhook:
    - Add webhook in GitHub repo: http://your-jenkins-url/github-webhook/
    - Build Triggers → GitHub hook trigger for GITScm polling


================================================================================
PART 10: HPA DEMONSTRATION (Payment Service Scaling)
================================================================================

Step 10.1 - Check initial HPA state
---------------------------------------

  kubectl get hpa payment-service-hpa -n flipkart

  # Expected:
  # NAME                     REFERENCE                     TARGETS    MINPODS   MAXPODS
  # payment-service-hpa      Deployment/payment-service    0%/60%     2         10

  kubectl get pods -n flipkart -l app=payment-service

  # Should show 2 pods (minimum replicas)


Step 10.2 - Generate load to trigger HPA
-------------------------------------------

  # Method 1: Using the demo script
  cd flipkart-clone
  ./scripts/hpa-demo.sh

  # Method 2: Manual load test using a busybox pod
  kubectl run load-generator --image=busybox --restart=Never -n flipkart -- \
    sh -c '
      echo "Starting load test..."
      for round in 1 2 3 4 5 6 7 8; do
        echo "Round $round - Sending 30 concurrent requests..."
        for i in $(seq 1 30); do
          wget -q -O- http://payment-service:3004/api/payments/stress &
        done
        sleep 10
      done
      echo "Load test complete"
    '

  # Method 3: Using curl in a loop (from your terminal)
  for i in $(seq 1 200); do
    curl -s http://localhost:3000/api/payments/stress > /dev/null &
  done


Step 10.3 - Watch HPA scale UP (in a separate terminal)
-----------------------------------------------------------

  # Watch HPA in real-time
  kubectl get hpa payment-service-hpa -n flipkart -w

  # Watch pods scaling
  kubectl get pods -n flipkart -l app=payment-service -w

  # Watch in both simultaneously:
  watch -n 5 "kubectl get hpa,pods -n flipkart -l app=payment-service"

  You will see:
  ┌──────────────────────────────────────────────────────────┐
  │ TIME   │ CPU%    │ REPLICAS │ PODS RUNNING              │
  ├──────────────────────────────────────────────────────────┤
  │ 0:00   │ 5%      │ 2/10     │ payment-xxx, payment-yyy  │
  │ 0:30   │ 45%     │ 2/10     │ payment-xxx, payment-yyy  │
  │ 1:00   │ 80%     │ 4/10     │ +2 new pods created!      │
  │ 1:30   │ 65%     │ 4/10     │ stabilizing               │
  │ 2:00   │ 40%     │ 4/10     │ load reducing             │
  │ 5:00   │ 10%     │ 4/10     │ waiting 300s              │
  │ 8:00   │ 5%      │ 2/10     │ scale down (after 300s)   │
  └──────────────────────────────────────────────────────────┘


Step 10.4 - Check HPA events
--------------------------------

  kubectl describe hpa payment-service-hpa -n flipkart

  # Look at Events section at the bottom
  # You'll see:
  # - "SuccessfulRescale" events
  # - "New size: 4; reason: cpu resource utilization above target"
  # - "New size: 2; reason: All metrics below target"


Step 10.5 - Check custom metrics in Prometheus
--------------------------------------------------

  # Port forward Prometheus
  kubectl port-forward svc/promana 9090:9090 -n monitoring &

  # Open http://localhost:9090

  # Run these queries:
  payment_active_processing
  rate(http_requests_total{job="payment-service"}[5m])
  process_resident_memory_bytes{job="payment-service"} / 1024 / 1024


Step 10.6 - Cleanup load generator pod
-----------------------------------------

  kubectl delete pod load-generator -n flipkart --ignore-not-found


================================================================================
PART 11: ACCESS YOUR WEBSITE
================================================================================

  ┌───────────────────────────────────────────────────────────────────┐
  │  SERVICE         │  URL                                    PORT   │
  ├───────────────────────────────────────────────────────────────────┤
  │  Flipkart Website│  http://flipkart.local                  80    │
  │  API Gateway     │  http://localhost:3000                  3000  │
  │  Prometheus      │  http://localhost:9090                  9090  │
  │  Grafana         │  http://localhost:3000 (separate port)  30030 │
  │  Minikube Dashboard│ minikube dashboard                            │
  └───────────────────────────────────────────────────────────────────┘

  # Port forward commands (run in background):

  # Website via API Gateway
  kubectl port-forward svc/api-gateway 3000:3000 -n flipkart &

  # Prometheus
  kubectl port-forward svc/prometheus 9090:9090 -n monitoring &

  # Grafana
  kubectl port-forward svc/grafana 30030:3000 -n monitoring &

  # Grafana Login
  # Username: admin
  # Password: admin123

  # Pre-built dashboard: "Flipkart Cluster Overview"


================================================================================
PART 12: TROUBLESHOOTING
================================================================================

Problem 1: Pods in CrashLoopBackOff
--------------------------------------

  # Check logs
  kubectl logs <pod-name> -n flipkart

  # Check events
  kubectl describe pod <pod-name> -n flipkart

  # Common fix: MongoDB not ready yet
  kubectl get pods -n flipkart -l app=mongodb
  # Wait for MongoDB to be Running before other services


Problem 2: HPA not scaling
-----------------------------

  # Check if metrics-server is running
  kubectl top nodes
  kubectl top pods -n flipkart

  # If "metrics not available", install metrics-server:
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

  # Check HPA events
  kubectl describe hpa payment-service-hpa -n flipkart

  # Make sure /metrics endpoint is accessible
  kubectl port-forward svc/payment-service 3004:3004 -n flipkart &
  curl http://localhost:3004/metrics


Problem 3: Ingress not working
---------------------------------

  # Check ingress controller is running
  kubectl get pods -n ingress-nginx

  # If not installed:
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

  # Check ingress status
  kubectl describe ingress flipkart-ingress -n flipkart


Problem 4: Services can't connect to MongoDB
----------------------------------------------

  # Check DNS resolution from inside a pod
  kubectl exec -it <any-pod> -n flipkart -- nslookup mongodb

  # Check MongoDB logs
  kubectl logs <mongodb-pod> -n flipkart

  # Test direct connection
  kubectl exec -it <any-pod> -n flipkart -- wget -qO- http://mongodb:27017


Problem 5: Jenkins can't connect to Kubernetes
-------------------------------------------------

  # If using Minikube, mount docker socket:
  docker run -d \
    --name jenkins \
    -p 8080:8080 \
    -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v $(minikube ip):/minikube-host \
    jenkins/jenkins:lts


Problem 6: Port conflicts
----------------------------

  # Check what's using the port
  lsof -i :3000
  lsof -i :9090

  # Kill the process
  kill -9 <PID>


USEFUL DEBUGGING COMMANDS
---------------------------

  # Watch all resources in flipkart namespace
  kubectl get all -n flipkart -w

  # Get detailed info about a service
  kubectl describe svc payment-service -n flipkart

  # Shell into a running pod
  kubectl exec -it <pod-name> -n flipkart -- /bin/sh

  # Check resource usage
  kubectl top pods -n flipkart

  # Get logs for all pods of a deployment
  kubectl logs -l app=payment-service -n flipkart --all-containers

  # Restart a deployment
  kubectl rollout restart deployment/payment-service -n flipkart

  # Rollback a deployment
  kubectl rollout undo deployment/payment-service -n flipkart


CLEANUP COMMANDS
------------------

  # Delete entire flipkart namespace
  kubectl delete namespace flipkart

  # Delete monitoring namespace
  kubectl delete namespace monitoring

  # Delete everything using the script
  cd flipkart-clone
  ./scripts/deploy.sh cleanup

  # Stop Minikube
  minikube stop

  # Delete Minikube cluster
  minikube delete

  # Remove Docker images
  docker images | grep flipkart | awk '{print $3}' | xargs docker rmi -f


================================================================================
END OF DEPLOYMENT GUIDE
================================================================================
