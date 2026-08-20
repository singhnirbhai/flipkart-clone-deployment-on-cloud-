###############################################################################
#  FLIPKART CLONE - CLOUD DEPLOYMENT GUIDE
#  AWS EKS + GCP GKE + Jenkins CI/CD + HPA + Monitoring
#  Har step ka exact command hai - copy-paste karo, kaam ho jayega
###############################################################################


================================================================================
PART 0: PROJECT FILE STRUCTURE (Recap)
================================================================================

  flipkart-clone/
  ├── frontend/           → React website
  ├── backend/
  │   ├── user-service/   → Port 3001
  │   ├── product-service/→ Port 3002
  │   ├── cart-service/   → Port 3003
  │   ├── payment-service/→ Port 3004 (HPA ENABLED)
  │   └── order-service/  → Port 3005
  ├── k8s/                → Kubernetes manifests
  ├── jenkins/            → Jenkinsfile
  ├── scripts/            → Deploy scripts
  └── cloud/              → Cloud-specific configs (WE WILL CREATE THIS)


================================================================================
PART 1: TOOLS INSTALLATION (Mac / Linux)
================================================================================

Step 1.1 - Install AWS CLI
------------------------------

  # macOS
  curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
  sudo installer -pkg AWSCLIV2.pkg -target /

  # Linux
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip awscliv2.zip
  sudo ./aws/install

  # Verify
  aws --version


Step 1.2 - Configure AWS Credentials
----------------------------------------

  aws configure

  # It will ask:
  # AWS Access Key ID:     → AKIA... (AWS Console se lo)
  # AWS Secret Access Key: → wJal... (AWS Console se lo)
  # Default region name:   → ap-south-1 (Mumbai)
  # Default output format: → json

  # Verify
  aws sts get-caller-identity

  ## Expected:
  ##{
  ##  "UserId": "AIDA...",
  ##   "Account": "123456789012",
  ##   "Arn": "arn:aws:iam::123456789012:user/yourname"
  ##}


Step 1.3 - Install eksctl
-----------------------------

  # macOS
  brew tap weaveworks/tap
  brew install weaveworks/tap/eksctl

  # Linux
  curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
  sudo mv /tmp/eksctl /usr/local/bin

  # Verify
  eksctl version


Step 1.4 - Install kubectl
-------------------------------

  # macOS
  brew install kubectl

  # Linux
  curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
  chmod +x kubectl && sudo mv kubectl /usr/local/bin/

  # Verify
  kubectl version --client


Step 1.5 - Install Docker
-----------------------------

  # macOS
  brew install --cask docker

  # Linux
  sudo apt update && sudo apt install docker.io -y
  sudo usermod -aG docker $USER && newgrp docker

  # Verify
  docker --version


Step 1.6 - Install Helm
---------------------------

  # macOS
  brew install helm

  # Linux
  curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

  # Verify
  helm version


Step 1.7 - Install Jenkins
------------------------------

  docker run -d \
    --name jenkins \
    -p 8080:8080 \
    -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home \
    -v /var/run/docker.sock:/var/run/docker.sock \
    jenkins/jenkins:lts

  # Get password
  docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword

  # Open: http://localhost:8080


================================================================================
PART 2: AWS IAM SETUP (Security - Very Important)
================================================================================

Step 2.1 - Create IAM User for EKS
--------------------------------------

  # Create IAM policy for EKS admin
  cat <<'EOF' > eks-admin-policy.json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "eks:*",
          "ec2:*",
          "iam:ListRoles",
          "iam:PassRole",
          "ec2:Describe*",
          "ec2:CreateTags",
          "ec2:CreateSecurityGroup",
          "ec2:AuthorizeSecurityGroupIngress",
          "ec2:RevokeSecurityGroupIngress",
          "ec2:DeleteSecurityGroup"
        ],
        "Resource": "*"
      }
    ]
  }
  EOF

  aws iam create-policy \
    --policy-name EksAdminPolicy \
    --policy-document file://eks-admin-policy.json

  # Create IAM user
  aws iam create-user --user-name flipkart-eks-admin

  # Attach policy to user
  aws iam attach-user-policy \
    --user-name flipkart-eks-admin \
    --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/EksAdminPolicy

  # Create access key for this user
  aws iam create-access-key --user-name flipkart-eks-admin

  # SAVE the AccessKeyId and SecretAccessKey shown above
  # Then configure AWS CLI with these keys:
  aws configure --profile flipkart

  # Verify
  aws sts get-caller-identity --profile flipkart


