import pytest
import numpy as np
import pandas as pd
from app.models.time_series_models import ARIMAModel, SARIMAModel, MovingAverageModel

def test_arima_fit_and_forecast():
    np.random.seed(42)
    # Generate AR(1) synthetic series
    n = 100
    series = [10.0]
    for _ in range(1, n):
        series.append(0.7 * series[-1] + np.random.normal(0, 1))
    
    ts_data = pd.Series(series)
    model = ARIMAModel(order=(1, 0, 0))
    model.fit(ts_data)
    
    info = model.get_model_info()
    assert "aic" in info
    assert "bic" in info
    assert info["aic"] > 0
    
    # 5-step ahead forecast
    forecast = model.forecast(periods=5, confidence_interval=0.95)
    assert len(forecast["forecast"]) == 5
    assert len(forecast["lower_bound"]) == 5
    assert len(forecast["upper_bound"]) == 5
    # Bounds should encompass reasonable values
    assert all(low < high for low, high in zip(forecast["lower_bound"], forecast["upper_bound"]))

def test_sarima_fit_and_forecast():
    np.random.seed(42)
    t = np.arange(48)
    series = 20 + 0.1 * t + 4 * np.sin(2 * np.pi * t / 12) + np.random.normal(0, 0.5, 48)
    ts_data = pd.Series(series)
    
    model = SARIMAModel(order=(1, 0, 0), seasonal_order=(1, 0, 0, 12))
    model.fit(ts_data)
    
    forecast = model.forecast(periods=6)
    assert len(forecast["forecast"]) == 6
    assert len(forecast["lower_bound"]) == 6
    assert len(forecast["upper_bound"]) == 6

def test_moving_average_baseline():
    data = pd.Series([10.0, 12.0, 14.0, 16.0, 18.0, 20.0])
    model = MovingAverageModel(window=3)
    model.fit(data)
    
    forecast = model.forecast(periods=3)
    assert len(forecast["forecast"]) == 3
    # Mean of last 3 (16, 18, 20) is 18.0
    assert abs(forecast["forecast"][0] - 18.0) < 1e-4
