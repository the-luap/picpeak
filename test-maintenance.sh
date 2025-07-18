#!/bin/bash

# Test maintenance mode functionality

echo "Testing maintenance mode implementation..."

# First, let's check the current maintenance mode status
echo -e "\n1. Checking current maintenance mode status:"
curl -s http://localhost:3002/api/public/settings | jq '.general_maintenance_mode'

# Test a public gallery endpoint
echo -e "\n2. Testing public gallery endpoint (should get 503 if maintenance is on):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/gallery/test-gallery/info

# Test admin login (should always work)
echo -e "\n\n3. Testing admin login endpoint (should always work):"
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/admin/login

echo -e "\n\nDone!"