Step 2.2 - Create EKS Cluster Role
--------------------------------------

  cat <<'EOF' > trust-policy.json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "eks.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF

  # Create role
  aws iam create-role \
    --role-name EksClusterRole \
    --assume-role-policy-document file://trust-policy.json

  # Attach AmazonEKSClusterPolicy
  aws iam attach-role-policy \
    --role-name EksClusterRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

  # Attach AmazonEKSServicePolicy
  aws iam attach-role-policy \
    --role-name EksClusterRole \
    --policy-arn arn:aws:iam::aws:policy/AmazonEKSServicePolicy


Step 2.3 - Create Node Group Role
-------------------------------------

  cat <<'EOF' > node-trust-policy.json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "ec2.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }
  EOF

  aws iam create-role \
    --role-name EksNodeRole \
    --assume-role-policy-document file://node-trust-policy.json

  # Attach policies
  aws iam attach-role-policy --role-name EksNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
  aws iam attach-role-policy --role-name EksNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
  aws iam attach-role-policy --role-name EksNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
  aws iam attach-role-policy --role-name EksNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore


================================================================================
PART 3: CREATE AWS EKS CLUSTER
================================================================================

Step 3.1 - Create EKS Cluster (Recommended Config)
-----------------------------------------------------

  eksctl create cluster \
    --name flipkart-cluster \
    --region ap-south-1 \
    --version 1.28 \
    --nodegroup-name flipkart-nodes \
    --node-type t3.medium \
    --nodes 3 \
    --nodes-min 2 \
    --nodes-max 5 \
    --managed

  # This takes 10-15 minutes
  # It creates:
  #   - VPC with public/private subnets
  #   - EKS control plane
  #   - 3 worker nodes (t3.medium)
  #   - Security groups
  #   - Updates kubeconfig

  # Verify
  eksctl get cluster --name flipkart-cluster --region ap-south-1
  kubectl get nodes

  # Expected:
  # NAME                          STATUS   ROLES    AGE   VERSION
  # ip-10-0-1-xxx.ec2.internal    Ready    <none>   5m    v1.28.x
  # ip-10-0-2-xxx.ec2.internal    Ready    <none>   5m    v1.28.x
  # ip-10-0-3-xxx.ec2.internal    Ready    <none>   5m    v1.28.x


Step 3.2 - Verify kubeconfig was updated
-------------------------------------------

  cat ~/.kube/config | grep "flipkart-cluster"

  # If not updated, run:
  aws eks update-kubeconfig --name flipkart-cluster --region ap-south-1


Step 3.3 - Enable EBS Volumes (for MongoDB persistent storage)
-------------------------------------------------------------------

  # Install EBS CSI Driver
  eksctl create addon \
    --name aws-ebs-csi-driver \
    --cluster flipkart-cluster \
    --region ap-south-1 \
    --force


Step 3.4 - Install Metrics Server (required for HPA)
--------------------------------------------------------

  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

  # For EKS, patch metrics-server to skip kubelet TLS verification
  kubectl patch deployment metrics-server -n kube-system --type='json' -p='[
    {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"},
    {"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-preferred-address-types=InternalIP"}
  ]'

  # Wait 60 seconds, then verify
  kubectl top nodes
  kubectl top pods -n kube-system

  # If "metrics not available yet", wait 2-3 minutes and retry


================================================================================
PART 4: AWS EC2 INSTANCE FOR JENKINS
================================================================================

Step 4.1 - Create EC2 Instance for Jenkins
----------------------------------------------

  # Using AWS CLI
  aws ec2 run-instances \
    --image-id ami-0dee22c13ea7a9a67 \
    --instance-type t3.medium \
    --key-name your-key-pair-name \
    --security-group-ids sg-xxxxxxxx \
    --subnet-id subnet-xxxxxxxx \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=flipkart-jenkins}]' \
    --user-data '#!/bin/bash
      yum update -y
      yum install docker -y
      systemctl start docker
      systemctl enable docker
      usermod -aG docker ec2-user
      docker run -d --name jenkins -p 8080:8080 -p 50000:50000 -v jenkins_home:/var/jenkins_home -v /var/run/docker.sock:/var/run/docker.sock jenkins/jenkins:lts
    '

  # OR manually:
  # 1. Go to AWS Console → EC2 → Launch Instance
  # 2. Name: flipkart-jenkins
  # 3. AMI: Amazon Linux 2023
  # 4. Instance: t3.medium
  # 5. Key Pair: Create new or select existing
  # 6. Security Group: Allow ports 22, 8080, 50000
  # 7. User Data: paste the above script


