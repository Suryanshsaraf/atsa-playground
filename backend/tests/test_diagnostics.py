import pytest
import numpy as np
from app.services.analysis_service import AnalysisService

@pytest.fixture
def analysis_service():
    return AnalysisService()

def test_stationarity_white_noise(analysis_service):
    np.random.seed(42)
    white_noise = np.random.normal(0, 1, 150).tolist()
    data = {
        'records': [{'value': val} for val in white_noise],
        'value_column': 'value'
    }
    
    result = analysis_service.test_stationarity(data)
    assert result is not None
    assert 'adf_test' in result
    assert 'kpss_test' in result
    assert result['adf_test']['pvalue'] < 0.05
    assert result['adf_test']['is_stationary'] is True

def test_stationarity_random_walk(analysis_service):
    np.random.seed(42)
    random_walk = np.cumsum(np.random.normal(0, 1, 150)).tolist()
    data = {
        'records': [{'value': val} for val in random_walk],
        'value_column': 'value'
    }
    
    result = analysis_service.test_stationarity(data)
    assert result is not None
    assert 'adf_test' in result
    # Random walk unit root has p-value > 0.05
    assert result['adf_test']['pvalue'] > 0.05
    assert result['adf_test']['is_stationary'] is False

def test_calculate_acf_pacf(analysis_service):
    np.random.seed(42)
    data_values = np.random.normal(0, 1, 100).tolist()
    data = {
        'records': [{'value': val} for val in data_values],
        'value_column': 'value'
    }
    
    result = analysis_service.calculate_acf_pacf(data, lags=10)
    assert 'acf' in result
    assert 'pacf' in result
    assert len(result['acf']['values']) > 0
    assert abs(result['acf']['values'][0] - 1.0) < 1e-4

def test_seasonal_decomposition(analysis_service):
    np.random.seed(42)
    # 48 monthly points with seasonal wave
    t = np.arange(48)
    series = 10 + 0.1 * t + 5 * np.sin(2 * np.pi * t / 12) + np.random.normal(0, 0.2, 48)
    data = {
        'records': [{'value': float(val)} for val in series],
        'value_column': 'value'
    }
    
    result = analysis_service.decompose_time_series(data, method='additive', period=12)
    assert 'trend' in result
    assert 'seasonal' in result
    assert 'residual' in result
    assert len(result['seasonal']) == 48
