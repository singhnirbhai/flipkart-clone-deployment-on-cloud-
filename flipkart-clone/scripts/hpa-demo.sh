#!/bin/bash
#################################################################
# HPA DEMONSTRATION SCRIPT
# 
# Ye script dikhata hai ki Payment Service pe HPA kaise kaam karta hai
#
# Steps:
# 1. Deploy payment-service with HPA
# 2. Generate load (stress test)
# 3. Watch HPA auto-scale pods
# 4. Stop load
# 5. Watch HPA auto-scale down
#################################################################

set -e

NAMESPACE="flipkart"
echo "=========================================="
echo "  HPA DEMONSTRATION - Payment Service"
echo "=========================================="
echo ""

# Step 1: Check current state
echo "📊 Step 1: Current HPA Status"
echo "-------------------------------------------"
kubectl get hpa payment-service-hpa -n $NAMESPACE
echo ""

# Step 2: Show current pods
echo "📦 Step 2: Current Payment Pods"
echo "-------------------------------------------"
kubectl get pods -n $NAMESPACE -l app=payment-service -o wide
echo ""

# Step 3: Generate load in background
echo "🔥 Step 3: Starting load test (background)..."
echo "This will hit /api/payments/stress endpoint 50 times concurrently"
echo ""

# Create a load generator pod
kubectl run load-generator --image=busybox --restart=Never -n $NAMESPACE -- \
    sh -c '
        echo "Starting load generation..."
        for round in 1 2 3 4 5; do
            echo "Round $round..."
            for i in $(seq 1 20); do
                wget -q -O- http://payment-service:3004/api/payments/stress &
            done
            sleep 5
        done
        echo "Load generation complete"
    '

echo ""
echo "⏳ Step 4: Watching HPA (Ctrl+C to stop)..."
echo "=========================================="
echo "Observe:"
echo "  - CURRENT pods increasing"
echo "  - TARGET showing desired replica count"
echo "  - CPU% going up"
echo "=========================================="
echo ""

# Watch HPA in real-time
kubectl get hpa payment-service-hpa -n $NAMESPACE -w &
HPA_WATCH_PID=$!

# Also watch pods
kubectl get pods -n $NAMESPACE -l app=payment-service -w &
PODS_WATCH_PID=$!

# Wait for load to finish
echo "Waiting for load test to complete..."
kubectl wait --for=condition=Ready pod/load-generator -n $NAMESPACE --timeout=120s 2>/dev/null || true

echo ""
echo "📉 Step 5: Load complete. Watching scale-down..."
echo "(HPA takes 300s stabilization window before scaling down)"
echo ""

# Keep watching for a while
sleep 30

# Show final state
echo ""
echo "📊 Final HPA Status:"
kubectl get hpa payment-service-hpa -n $NAMESPACE

echo ""
echo "📦 Final Pods:"
kubectl get pods -n $NAMESPACE -l app=payment-service

# Cleanup
kubectl delete pod load-generator -n $NAMESPACE --ignore-not-found 2>/dev/null
kill $HPA_WATCH_PID $PODS_WATCH_PID 2>/dev/null

echo ""
echo "✅ HPA Demonstration Complete!"
echo ""
echo "How it worked:"
echo "1. Load generator sent concurrent requests to payment-service"
echo "2. CPU usage increased above 60% threshold"
echo "3. HPA detected high CPU -> created new pods"
echo "4. When load stopped -> CPU dropped below threshold"
echo "5. After 300s stabilization -> HPA removed extra pods"