Step 4.2 - SSH into Jenkins EC2
-----------------------------------

  # Set key permissions
  chmod 400 your-key-pair.pem

  # SSH
  ssh -i your-key-pair.pem ec2-user@<EC2-PUBLIC-IP>

  # Check Jenkins
  docker ps
  # Jenkins should be running on port 8080


Step 4.3 - Security Group Rules
-----------------------------------

  # Open these ports in EC2 Security Group:
  #   Port 22    - SSH (your IP only)
  #   Port 8080  - Jenkins UI (your IP only)
  #   Port 50000 - Jenkins Agent (internal only)

  # Add to security group:
  aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxxxxx \
    --protocol tcp \
    --port 8080 \
    --cidr YOUR_IP/32


Step 4.4 - Install tools on Jenkins EC2
-------------------------------------------

  ssh -i your-key-pair.pem ec2-user@<EC2-PUBLIC-IP>

  # Install kubectl
  curl -LO "https://dl.k8s.io/release/v1.28.0/bin/linux/amd64/kubectl"
  chmod +x kubectl && sudo mv kubectl /usr/local/bin/

  # Install aws cli
  curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
  unzip awscliv2.zip
  sudo ./aws/install

  # Install eksctl
  curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | tar xz -C /tmp
  sudo mv /tmp/eksctl /usr/local/bin

  # Configure AWS inside Jenkins container
  docker exec -u root jenkins bash -c "
    yum install -y unzip
    curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip'
    unzip awscliv2.zip
    ./aws/install
  "

  # Configure kubeconfig for Jenkins
  docker exec -u root jenkins bash -c "
    mkdir -p /var/jenkins_home/.aws
    mkdir -p /var/jenkins_home/.kube
  "

  # Copy kubeconfig and aws credentials from host to Jenkins container
  docker cp ~/.kube/config jenkins:/var/jenkins_home/.kube/config
  docker cp ~/.aws/credentials jenkins:/var/jenkins_home/.aws/credentials

  # Set correct permissions
  docker exec -u root jenkins bash -c "
    chown -R jenkins:jenkins /var/jenkins_home/.aws
    chown -R jenkins:jenkins /var/jenkins_home/.kube
    chmod 600 /var/jenkins_home/.kube/config
  "


================================================================================
PART 5: DOCKER HUB SETUP
================================================================================

Step 5.1 - Create Docker Hub Account & Repository
-----------------------------------------------------

  # Go to https://hub.docker.com and create account

  # Create repositories (do this on website or CLI):
  docker login

  docker tag flipkart/frontend:latest YOUR_DOCKERHUB_USER/flipkart-frontend:latest
  docker tag flipkart/user-service:latest YOUR_DOCKERHUB_USER/flipkart-user-service:latest
  docker tag flipkart/product-service:latest YOUR_DOCKERHUB_USER/flipkart-product-service:latest
  docker tag flipkart/cart-service:latest YOUR_DOCKERHUB_USER/flipkart-cart-service:latest
  docker tag flipkart/payment-service:latest YOUR_DOCKERHUB_USER/flipkart-payment-service:latest
  docker tag flipkart/order-service:latest YOUR_DOCKERHUB_USER/flipkart-order-service:latest

  # Push
  docker push YOUR_DOCKERHUB_USER/flipkart-frontend:latest
  docker push YOUR_DOCKERHUB_USER/flipkart-user-service:latest
  docker push YOUR_DOCKERHUB_USER/flipkart-product-service:latest
  docker push YOUR_DOCKERHUB_USER/flipkart-cart-service:latest
  docker push YOUR_DOCKERHUB_USER/flipkart-payment-service:latest
  docker push YOUR_DOCKERHUB_USER/flipkart-order-service:latest


