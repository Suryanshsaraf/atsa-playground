import pytest
import pandas as pd
import numpy as np
from app.services.data_service import DataService

@pytest.fixture
def data_service():
    return DataService()

def test_process_uploaded_data(data_service):
    df = pd.DataFrame({
        'date': pd.date_range('2023-01-01', periods=30, freq='D'),
        'sales': np.random.uniform(100, 200, 30),
        'category': ['Retail'] * 30
    })
    
    result = data_service.process_uploaded_data(df)
    assert result is not None
    assert "records" in result
    assert "info" in result
    assert len(result["records"]) == 30
    assert result["suggested_time_column"] == "date"
    assert "sales" in result["suggested_value_columns"]

def test_detect_time_and_value_columns(data_service):
    df = pd.DataFrame({
        'timestamp': ['2023-01-01', '2023-01-02', '2023-01-03'],
        'revenue': [500.0, 620.0, 710.0],
        'note': ['a', 'b', 'c']
    })
    
    time_cols = data_service._detect_time_columns(df)
    assert "timestamp" in time_cols
    
    val_cols = data_service._detect_value_columns(df)
    assert "revenue" in val_cols
    assert "note" not in val_cols

def test_missing_value_preprocessing(data_service):
    data = {
        'records': [
            {'date': '2023-01-01', 'val': 10.0},
            {'date': '2023-01-02', 'val': None},
            {'date': '2023-01-03', 'val': 30.0}
        ],
        'preprocessing': {
            'fill_missing': True,
            'fill_method': 'interpolate'
        }
    }
    
    processed = data_service.preprocess_data(data)
    assert processed is not None
    assert "records" in processed
    # None value should be interpolated to 20.0
    interpolated_val = processed['records'][1]['val']
    assert interpolated_val is not None
    assert abs(interpolated_val - 20.0) < 1e-4

def test_validate_time_series_data(data_service):
    valid_data = {
        'records': [
            {'date': f'2023-01-{i+1:02d}', 'val': float(i * 10)} for i in range(15)
        ]
    }
    res = data_service.validate_time_series_data(valid_data)
    assert res['is_valid'] is True
    assert len(res['issues']) == 0
