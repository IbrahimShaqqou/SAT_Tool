#!/bin/bash

echo "========================================"
echo "Bluebook Traffic Capture Cleanup"
echo "========================================"
echo ""

# Disable system proxy
echo "Disabling system proxy..."
networksetup -setwebproxystate "Wi-Fi" off
networksetup -setsecurewebproxystate "Wi-Fi" off

echo "✓ System proxy disabled"
echo ""
echo "You can now stop mitmproxy (Ctrl+C in its terminal)"
echo ""
echo "Captured data is in:"
echo "  $(dirname $0)/../data/bluebook_captures/"
echo ""