================================================================================
PART 6: CLOUD-SPECIFIC KUBERNETES MANIFESTS
================================================================================

Step 6.1 - Create cloud-specific namespace with resource quotas
-------------------------------------------------------------------

  cat <<'EOF' | kubectl apply -f -
  apiVersion: v1
  kind: Namespace
  metadata:
    name: flipkart
    labels:
      app: flipkart
      environment: production
  ---
  apiVersion: v1
  kind: ResourceQuota
  metadata:
    name: flipkart-quota
    namespace: flipkart
  spec:
    hard:
      requests.cpu: "10"
      requests.memory: 20Gi
      limits.cpu: "20"
      limits.memory: 40Gi
      pods: "50"
      services: "20"
      persistentvolumeclaims: "10"
  ---
  apiVersion: v1
  kind: LimitRange
  metadata:
    name: flipkart-limit-range
    namespace: flipkart
  spec:
    limits:
      - default:
          cpu: "500m"
          memory: "512Mi"
        defaultRequest:
          cpu: "100m"
          memory: "128Mi"
        type: Container
  EOF


Step 6.2 - Create AWS EBS StorageClass for MongoDB
-----------------------------------------------------

  cat <<'EOF' | kubectl apply -f -
  apiVersion: storage.k8s.io/v1
  kind: StorageClass
  metadata:
    name: ebs-sc
    annotations:
      storageclass.kubernetes.io/is-default-class: "true"
  provisioner: ebs.csi.aws.com
  volumeBindingMode: WaitForFirstConsumer
  parameters:
    type: gp3
    encrypted: "true"
  allowVolumeExpansion: true
  ---
  apiVersion: v1
  kind: PersistentVolumeClaim
  metadata:
    name: mongodb-pvc
    namespace: flipkart
  spec:
    accessModes:
      - ReadWriteOnce
    storageClassName: ebs-sc
    resources:
      requests:
        storage: 20Gi
  EOF


Step 6.3 - Update MongoDB deployment with PVC
-----------------------------------------------

  cat <<'EOF' | kubectl apply -f -
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: mongodb
    namespace: flipkart
    labels:
      app: mongodb
  spec:
    replicas: 1
    selector:
      matchLabels:
        app: mongodb
    template:
      metadata:
        labels:
          app: mongodb
      spec:
        containers:
          - name: mongodb
            image: mongo:7
            ports:
              - containerPort: 27017
            resources:
              requests:
                memory: "512Mi"
                cpu: "250m"
              limits:
                memory: "1Gi"
                cpu: "1000m"
            volumeMounts:
              - name: mongo-data
                mountPath: /data/db
        volumes:
          - name: mongo-data
            persistentVolumeClaim:
              claimName: mongodb-pvc
  ---
  apiVersion: v1
  kind: Service
  metadata:
    name: mongodb
    namespace: flipkart
  spec:
    selector:
      app: mongodb
    ports:
      - port: 27017
        targetPort: 27017
  EOF


Step 6.4 - Create AWS ALB Ingress (instead of NGINX)
---------------------------------------------------------

  # First install AWS Load Balancer Controller
  # Create IAM policy
  curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json

  aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json

  # Create service account
  eksctl create iamserviceaccount \
    --cluster=flipkart-cluster \
    --namespace=kube-system \
    --name=aws-load-balancer-controller \
    --role-name AmazonEKSLoadBalancerControllerRole \
    --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
    --approve

  # Install controller using Helm
  helm repo add eks https://aws.github.io/eks-charts
  helm repo update

  helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=flipkart-cluster \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --set region=ap-south-1 \
    --set vpcId=$(aws eks describe-cluster --name flipkart-cluster --region ap-south-1 --query "cluster.resourcesVpcConfig.vpcId" --output text)

  # Verify
  kubectl get deployment -n kube-system aws-load-balancer-controller


Step 6.5 - Update Ingress for AWS ALB
-----------------------------------------

  cat <<'EOF' | kubectl apply -f -
  apiVersion: networking.k8s.io/v1
  kind: Ingress
  metadata:
    name: flipkart-ingress
    namespace: flipkart
    annotations:
      kubernetes.io/ingress.class: alb
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/healthcheck-path: /health
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}]'
      alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-south-1:ACCOUNT_ID:certificate/CERT_ID
  spec:
    rules:
      - http:
          paths:
            - path: /
              pathType: Prefix
              backend:
                service:
                  name: frontend
                  port:
                    number: 80
            - path: /api
              pathType: Prefix
              backend:
                service:
                  name: api-gateway
                  port:
                    number: 3000
  EOF

  # Get the ALB URL
  kubectl get ingress -n flipkart

  # Look for ADDRESS column - it will show the ALB DNS name
  # Example: k8s-flipkart-abc123.us-east-1.elb.amazonaws.com
  # Open that URL in browser - your Flipkart website is LIVE!


