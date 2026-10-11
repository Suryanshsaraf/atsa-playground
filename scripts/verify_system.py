#!/usr/bin/env python3
"""
ATSA System Release Verification Script
Tests all live API endpoints and system integration.
Usage:
    python scripts/verify_system.py
"""

import urllib.request
import json
import sys

BASE_URL = "http://localhost:8000"

def test_endpoint(name: str, path: str, method: str = "GET", data: dict = None):
    url = f"{BASE_URL}{path}"
    print(f"  [Testing] {name:<35} -> {method} {path} ...", end=" ", flush=True)
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode('utf-8') if data else None,
            headers={'Content-Type': 'application/json'} if data else {}
        )
        with urllib.request.urlopen(req, timeout=10) as res:
            if res.status == 200:
                print("✓ OK")
                return True
            else:
                print(f"✗ Status {res.status}")
                return False
    except Exception as e:
        print(f"✗ Failed: {e}")
        return False

def main():
    print("\n=======================================================")
    print("      ATSA Playground: System Release Verification      ")
    print("=======================================================\n")

    checks = [
        ("API Health Check", "/api/health", "GET", None),
        ("Built-in Datasets Catalog", "/api/data/sample-datasets", "GET", None),
        ("Stock Prices Sample Data", "/api/data/sample-datasets/stock_prices", "GET", None),
        ("Live Yahoo Finance Loader", "/api/data/yfinance/AAPL?period=1mo", "GET", None),
        ("Available Models List", "/api/models/available-models", "GET", None),
    ]

    all_passed = True
    for name, path, method, data in checks:
        passed = test_endpoint(name, path, method, data)
        if not passed:
            all_passed = False

    print("\n-------------------------------------------------------")
    if all_passed:
        print("  ✓ All API endpoints verified and operational!")
        print("=======================================================\n")
        sys.exit(0)
    else:
        print("  ✗ Some endpoints failed. Check backend service status.")
        print("=======================================================\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
