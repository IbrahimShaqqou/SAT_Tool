#!/bin/bash

echo "========================================"
echo "Bluebook Traffic Capture Setup"
echo "========================================"
echo ""

# 1. Start mitmproxy
echo "Step 1: Starting mitmproxy..."
echo ""
echo "mitmproxy will start and listen on port 8080"
echo ""
echo "In a new terminal, run:"
echo "  mitmdump -p 8080 -s $(dirname $0)/bluebook_interceptor.py --ssl-insecure"
echo ""
read -p "Press Enter once mitmproxy is running..."

# 2. Install certificate
echo ""
echo "Step 2: Installing mitmproxy SSL certificate..."
echo ""
echo "The certificate allows mitmproxy to decrypt HTTPS traffic."
echo ""

# Check if certificate exists
CERT_PATH=~/.mitmproxy/mitmproxy-ca-cert.pem

if [ -f "$CERT_PATH" ]; then
    echo "✓ Certificate found at: $CERT_PATH"

    # Install on macOS
    echo "Installing certificate in system keychain..."
    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "$CERT_PATH"

    if [ $? -eq 0 ]; then
        echo "✓ Certificate installed successfully"
    else
        echo "⚠ Certificate installation failed. You may need to install manually."
        echo "  Open Keychain Access"
        echo "  File → Import Items"
        echo "  Select: $CERT_PATH"
        echo "  Double-click the cert → Trust → Always Trust"
    fi
else
    echo "⚠ Certificate not found. Make sure mitmproxy is running first."
    echo "  Start: mitmdump -p 8080 -s $(dirname $0)/bluebook_interceptor.py"
    echo "  Then run this script again."
    exit 1
fi

# 3. Configure proxy
echo ""
echo "Step 3: Configuring system proxy..."
echo ""
echo "Setting HTTP/HTTPS proxy to localhost:8080..."

# Set system proxy (macOS)
networksetup -setwebproxy "Wi-Fi" 127.0.0.1 8080
networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 8080
networksetup -setwebproxystate "Wi-Fi" on
networksetup -setsecurewebproxystate "Wi-Fi" on

echo "✓ System proxy configured"

# 4. Instructions
echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Close Bluebook (if open)"
echo "  2. Reopen Bluebook"
echo "  3. Start a practice test"
echo "  4. Navigate through questions"
echo "  5. mitmproxy will capture all traffic"
echo ""
echo "Captured data will be saved to:"
echo "  $(dirname $0)/../data/bluebook_captures/"
echo ""
echo "When done, run cleanup:"
echo "  $(dirname $0)/cleanup_bluebook_capture.sh"
echo ""