================================================================================
PART 7: DEPLOY ALL SERVICES TO AWS EKS
================================================================================

Step 7.1 - Create all resources at once
------------------------------------------

  cd flipkart-clone

  # Create namespace
  kubectl apply -f k8s/namespace.yaml

  # Deploy MongoDB
  kubectl apply -f k8s/mongodb.yaml -n flipkart

  # Wait for MongoDB
  kubectl wait --for=condition=Ready pod -l app=mongodb -n flipkart --timeout=180s

  # Deploy all services
  kubectl apply -f k8s/api-gateway.yaml -n flipkart
  kubectl apply -f k8s/user-service/ -n flipkart
  kubectl apply -f k8s/product-service/ -n flipkart
  kubectl apply -f k8s/cart-service/ -n flipkart
  kubectl apply -f k8s/payment-service/ -n flipkart
  kubectl apply -f k8s/order-service/ -n flipkart
  kubectl apply -f k8s/frontend/ -n flipkart

  # Deploy Ingress
  kubectl apply -f k8s/ingress.yaml

  # Deploy Monitoring
  kubectl create namespace monitoring
  kubectl apply -f k8s/monitoring/prometheus.yaml
  kubectl apply -f k8s/monitoring/grafana.yaml

  # Wait for all pods
  kubectl wait --for=condition=Ready pod --all -n flipkart --timeout=300s

  # Verify
  kubectl get all -n flipkart
  kubectl get hpa -n flipkart
  kubectl get ingress -n flipkart


Step 7.2 - Deploy using the script (easier)
----------------------------------------------

  cd flipkart-clone
  chmod +x scripts/deploy.sh
  ./scripts/deploy.sh all


================================================================================
PART 8: ACCESS YOUR WEBSITE ON CLOUD
================================================================================

Step 8.1 - Get Frontend URL
-------------------------------

  # If using ALB Ingress
  kubectl get ingress -n flipkart
  # Copy the ADDRESS (ALB DNS name) and open in browser
  # Example: http://k8s-flipkart-abc123.ap-south-1.elb.amazonaws.com

  # If using NGINX Ingress + LoadBalancer
  kubectl get svc -n ingress-nginx ingress-nginx-controller
  # Copy the EXTERNAL-IP and open: http://<EXTERNAL-IP>


Step 8.2 - Access Monitoring Dashboard
-----------------------------------------

  # Grafana - Port forward
  kubectl port-forward svc/grafana 30030:3000 -n monitoring &

  # Open: http://localhost:30030
  # Login: admin / admin123
  # Dashboard: "Flipkart Cluster Overview" (auto-loaded)

  # Prometheus - Port forward
  kubectl port-forward svc/prometheus 9090:9090 -n monitoring &

  # Open: http://localhost:9090


Step 8.3 - Optional: Expose Grafana publicly (for team access)
------------------------------------------------------------------

  cat <<EOF | kubectl apply -f -
  apiVersion: v1
  kind: Service
  metadata:
    name: grafana-public
    namespace: monitoring
    annotations:
      service.beta.kubernetes.io/aws-load-balancer-type: nlb
  spec:
    type: LoadBalancer
    selector:
      app: grafana
    ports:
      - port: 80
        targetPort: 3000
  EOF

  # Get public URL
  kubectl get svc grafana-public -n monitoring
  # Open the EXTERNAL-IP in browser


================================================================================
PART 9: JENKINS PIPELINE FOR CLOUD DEPLOYMENT
================================================================================

Step 9.1 - Jenkins Plugins
-------------------------------

  Install these plugins (Manage Jenkins → Plugins):
  ✓ Pipeline
  ✓ Docker Pipeline
  ✓ Kubernetes
  ✓ Git
  ✓ Blue Ocean
  ✓ Credentials Binding
  ✓ NodeJS
  ✓ AWS Credentials
  ✓ Amazon ECR


