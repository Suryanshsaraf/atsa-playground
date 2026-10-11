import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from abc import ABC, abstractmethod
import warnings
warnings.filterwarnings('ignore')

# Statistical models
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.seasonal import seasonal_decompose
from statsmodels.stats.diagnostic import acorr_ljungbox
from statsmodels.tsa.stattools import adfuller, acf
from scipy.stats import jarque_bera, norm

# Prophet (with fallback)
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    print("Prophet not available - using alternative forecasting methods")

# Deep Learning
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from sklearn.preprocessing import MinMaxScaler
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("TensorFlow not available - LSTM models disabled")

# Metrics
from sklearn.metrics import mean_absolute_error, mean_squared_error
import math

class BaseTimeSeriesModel(ABC):
    """Abstract base class for time series models"""
    
    @abstractmethod
    def fit(self, data: pd.Series, **kwargs) -> None:
        pass
    
    @abstractmethod
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def get_fitted_values(self) -> np.ndarray:
        pass
    
    @abstractmethod
    def get_model_info(self) -> Dict[str, Any]:
        pass

class ARIMAModel(BaseTimeSeriesModel):
    """ARIMA model implementation"""
    
    def __init__(self, order: Tuple[int, int, int] = (1, 1, 1)):
        self.order = order
        self.model = None
        self.fitted_model = None
        
    def fit(self, data: pd.Series, **kwargs) -> None:
        """Fit ARIMA model"""
        try:
            self.model = ARIMA(data, order=self.order)
            self.fitted_model = self.model.fit()
        except Exception as e:
            raise ValueError(f"ARIMA model fitting failed: {str(e)}")
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted before forecasting")
        
        alpha = 1 - confidence_interval
        forecast_result = self.fitted_model.get_forecast(steps=periods)
        predicted_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=alpha)
        
        forecast_values = predicted_mean.values if hasattr(predicted_mean, 'values') else np.array(predicted_mean)
        lower_bound = conf_int.iloc[:, 0].values if hasattr(conf_int, 'iloc') else conf_int[:, 0]
        upper_bound = conf_int.iloc[:, 1].values if hasattr(conf_int, 'iloc') else conf_int[:, 1]
        
        return {
            'forecast': [float(x) for x in forecast_values],
            'lower_bound': [float(x) for x in lower_bound],
            'upper_bound': [float(x) for x in upper_bound]
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted first")
        return self.fitted_model.fittedvalues.values
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        if not self.fitted_model:
            return {'order': self.order}
        
        return {
            'order': self.order,
            'aic': float(self.fitted_model.aic),
            'bic': float(self.fitted_model.bic),
            'parameters': {
                name: float(value) for name, value in self.fitted_model.params.items()
            }
        }

class SARIMAModel(BaseTimeSeriesModel):
    """SARIMA model implementation"""
    
    def __init__(self, order: Tuple[int, int, int] = (1, 1, 1), 
                 seasonal_order: Tuple[int, int, int, int] = (1, 1, 1, 12)):
        self.order = order
        self.seasonal_order = seasonal_order
        self.model = None
        self.fitted_model = None
    
    def fit(self, data: pd.Series, **kwargs) -> None:
        """Fit SARIMA model"""
        try:
            self.model = SARIMAX(data, order=self.order, seasonal_order=self.seasonal_order)
            self.fitted_model = self.model.fit(disp=False)
        except Exception as e:
            raise ValueError(f"SARIMA model fitting failed: {str(e)}")
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted before forecasting")
        
        alpha = 1 - confidence_interval
        forecast_result = self.fitted_model.get_forecast(steps=periods)
        predicted_mean = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=alpha)
        
        forecast_values = predicted_mean.values if hasattr(predicted_mean, 'values') else np.array(predicted_mean)
        lower_bound = conf_int.iloc[:, 0].values if hasattr(conf_int, 'iloc') else conf_int[:, 0]
        upper_bound = conf_int.iloc[:, 1].values if hasattr(conf_int, 'iloc') else conf_int[:, 1]
        
        return {
            'forecast': [float(x) for x in forecast_values],
            'lower_bound': [float(x) for x in lower_bound],
            'upper_bound': [float(x) for x in upper_bound]
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted first")
        return self.fitted_model.fittedvalues.values
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        if not self.fitted_model:
            return {'order': self.order, 'seasonal_order': self.seasonal_order}
        
        return {
            'order': self.order,
            'seasonal_order': self.seasonal_order,
            'aic': float(self.fitted_model.aic),
            'bic': float(self.fitted_model.bic)
        }

class HoltWintersModel(BaseTimeSeriesModel):
    """Holt-Winters Exponential Smoothing model"""
    
    def __init__(self, trend: str = 'add', seasonal: str = 'add', seasonal_periods: int = 12):
        self.trend = trend
        self.seasonal = seasonal
        self.seasonal_periods = seasonal_periods
        self.model = None
        self.fitted_model = None
    
    def fit(self, data: pd.Series, **kwargs) -> None:
        """Fit Holt-Winters model"""
        try:
            hw_kwargs: Dict[str, Any] = {'trend': self.trend}
            if self.seasonal:
                hw_kwargs['seasonal'] = self.seasonal
                if self.seasonal_periods:
                    hw_kwargs['seasonal_periods'] = self.seasonal_periods
            self.model = ExponentialSmoothing(data, **hw_kwargs)
            self.fitted_model = self.model.fit()
        except Exception as e:
            raise ValueError(f"Holt-Winters model fitting failed: {str(e)}")
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted before forecasting")
        
        forecast_values = self.fitted_model.forecast(periods)
        forecast_array = forecast_values.values if hasattr(forecast_values, 'values') else np.array(forecast_values)
        
        # Simple confidence intervals (Holt-Winters doesn't provide them natively)
        fitted = self.get_fitted_values()
        std_error = float(np.nanstd(fitted) * 1.96) if len(fitted) > 0 else 1.0
        lower_bound = forecast_array - std_error
        upper_bound = forecast_array + std_error
        
        return {
            'forecast': [float(x) for x in forecast_array],
            'lower_bound': [float(x) for x in lower_bound],
            'upper_bound': [float(x) for x in upper_bound]
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted first")
        return self.fitted_model.fittedvalues.values
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            'trend': self.trend,
            'seasonal': self.seasonal,
            'seasonal_periods': self.seasonal_periods
        }

class ProphetModel(BaseTimeSeriesModel):
    """Facebook Prophet model"""
    
    def __init__(self, **kwargs):
        if not PROPHET_AVAILABLE:
            raise ImportError("Prophet not available. Install with: pip install prophet")
        
        self.model_params = kwargs
        self.model = None
        self.fitted_model = None
        self.data = None
    
    def fit(self, data: pd.Series, **kwargs) -> None:
        """Fit Prophet model"""
        try:
            # Prepare data for Prophet
            df = pd.DataFrame({
                'ds': data.index if hasattr(data.index, 'to_pydatetime') else pd.date_range(start='2020-01-01', periods=len(data), freq='D'),
                'y': data.values
            })
            
            self.model = Prophet(**self.model_params)
            self.fitted_model = self.model.fit(df)
            self.data = df
        except Exception as e:
            raise ValueError(f"Prophet model fitting failed: {str(e)}")
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if not self.fitted_model:
            raise ValueError("Model must be fitted before forecasting")
        
        # Create future dataframe
        future = self.fitted_model.make_future_dataframe(periods=periods)
        forecast = self.fitted_model.predict(future)
        
        # Extract forecast values (last 'periods' values)
        forecast_values = forecast['yhat'].tail(periods).values
        lower_bound = forecast['yhat_lower'].tail(periods).values
        upper_bound = forecast['yhat_upper'].tail(periods).values
        
        return {
            'forecast': forecast_values.tolist(),
            'lower_bound': lower_bound.tolist(),
            'upper_bound': upper_bound.tolist()
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if not self.fitted_model or self.data is None:
            raise ValueError("Model must be fitted first")
        
        forecast = self.fitted_model.predict(self.data)
        return forecast['yhat'].values
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            'model_type': 'prophet',
            'parameters': self.model_params
        }

class TimeSeriesModelManager:
    """Manager class for time series models"""
    
    def __init__(self):
        self.models = {
            'arima': ARIMAModel,
            'sarima': SARIMAModel,
            'holt-winters': HoltWintersModel,
            'holt_winters': HoltWintersModel,
        }
        
        if PROPHET_AVAILABLE:
            self.models['prophet'] = ProphetModel
    
    def create_model(self, model_type: str, **kwargs) -> BaseTimeSeriesModel:
        """Create a model instance"""
        if model_type not in self.models:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Normalize ARIMA parameters
        if model_type == 'arima':
            if 'order' not in kwargs and ('p' in kwargs or 'd' in kwargs or 'q' in kwargs):
                p = int(kwargs.pop('p', 1))
                d = int(kwargs.pop('d', 1))
                q = int(kwargs.pop('q', 1))
                kwargs['order'] = (p, d, q)
        elif model_type == 'sarima':
            if 'order' not in kwargs and ('p' in kwargs or 'd' in kwargs or 'q' in kwargs):
                p = int(kwargs.pop('p', 1))
                d = int(kwargs.pop('d', 1))
                q = int(kwargs.pop('q', 1))
                kwargs['order'] = (p, d, q)
            if 'seasonal_order' not in kwargs and ('P' in kwargs or 'D' in kwargs or 'Q' in kwargs or 's' in kwargs):
                P = int(kwargs.pop('P', 1))
                D = int(kwargs.pop('D', 1))
                Q = int(kwargs.pop('Q', 1))
                s = int(kwargs.pop('s', 12))
                kwargs['seasonal_order'] = (P, D, Q, s)
        
        return self.models[model_type](**kwargs)
    
    def fit_and_forecast(self, data: Dict[str, Any], model_config: Any) -> Dict[str, Any]:
        """Fit model and generate forecast"""
        if hasattr(model_config, 'model_dump'):
            model_config = model_config.model_dump()
        elif hasattr(model_config, 'dict'):
            model_config = model_config.dict()
        elif not isinstance(model_config, dict):
            model_config = dict(model_config)

        # Extract data
        records = data.get('records', [])
        value_column = data.get('value_column')
        time_column = data.get('time_column')
        
        if not records or not value_column:
            raise ValueError("Invalid data format")
        
        df = pd.DataFrame(records)
        
        # Handle time index
        if time_column and time_column in df.columns:
            try:
                df[time_column] = pd.to_datetime(df[time_column])
                df = df.sort_values(by=time_column)
            except Exception:
                pass
        
        series = df[value_column].dropna()
        
        if len(series) < 10:
            raise ValueError("Insufficient data points for modeling")
        
        # Use clean integer-indexed series so missing weekend frequencies never break statsmodels
        series_clean = series.reset_index(drop=True)

        # Create and fit model
        model_type = model_config.get('model_type', 'arima')
        parameters = model_config.get('parameters', {})
        
        try:
            model = self.create_model(model_type, **parameters)
            model.fit(series_clean)
            
            # Generate forecast
            forecast_periods = model_config.get('forecast_periods', 30)
            confidence_interval = model_config.get('confidence_interval', 0.95)
            
            forecast_result = model.forecast(forecast_periods, confidence_interval)
            fitted_values = model.get_fitted_values()
            model_info = model.get_model_info()
            
            # Calculate metrics
            metrics = self._calculate_metrics(series_clean.values, fitted_values)
            
            # Generate forecast dates
            if time_column and time_column in df.columns:
                try:
                    last_date = df[time_column].iloc[-1]
                    if hasattr(last_date, 'strftime'):
                        forecast_dates = pd.date_range(
                            start=last_date + pd.Timedelta(days=1),
                            periods=forecast_periods,
                            freq='B' if len(df) > 50 else 'D'
                        ).strftime('%Y-%m-%d').tolist()
                    else:
                        forecast_dates = [f"Period {len(series_clean) + i + 1}" for i in range(forecast_periods)]
                except Exception:
                    forecast_dates = [f"+{i + 1}" for i in range(forecast_periods)]
            else:
                forecast_dates = [f"Period {len(series_clean) + i + 1}" for i in range(forecast_periods)]
            
            fitted_raw = fitted_values.tolist() if hasattr(fitted_values, 'tolist') else list(fitted_values)
            fitted_clean = [None if (x is None or (isinstance(x, (float, np.floating)) and np.isnan(x))) else float(x) for x in fitted_raw]

            return {
                'model_type': model_type,
                'fitted_values': fitted_clean,
                'forecast': [float(x) for x in forecast_result['forecast']],
                'forecast_lower': [float(x) for x in forecast_result['lower_bound']],
                'forecast_upper': [float(x) for x in forecast_result['upper_bound']],
                'forecast_dates': forecast_dates,
                'metrics': metrics,
                'parameters': parameters,
                'model_info': model_info
            }
            
        except Exception as e:
            raise ValueError(f"Model fitting failed: {str(e)}")
    
    def _calculate_metrics(self, actual: np.ndarray, predicted: np.ndarray) -> Dict[str, float]:
        """Calculate forecast accuracy metrics"""
        
        # Ensure same length
        min_len = min(len(actual), len(predicted))
        actual = actual[:min_len]
        predicted = predicted[:min_len]
        
        # Remove NaN values
        mask = ~(np.isnan(actual) | np.isnan(predicted))
        actual = actual[mask]
        predicted = predicted[mask]
        
        if len(actual) == 0:
            return {'error': 'No valid data points for metric calculation'}
        
        try:
            mae = mean_absolute_error(actual, predicted)
            mse = mean_squared_error(actual, predicted)
            rmse = np.sqrt(mse)
            
            # MAPE (handle division by zero)
            non_zero_mask = actual != 0
            if np.any(non_zero_mask):
                mape = np.mean(np.abs((actual[non_zero_mask] - predicted[non_zero_mask]) / actual[non_zero_mask])) * 100
            else:
                mape = float('inf')
            
            return {
                'mae': float(mae),
                'mse': float(mse),
                'rmse': float(rmse),
                'mape': float(mape) if mape != float('inf') else None
            }
        except Exception as e:
            return {'error': f'Metric calculation failed: {str(e)}'}
    
    def compare_models(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Compare multiple model results"""
        
        comparison = {
            'models': [],
            'best_model': None,
            'ranking': []
        }
        
        for result in results:
            metrics = result.get('metrics', {})
            model_comparison = {
                'model_type': result.get('model_type'),
                'mae': metrics.get('mae'),
                'rmse': metrics.get('rmse'),
                'mape': metrics.get('mape')
            }
            comparison['models'].append(model_comparison)
        
        # Rank by RMSE (lower is better)
        valid_models = [m for m in comparison['models'] if m['rmse'] is not None]
        if valid_models:
            ranked_models = sorted(valid_models, key=lambda x: x['rmse'])
            comparison['ranking'] = [m['model_type'] for m in ranked_models]
            comparison['best_model'] = ranked_models[0]['model_type']
        
        return comparison
    
    def get_available_models(self) -> Dict[str, Any]:
        """Get information about available models"""
        
        model_info = {
            'arima': {
                'name': 'ARIMA',
                'description': 'AutoRegressive Integrated Moving Average',
                'parameters': ['p', 'd', 'q'],
                'suitable_for': 'Stationary time series'
            },
            'sarima': {
                'name': 'SARIMA',
                'description': 'Seasonal ARIMA',
                'parameters': ['p', 'd', 'q', 'P', 'D', 'Q', 's'],
                'suitable_for': 'Time series with seasonality'
            },
            'holt-winters': {
                'name': 'Holt-Winters',
                'description': 'Exponential Smoothing with Trend and Seasonality',
                'parameters': ['trend', 'seasonal', 'seasonal_periods'],
                'suitable_for': 'Data with trend and seasonality'
            }
        }
        
        if PROPHET_AVAILABLE:
            model_info['prophet'] = {
                'name': 'Prophet',
                'description': 'Facebook Prophet for forecasting',
                'parameters': ['seasonality_mode', 'yearly_seasonality', 'weekly_seasonality'],
                'suitable_for': 'Business metrics with strong seasonal patterns'
            }
        
        return model_info

    def auto_arima_grid_search(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Perform grid search over ARIMA(p,d,q) orders minimizing AIC/BIC"""
        records = data.get('records', [])
        value_column = data.get('value_column')
        if not records or not value_column:
            raise ValueError("Invalid data format for grid search")

        df = pd.DataFrame(records)
        series = df[value_column].dropna().reset_index(drop=True)
        if len(series) < 15:
            raise ValueError("Need at least 15 observations for ARIMA order search")

        candidates = []
        p_candidates = [0, 1, 2, 3]
        d_candidates = [0, 1, 2]
        q_candidates = [0, 1, 2, 3]

        for p in p_candidates:
            for d in d_candidates:
                for q in q_candidates:
                    if p == 0 and q == 0 and d == 0:
                        continue
                    try:
                        with warnings.catch_warnings():
                            warnings.simplefilter('ignore')
                            mod = ARIMA(series, order=(p, d, q))
                            fit_res = mod.fit()
                            if not np.isnan(fit_res.aic) and not np.isinf(fit_res.aic):
                                candidates.append({
                                    'order': [p, d, q],
                                    'aic': float(fit_res.aic),
                                    'bic': float(fit_res.bic)
                                })
                    except Exception:
                        continue

        if not candidates:
            # Fallback
            candidates.append({'order': [1, 1, 1], 'aic': 0.0, 'bic': 0.0})

        candidates = sorted(candidates, key=lambda x: x['aic'])
        best_order = candidates[0]['order']

        return {
            'best_order': best_order,
            'candidates': candidates[:10],
            'message': f"Optimal order identified: ARIMA({best_order[0]},{best_order[1]},{best_order[2]}) with AIC={candidates[0]['aic']:.2f}"
        }

    def get_residual_diagnostics(self, data: Dict[str, Any], model_config: Any) -> Dict[str, Any]:
        """Compute comprehensive Box-Jenkins residual diagnostics"""
        fit_result = self.fit_and_forecast(data, model_config)

        records = data.get('records', [])
        value_column = data.get('value_column')
        time_column = data.get('time_column')

        actual_values = [r[value_column] for r in records]
        fitted_values = fit_result['fitted_values']

        # Align actual and fitted
        residuals = []
        dates_clean = []
        for i in range(len(actual_values)):
            if i < len(fitted_values) and fitted_values[i] is not None:
                res = actual_values[i] - fitted_values[i]
                if not np.isnan(res) and not np.isinf(res):
                    residuals.append(float(res))
                    dates_clean.append(records[i].get(time_column, f"t_{i}"))

        res_arr = np.array(residuals)
        if len(res_arr) < 8:
            raise ValueError("Insufficient valid residuals for diagnostic testing")

        # 1. Ljung-Box test for white noise
        lb_lags = max(2, min(10, len(res_arr) // 4))
        lb_df = acorr_ljungbox(res_arr, lags=[lb_lags], return_df=True)
        lb_stat = float(lb_df['lb_stat'].iloc[0])
        lb_pvalue = float(lb_df['lb_pvalue'].iloc[0])
        is_white_noise = bool(lb_pvalue > 0.05)

        # 2. Jarque-Bera test for normality
        jb_stat, jb_pvalue = jarque_bera(res_arr)
        is_normal = bool(jb_pvalue > 0.05)

        # 3. Residual ACF
        acf_lags = max(2, min(20, (len(res_arr) // 2) - 1))
        acf_vals, acf_conf = acf(res_arr, nlags=acf_lags, alpha=0.05)
        conf_limit = 1.96 / np.sqrt(len(res_arr))

        # 4. Histogram and Normal PDF overlay
        counts, bin_edges = np.histogram(res_arr, bins=min(15, len(res_arr)//3), density=True)
        bin_centers = [float((bin_edges[k] + bin_edges[k+1]) / 2) for k in range(len(counts))]
        bin_counts = [float(c) for c in counts]

        x_span = np.linspace(float(np.min(res_arr)), float(np.max(res_arr)), 40)
        norm_pdf = [float(norm.pdf(x, loc=np.mean(res_arr), scale=max(0.0001, np.std(res_arr)))) for x in x_span]

        mean_val = float(np.mean(res_arr))
        std_val = float(np.std(res_arr))

        return {
            'summary': {
                'count': len(res_arr),
                'mean': mean_val,
                'std': std_val,
                'is_mean_near_zero': bool(abs(mean_val) < 0.2 * std_val),
                'is_white_noise': is_white_noise,
                'is_normally_distributed': is_normal,
                'conclusion': (
                    "Residuals satisfy white noise and normality assumptions."
                    if is_white_noise and is_normal else
                    "Residuals appear to be white noise, though distribution exhibits mild skew/kurtosis."
                    if is_white_noise else
                    "Residuals exhibit significant autocorrelation (Ljung-Box p < 0.05). Consider adjusting model order (p, q)."
                )
            },
            'ljung_box': {
                'statistic': lb_stat,
                'p_value': lb_pvalue,
                'lags': lb_lags,
                'is_white_noise': is_white_noise
            },
            'jarque_bera': {
                'statistic': float(jb_stat),
                'p_value': float(jb_pvalue),
                'is_normal': is_normal
            },
            'acf': {
                'lags': list(range(len(acf_vals))),
                'values': [float(x) for x in acf_vals],
                'conf_limit': float(conf_limit)
            },
            'histogram': {
                'bin_centers': bin_centers,
                'densities': bin_counts,
                'x_span': [float(x) for x in x_span],
                'norm_pdf': norm_pdf
            },
            'sequence': {
                'dates': dates_clean,
                'residuals': [float(x) for x in res_arr]
            }
        }

    def backtest_model(self, data: Dict[str, Any], model_config: Any, test_ratio: float = 0.2) -> Dict[str, Any]:
        """Perform out-of-sample holdout backtesting against a naive persistence baseline"""
        records = data.get('records', [])
        value_column = data.get('value_column')
        time_column = data.get('time_column')

        if not records or not value_column:
            raise ValueError("Invalid data format for backtesting")

        n = len(records)
        test_len = max(5, int(n * test_ratio))
        train_len = n - test_len

        train_records = records[:train_len]
        test_records = records[train_len:]

        train_data = {
            'records': train_records,
            'value_column': value_column,
            'time_column': time_column
        }

        # Override forecast periods to exactly test_len
        if hasattr(model_config, 'model_dump'):
            cfg_dict = model_config.model_dump()
        elif hasattr(model_config, 'dict'):
            cfg_dict = model_config.dict()
        else:
            cfg_dict = dict(model_config)

        cfg_dict['forecast_periods'] = test_len

        forecast_res = self.fit_and_forecast(train_data, cfg_dict)

        test_actual = [float(r[value_column]) for r in test_records]
        test_pred = forecast_res['forecast']

        min_eval_len = min(len(test_actual), len(test_pred))
        actual_eval = np.array(test_actual[:min_eval_len])
        pred_eval = np.array(test_pred[:min_eval_len])

        # Test metrics
        test_rmse = float(np.sqrt(mean_squared_error(actual_eval, pred_eval)))
        test_mae = float(mean_absolute_error(actual_eval, pred_eval))

        non_zero = actual_eval != 0
        if np.any(non_zero):
            test_mape = float(np.mean(np.abs((actual_eval[non_zero] - pred_eval[non_zero]) / actual_eval[non_zero])) * 100)
        else:
            test_mape = 0.0

        # Naive benchmark: Persistence forecast (last value of train)
        last_train_val = float(train_records[-1][value_column])
        naive_pred = np.full(min_eval_len, last_train_val)
        naive_rmse = float(np.sqrt(mean_squared_error(actual_eval, naive_pred)))
        naive_mae = float(mean_absolute_error(actual_eval, naive_pred))

        improvement_pct = float(((naive_rmse - test_rmse) / naive_rmse) * 100) if naive_rmse > 0 else 0.0

        train_dates = [r.get(time_column, f"t_{i}") for i, r in enumerate(train_records)]
        test_dates = [r.get(time_column, f"t_{train_len + i}") for i, r in enumerate(test_records)]

        return {
            'train_dates': train_dates,
            'train_actual': [float(r[value_column]) for r in train_records],
            'test_dates': test_dates,
            'test_actual': test_actual,
            'forecast': forecast_res['forecast'],
            'forecast_lower': forecast_res['forecast_lower'],
            'forecast_upper': forecast_res['forecast_upper'],
            'test_metrics': {
                'rmse': test_rmse,
                'mae': test_mae,
                'mape': test_mape,
                'naive_rmse': naive_rmse,
                'naive_mae': naive_mae,
                'improvement_pct': improvement_pct
            }
        }
    
    def auto_select_model(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Automatically select the best model for the data"""
        
        # This is a simplified model selection logic
        # In practice, you'd want more sophisticated selection criteria
        
        records = data.get('records', [])
        if len(records) < 24:
            return {
                'recommended_model': 'arima',
                'parameters': {'order': (1, 1, 1)},
                'reason': 'Insufficient data for seasonal models'
            }
        elif len(records) < 50:
            return {
                'recommended_model': 'holt-winters',
                'parameters': {'trend': 'add', 'seasonal': 'add', 'seasonal_periods': 12},
                'reason': 'Medium-sized dataset suitable for Holt-Winters'
            }
        else:
            return {
                'recommended_model': 'sarima',
                'parameters': {'order': (1, 1, 1), 'seasonal_order': (1, 1, 1, 12)},
                'reason': 'Large dataset suitable for SARIMA'
            }
    
    def validate_parameters(self, model_config: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate model parameters"""
        
        model_type = model_config.get('model_type')
        parameters = model_config.get('parameters', {})
        
        if model_type == 'arima':
            order = parameters.get('order', (1, 1, 1))
            if len(order) != 3 or any(p < 0 for p in order):
                return False, "ARIMA order must be three non-negative integers (p, d, q)"
        
        elif model_type == 'sarima':
            order = parameters.get('order', (1, 1, 1))
            seasonal_order = parameters.get('seasonal_order', (1, 1, 1, 12))
            if len(order) != 3 or len(seasonal_order) != 4:
                return False, "SARIMA requires valid order and seasonal_order parameters"
        
        elif model_type == 'holt-winters':
            trend = parameters.get('trend', 'add')
            seasonal = parameters.get('seasonal', 'add')
            if trend not in ['add', 'mul', None] or seasonal not in ['add', 'mul']:
                return False, "Holt-Winters trend and seasonal must be 'add', 'mul', or None"
        
        return True, "Parameters are valid"

class LSTMModel(BaseTimeSeriesModel):
    """LSTM Neural Network model for time series forecasting"""
    
    def __init__(self, sequence_length: int = 60, lstm_units: int = 50, dropout_rate: float = 0.2):
        if not TF_AVAILABLE:
            raise ImportError("TensorFlow not available. Install with: pip install tensorflow")
            
        self.sequence_length = sequence_length
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.history = None
        self.original_data = None
        
    def fit(self, data: pd.Series, epochs: int = 50, batch_size: int = 32, **kwargs) -> None:
        """Fit LSTM model"""
        try:
            self.original_data = data.values.reshape(-1, 1)
            
            # Scale the data
            scaled_data = self.scaler.fit_transform(self.original_data)
            
            # Create sequences
            X, y = self._create_sequences(scaled_data, self.sequence_length)
            
            if len(X) == 0:
                raise ValueError("Insufficient data for sequence creation")
            
            # Build model
            self.model = Sequential([
                LSTM(self.lstm_units, return_sequences=True, input_shape=(X.shape[1], 1)),
                Dropout(self.dropout_rate),
                LSTM(self.lstm_units, return_sequences=False),
                Dropout(self.dropout_rate),
                Dense(1)
            ])
            
            self.model.compile(optimizer='adam', loss='mean_squared_error')
            
            # Train model
            self.history = self.model.fit(
                X, y,
                epochs=epochs,
                batch_size=batch_size,
                verbose=0,
                validation_split=0.2
            )
            
        except Exception as e:
            raise ValueError(f"LSTM model fitting failed: {str(e)}")
    
    def _create_sequences(self, data, seq_length):
        """Create sequences for LSTM training"""
        X, y = [], []
        for i in range(seq_length, len(data)):
            X.append(data[i-seq_length:i, 0])
            y.append(data[i, 0])
        return np.array(X), np.array(y)
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if not self.model:
            raise ValueError("Model must be fitted before forecasting")
        
        # Use last sequence_length points for prediction
        last_sequence = self.scaler.transform(self.original_data[-self.sequence_length:])
        forecasts = []
        
        current_sequence = last_sequence.copy()
        
        for _ in range(periods):
            # Predict next value
            pred_input = current_sequence.reshape(1, self.sequence_length, 1)
            pred_scaled = self.model.predict(pred_input, verbose=0)[0, 0]
            
            # Inverse transform to get actual value
            pred_actual = self.scaler.inverse_transform([[pred_scaled]])[0, 0]
            forecasts.append(pred_actual)
            
            # Update sequence for next prediction
            current_sequence = np.roll(current_sequence, -1)
            current_sequence[-1, 0] = pred_scaled
        
        # Create confidence intervals (simplified)
        forecast_array = np.array(forecasts)
        std_dev = np.std(forecasts) if len(forecasts) > 1 else np.std(self.original_data) * 0.1
        z_score = 1.96  # 95% confidence interval
        
        return {
            'forecast': forecasts,
            'lower_bound': (forecast_array - z_score * std_dev).tolist(),
            'upper_bound': (forecast_array + z_score * std_dev).tolist()
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if not self.model:
            raise ValueError("Model must be fitted first")
        
        # Create sequences from original data
        scaled_data = self.scaler.transform(self.original_data)
        X, _ = self._create_sequences(scaled_data, self.sequence_length)
        
        if len(X) == 0:
            return np.array([])
        
        # Predict on training data
        predictions_scaled = self.model.predict(X, verbose=0)
        predictions = self.scaler.inverse_transform(predictions_scaled)
        
        # Pad with NaN for the initial sequence_length values
        fitted = np.full(len(self.original_data), np.nan)
        fitted[self.sequence_length:] = predictions.flatten()
        
        return fitted
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        info = {
            'model_type': 'lstm',
            'sequence_length': self.sequence_length,
            'lstm_units': self.lstm_units,
            'dropout_rate': self.dropout_rate
        }
        
        if self.history:
            info['training_loss'] = float(self.history.history['loss'][-1])
            if 'val_loss' in self.history.history:
                info['validation_loss'] = float(self.history.history['val_loss'][-1])
        
        return info

class MovingAverageModel(BaseTimeSeriesModel):
    """Simple Moving Average model"""
    
    def __init__(self, window: int = 12):
        self.window = window
        self.data = None
        self.fitted_values = None
        
    def fit(self, data: pd.Series, **kwargs) -> None:
        """Fit Moving Average model"""
        self.data = data
        self.fitted_values = data.rolling(window=self.window).mean()
    
    def forecast(self, periods: int, confidence_interval: float = 0.95) -> Dict[str, Any]:
        """Generate forecasts"""
        if self.data is None:
            raise ValueError("Model must be fitted before forecasting")
        
        # Simple forecast using last window average
        last_values = self.data.tail(self.window)
        forecast_value = last_values.mean()
        
        # All forecasts are the same value (naive approach)
        forecasts = [forecast_value] * periods
        
        # Simple confidence intervals
        std_dev = last_values.std()
        z_score = 1.96
        
        return {
            'forecast': forecasts,
            'lower_bound': [forecast_value - z_score * std_dev] * periods,
            'upper_bound': [forecast_value + z_score * std_dev] * periods
        }
    
    def get_fitted_values(self) -> np.ndarray:
        """Get fitted values"""
        if self.fitted_values is None:
            raise ValueError("Model must be fitted first")
        return self.fitted_values.values
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            'model_type': 'moving_average',
            'window': self.window
        }

class TimeSeriesAnalyzer:
    """Advanced time series analysis utilities"""
    
    @staticmethod
    def analyze_stationarity(data: pd.Series) -> Dict[str, Any]:
        """Perform stationarity tests"""
        try:
            # Augmented Dickey-Fuller test
            adf_result = adfuller(data.dropna())
            
            return {
                'adf_statistic': float(adf_result[0]),
                'adf_p_value': float(adf_result[1]),
                'is_stationary': adf_result[1] < 0.05,
                'critical_values': {str(k): float(v) for k, v in adf_result[4].items()},
                'recommendation': 'Data is stationary' if adf_result[1] < 0.05 else 'Consider differencing the data'
            }
        except Exception as e:
            return {'error': f'Stationarity analysis failed: {str(e)}'}
    
    @staticmethod
    def decompose_series(data: pd.Series, model: str = 'additive', period: int = 12) -> Dict[str, Any]:
        """Perform time series decomposition"""
        try:
            decomposition = seasonal_decompose(data.dropna(), model=model, period=period)
            
            return {
                'trend': decomposition.trend.dropna().tolist(),
                'seasonal': decomposition.seasonal.dropna().tolist(),
                'residual': decomposition.resid.dropna().tolist(),
                'original': data.tolist()
            }
        except Exception as e:
            return {'error': f'Decomposition failed: {str(e)}'}
    
    @staticmethod
    def detect_outliers(data: pd.Series, method: str = 'iqr') -> Dict[str, Any]:
        """Detect outliers in time series"""
        try:
            if method == 'iqr':
                Q1 = data.quantile(0.25)
                Q3 = data.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outliers = data[(data < lower_bound) | (data > upper_bound)]
                
                return {
                    'method': 'IQR',
                    'outlier_indices': outliers.index.tolist(),
                    'outlier_values': outliers.tolist(),
                    'lower_bound': float(lower_bound),
                    'upper_bound': float(upper_bound),
                    'outlier_count': len(outliers)
                }
            
            elif method == 'z_score':
                z_scores = np.abs((data - data.mean()) / data.std())
                outliers = data[z_scores > 3]
                
                return {
                    'method': 'Z-Score',
                    'outlier_indices': outliers.index.tolist(),
                    'outlier_values': outliers.tolist(),
                    'threshold': 3,
                    'outlier_count': len(outliers)
                }
                
        except Exception as e:
            return {'error': f'Outlier detection failed: {str(e)}'}
    
    @staticmethod
    def suggest_model_parameters(data: pd.Series) -> Dict[str, Any]:
        """Suggest optimal model parameters based on data characteristics"""
        try:
            suggestions = {}
            
            # Basic data analysis
            n = len(data)
            has_trend = abs(data.iloc[-12:].mean() - data.iloc[:12].mean()) > data.std() * 0.5
            
            # Check for seasonality (simple approach)
            if n >= 24:
                # Try common seasonal periods
                seasonal_candidates = [7, 12, 24, 52] if n >= 52 else [7, 12]
                best_seasonal = None
                min_variance = float('inf')
                
                for period in seasonal_candidates:
                    if n >= 2 * period:
                        seasonal_component = data.groupby(data.index % period).mean()
                        variance = seasonal_component.var()
                        if variance < min_variance:
                            min_variance = variance
                            best_seasonal = period
                
                suggestions['seasonal_period'] = best_seasonal
                suggestions['has_seasonality'] = best_seasonal is not None
            
            # ARIMA suggestions
            suggestions['arima'] = {
                'order': (1, 1 if not TimeSeriesAnalyzer.analyze_stationarity(data)['is_stationary'] else 0, 1),
                'reasoning': 'Basic ARIMA configuration based on stationarity test'
            }
            
            # SARIMA suggestions
            if suggestions.get('has_seasonality', False):
                s = suggestions['seasonal_period']
                suggestions['sarima'] = {
                    'order': (1, 1, 1),
                    'seasonal_order': (1, 1, 1, s),
                    'reasoning': f'SARIMA with seasonal period {s}'
                }
            
            # Holt-Winters suggestions
            suggestions['holt_winters'] = {
                'trend': 'add' if has_trend else None,
                'seasonal': 'add' if suggestions.get('has_seasonality', False) else None,
                'seasonal_periods': suggestions.get('seasonal_period', 12),
                'reasoning': 'Holt-Winters configuration based on trend and seasonality detection'
            }
            
            return suggestions
            
        except Exception as e:
            return {'error': f'Parameter suggestion failed: {str(e)}'}

# Update the manager to include new models
class EnhancedTimeSeriesModelManager(TimeSeriesModelManager):
    """Enhanced manager with additional models"""
    
    def __init__(self):
        super().__init__()
        self.models.update({
            'moving_average': MovingAverageModel,
            'moving-average': MovingAverageModel,
        })
        
        if TF_AVAILABLE:
            self.models['lstm'] = LSTMModel
        
        self.analyzer = TimeSeriesAnalyzer()
    
    def analyze_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive data analysis"""
        try:
            # Extract data
            records = data.get('records', [])
            value_column = data.get('value_column')
            time_column = data.get('time_column')
            
            if not records or not value_column:
                raise ValueError("Invalid data format")
            
            df = pd.DataFrame(records)
            
            # Handle time index
            if time_column and time_column in df.columns:
                df[time_column] = pd.to_datetime(df[time_column])
                df = df.set_index(time_column).sort_index()
            
            series = df[value_column].dropna()
            
            analysis = {
                'basic_stats': {
                    'count': len(series),
                    'mean': float(series.mean()),
                    'std': float(series.std()),
                    'min': float(series.min()),
                    'max': float(series.max()),
                    'median': float(series.median())
                },
                'stationarity': self.analyzer.analyze_stationarity(series),
                'outliers': self.analyzer.detect_outliers(series),
                'parameter_suggestions': self.analyzer.suggest_model_parameters(series)
            }
            
            # Add decomposition if enough data
            if len(series) >= 24:
                analysis['decomposition'] = self.analyzer.decompose_series(series)
            
            return analysis
            
        except Exception as e:
            return {'error': f'Data analysis failed: {str(e)}'}
    
    def get_available_models(self) -> Dict[str, Any]:
        """Enhanced model information"""
        model_info = super().get_available_models()
        
        model_info.update({
            'moving_average': {
                'name': 'Moving Average',
                'description': 'Simple moving average forecasting',
                'parameters': ['window'],
                'suitable_for': 'Stable time series without strong trends'
            }
        })
        
        if TF_AVAILABLE:
            model_info['lstm'] = {
                'name': 'LSTM',
                'description': 'Long Short-Term Memory Neural Network',
                'parameters': ['sequence_length', 'lstm_units', 'dropout_rate'],
                'suitable_for': 'Complex non-linear patterns'
            }
        
        return model_info