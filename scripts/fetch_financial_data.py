#!/usr/bin/env python3
"""
Market Data Bulk Downloader CLI
Fetches historical market prices via Yahoo Finance and saves to CSV.
Usage:
    python scripts/fetch_financial_data.py --tickers AAPL MSFT NVDA TSLA --period 2y --output sample_data/
"""

import argparse
import os
import yfinance as yf
import pandas as pd

def fetch_data(tickers, period='2y', interval='1d', output_dir='sample_data'):
    os.makedirs(output_dir, exist_ok=True)
    print(f"Fetching {len(tickers)} tickers for period='{period}', interval='{interval}'...")

    for ticker in tickers:
        t = ticker.strip().upper()
        print(f"  -> Downloading {t}...", end=" ", flush=True)
        try:
            df = yf.Ticker(t).history(period=period, interval=interval)
            if df.empty:
                print("Failed (No data)")
                continue

            df = df.reset_index()
            if 'Date' in df.columns:
                df['date'] = df['Date'].dt.strftime('%Y-%m-%d')
            elif 'Datetime' in df.columns:
                df['date'] = df['Datetime'].dt.strftime('%Y-%m-%d')

            save_cols = ['date', 'Open', 'High', 'Low', 'Close', 'Volume']
            save_cols = [c for c in save_cols if c in df.columns]
            clean_df = df[save_cols].rename(columns={'Close': 'price'})

            out_path = os.path.join(output_dir, f"{t.lower()}_market_data.csv")
            clean_df.to_csv(out_path, index=False)
            print(f"Saved {len(clean_df)} rows to {out_path}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk Market Data Downloader")
    parser.add_argument("--tickers", nargs="+", default=["AAPL", "NVDA", "MSFT"], help="List of stock tickers")
    parser.add_argument("--period", default="1y", help="Historical period (1mo, 6mo, 1y, 2y, 5y)")
    parser.add_argument("--interval", default="1d", help="Interval (1d, 1wk, 1mo)")
    parser.add_argument("--output", default="sample_data", help="Output directory")
    args = parser.parse_args()

    fetch_data(args.tickers, args.period, args.interval, args.output)