Step 9.2 - Jenkins Credentials
---------------------------------

  # 1. Docker Hub credentials
  Manage Jenkins → Credentials → Global → Add Credentials
  Kind: Username with Password
  ID: docker-hub
  Username: your-dockerhub-username
  Password: your-dockerhub-password

  # 2. AWS credentials
  Manage Jenkins → Credentials → Global → Add Credentials
  Kind: AWS Credentials
  ID: aws-cloud
  Access Key ID: your-aws-access-key
  Secret Access Key: your-aws-secret-key


Step 9.3 - Create Pipeline Job
----------------------------------

  1. New Item → Name: flipkart-cloud-deploy → Pipeline → OK
  2. Configuration:
     - Pipeline → Definition: Pipeline script from SCM
     - SCM: Git
     - Repository URL: https://github.com/YOUR_USER/flipkart-clone.git
     - Branch: */main
     - Script Path: jenkins/Jenkinsfile
  3. Save → Build Now


================================================================================
PART 10: FULL JENKINSFILE FOR CLOUD
================================================================================

  # Replace the existing Jenkinsfile with this cloud version:

  See: jenkins/Jenkinsfile (already created in project)
  It already handles cloud deployment.

  For cloud-specific changes, update these env vars in Jenkinsfile:

  environment {
      DOCKER_REGISTRY = 'docker.io'
      DOCKER_NAMESPACE = 'your-dockerhub-username'   ← CHANGE THIS
      K8S_NAMESPACE = 'flipkart'
      AWS_REGION = 'ap-south-1'                       ← CHANGE IF NEEDED
      EKS_CLUSTER = 'flipkart-cluster'                ← CHANGE IF NEEDED
  }


================================================================================
PART 11: HPA TESTING ON CLOUD
================================================================================

Step 11.1 - Check initial state
-----------------------------------

  kubectl get hpa payment-service-hpa -n flipkart

  kubectl get pods -n flipkart -l app=payment-service


Step 11.2 - Generate load
-----------------------------

  # Create load generator pod
  kubectl run load-generator --image=busybox --restart=Never -n flipkart -- \
    sh -c '
      echo "Cloud load test starting..."
      for round in 1 2 3 4 5 6 7 8 9 10; do
        echo "Round $round..."
        for i in $(seq 1 50); do
          wget -q -O- http://payment-service:3004/api/payments/stress &
        done
        sleep 15
      done
      echo "Load test done"
    '


Step 11.3 - Watch scaling (from another terminal)
-----------------------------------------------------

  # Terminal 1 - Watch HPA
  kubectl get hpa payment-service-hpa -n flipkart -w

  # Terminal 2 - Watch pods
  kubectl get pods -n flipkart -l app=payment-service -w

  # Terminal 3 - Watch top
  while true; do
    clear
    echo "=== HPA Status ==="
    kubectl get hpa -n flipkart
    echo ""
    echo "=== Pod Resource Usage ==="
    kubectl top pods -n flipkart -l app=payment-service 2>/dev/null
    echo ""
    echo "=== Pod Count ==="
    kubectl get pods -n flipkart -l app=payment-service --no-headers | wc -l
    sleep 10
  done


Step 11.4 - Verify scaling behavior
---------------------------------------

  You should see:

  TIME   | CPU%  | REPLICAS | EVENT
  -------|-------|----------|----------------------------------
  0:00   | 3%    | 2/10     | Starting
  0:30   | 55%   | 2/10     | CPU approaching threshold
  1:00   | 85%   | 4/10     | HPA scaled up (CPU > 60%)
  1:30   | 60%   | 4/10     | Stabilizing
  2:00   | 40%   | 4/10     | Load reducing
  7:00   | 8%    | 2/10     | HPA scaled down (after 300s cooldown)


