import pytest
import numpy as np
from app.models.time_series_models import EnhancedTimeSeriesModelManager

@pytest.fixture
def model_manager():
    return EnhancedTimeSeriesModelManager()

@pytest.fixture
def sample_data():
    np.random.seed(42)
    # 60 synthetic monthly sales points
    values = [100 + 1.5 * i + 10 * np.sin(2 * np.pi * i / 12) + np.random.normal(0, 2) for i in range(60)]
    return {
        'records': [{'date': f'2020-{i+1:02d}', 'value': float(val)} for i, val in enumerate(values)],
        'value_column': 'value',
        'time_column': 'date'
    }

def test_auto_arima_grid_search(model_manager, sample_data):
    result = model_manager.auto_arima_grid_search(sample_data)
    assert result is not None
    assert "best_order" in result
    assert "candidates" in result
    assert len(result["candidates"]) > 0

def test_residual_diagnostics(model_manager, sample_data):
    config = {
        'model_type': 'arima',
        'parameters': {'p': 1, 'd': 1, 'q': 1}
    }
    result = model_manager.get_residual_diagnostics(sample_data, config)
    assert result is not None
    assert "ljung_box" in result
    assert "jarque_bera" in result
    assert "histogram" in result
    assert "acf" in result

def test_backtest_model(model_manager, sample_data):
    config = {
        'model_type': 'arima',
        'parameters': {'p': 1, 'd': 0, 'q': 0}
    }
    result = model_manager.backtest_model(sample_data, config, test_ratio=0.2)
    assert result is not None
    assert "test_metrics" in result
    assert "rmse" in result["test_metrics"]
    assert "naive_rmse" in result["test_metrics"]
    assert "test_actual" in result
    assert len(result["test_actual"]) > 0
