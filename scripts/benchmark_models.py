#!/usr/bin/env python3
"""
Automated Time Series Model Benchmarking CLI
Usage:
    python benchmark_models.py --file sample_data/stock_prices.csv --col price --test-ratio 0.2
"""

import argparse
import sys
import os
import pandas as pd
import numpy as np

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.models.time_series_models import EnhancedTimeSeriesModelManager

def run_benchmark(file_path: str, value_col: str, time_col: str = None, test_ratio: float = 0.2):
    if not os.path.exists(file_path):
        print(f"Error: File '{file_path}' not found.")
        sys.exit(1)

    df = pd.read_csv(file_path)
    if value_col not in df.columns:
        print(f"Error: Column '{value_col}' not found. Available columns: {list(df.columns)}")
        sys.exit(1)

    dataset = {
        'records': df.to_dict('records'),
        'value_column': value_col,
        'time_column': time_col or (df.columns[0] if 'date' in df.columns[0].lower() else None)
    }

    manager = EnhancedTimeSeriesModelManager()

    print(f"\n=======================================================")
    print(f"  ATSA Automated Benchmarking: {os.path.basename(file_path)}")
    print(f"  Rows: {len(df)} | Value Column: {value_col} | Test Split: {int(test_ratio*100)}%")
    print(f"=======================================================\n")

    models_to_test = [
        {"name": "ARIMA(1,1,1)", "cfg": {"model_type": "arima", "parameters": {"order": (1, 1, 1)}}},
        {"name": "ARIMA(2,1,2)", "cfg": {"model_type": "arima", "parameters": {"order": (2, 1, 2)}}},
        {"name": "Holt-Winters", "cfg": {"model_type": "holt-winters", "parameters": {"trend": "add", "seasonal": "add", "seasonal_periods": 12}}},
        {"name": "Moving Average (window=7)", "cfg": {"model_type": "moving_average", "parameters": {"window": 7}}}
    ]

    results = []
    for m in models_to_test:
        try:
            bt = manager.backtest_model(dataset, m["cfg"], test_ratio=test_ratio)
            metrics = bt["test_metrics"]
            results.append({
                "Model": m["name"],
                "RMSE": round(metrics["rmse"], 2),
                "MAE": round(metrics["mae"], 2),
                "MAPE (%)": round(metrics["mape"], 2),
                "vs Naive (%)": f"{metrics['improvement_pct']:+.1f}%"
            })
        except Exception as e:
            results.append({
                "Model": m["name"],
                "RMSE": "N/A",
                "MAE": "N/A",
                "MAPE (%)": "N/A",
                "vs Naive (%)": f"Failed ({str(e)[:20]})"
            })

    results_df = pd.DataFrame(results)
    print(results_df.to_string(index=False))
    print("\nBenchmark completed successfully!\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ATSA Model Benchmark CLI")
    parser.add_argument("--file", type=str, default="backend/app/data/monthly_sales.csv", help="CSV path")
    parser.add_argument("--col", type=str, default="sales", help="Value column name")
    parser.add_argument("--time-col", type=str, default="date", help="Time column name")
    parser.add_argument("--test-ratio", type=float, default=0.2, help="Holdout test ratio (default: 0.2)")
    args = parser.parse_args()

    run_benchmark(args.file, args.col, args.time_col, args.test_ratio)