================================================================================
PART 12: COST ESTIMATION (AWS)
================================================================================

  ┌──────────────────────────────────────────────────────────────────────┐
  │  RESOURCE              │  INSTANCE/TIER    │  MONTHLY COST (USD)   │
  ├──────────────────────────────────────────────────────────────────────┤
  │  EKS Control Plane     │  Managed          │  ~$73                 │
  │  Worker Nodes (x3)     │  t3.medium        │  ~$100 (3 x $33)     │
  │  EBS Storage (20GB)    │  gp3              │  ~$2                  │
  │  ALB Load Balancer     │  Application LB   │  ~$22                 │
  │  EC2 (Jenkins)         │  t3.medium        │  ~$33                 │
  │  Data Transfer         │  ~100GB           │  ~$9                  │
  ├──────────────────────────────────────────────────────────────────────┤
  │  TOTAL (approx)                           │  ~$239/month          │
  ├──────────────────────────────────────────────────────────────────────┤
  │  For FREE tier / testing:                                       │
  │  - Use t3.micro nodes (free tier eligible)                       │
  │  - Use CloudFront free tier                                      │
  │  - Estimated: ~$50-80/month for testing                          │
  ├──────────────────────────────────────────────────────────────────────┤
  │  CLEANUP: Delete cluster when not using:                         │
  │  eksctl delete cluster --name flipkart-cluster --region ap-south-1│
  └──────────────────────────────────────────────────────────────────────┘


================================================================================
PART 13: COST CLEANUP (Very Important - Save Money!)
================================================================================

Step 13.1 - Delete EKS cluster (stops all charges)
-----------------------------------------------------

  eksctl delete cluster --name flipkart-cluster --region ap-south-1

  # This deletes:
  #   - EKS control plane
  #   - All worker nodes
  #   - All EBS volumes
  #   - Load balancers
  #   - Security groups

  # Verify deletion
  eksctl get cluster --name flipkart-cluster --region ap-south-1
  # Should show "Error: cluster not found"


Step 13.2 - Delete Jenkins EC2
---------------------------------

  aws ec2 terminate-instances --instance-ids <JENKINS-EC2-ID>

  # Or from AWS Console: EC2 → Instances → Select → Instance State → Terminate


Step 13.3 - Delete IAM resources
-----------------------------------

  aws iam detach-user-policy --user-name flipkart-eks-admin --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/EksAdminPolicy
  aws iam delete-user --user-name flipkart-eks-admin
  aws iam delete-policy --policy-arn arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/EksAdminPolicy


================================================================================
PART 14: COMPLETE QUICK-START CHEAT SHEET
================================================================================

  # ===== SETUP (do once) =====
  eksctl create cluster --name flipkart-cluster --region ap-south-1 --node-type t3.medium --nodes 3 --managed
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"},{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-preferred-address-types=InternalIP"}]'

  # ===== DEPLOY (every code change) =====
  cd flipkart-clone

  # Build images
  docker build -t YOUR_USER/flipkart-frontend:latest ./frontend
  docker build -t YOUR_USER/flipkart-payment-service:latest ./backend/payment-service
  # ... (build all 6)

  # Push to Docker Hub
  docker push YOUR_USER/flipkart-frontend:latest
  docker push YOUR_USER/flipkart-payment-service:latest
  # ... (push all 6)

  # Deploy to K8s
  kubectl apply -f k8s/namespace.yaml
  kubectl apply -f k8s/mongodb.yaml -n flipkart
  kubectl apply -f k8s/api-gateway.yaml -n flipkart
  kubectl apply -f k8s/frontend/ -n flipkart
  kubectl apply -f k8s/user-service/ -n flipkart
  kubectl apply -f k8s/product-service/ -n flipkart
  kubectl apply -f k8s/cart-service/ -n flipkart
  kubectl apply -f k8s/payment-service/ -n flipkart
  kubectl apply -f k8s/order-service/ -n flipkart

  # Update images
  kubectl set image deployment/frontend frontend=YOUR_USER/flipkart-frontend:latest -n flipkart
  kubectl set image deployment/payment-service payment-service=YOUR_USER/flipkart-payment-service:latest -n flipkart

  # ===== MONITOR =====
  kubectl get all -n flipkart
  kubectl get hpa -n flipkart
  kubectl top pods -n flipkart

  # ===== HPA TEST =====
  kubectl run load --image=busybox --restart=Never -n flipkart -- sh -c 'for i in $(seq 1 100); do wget -q -O- http://payment-service:3004/api/payments/stress & done'
  kubectl get hpa -n flipkart -w

  # ===== CLEANUP =====
  eksctl delete cluster --name flipkart-cluster --region ap-south-1


================================================================================
END OF CLOUD DEPLOYMENT GUIDE
================================================================================
