from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from ..models.time_series_models import EnhancedTimeSeriesModelManager
from ..utils.schemas import ModelConfig, ModelResult, ForecastRequest, ForecastResponse

router = APIRouter()
model_manager = EnhancedTimeSeriesModelManager()

@router.post("/fit", response_model=ForecastResponse)
async def fit_model(request: ForecastRequest):
    """Fit a time series model and generate forecasts"""
    try:
        result = model_manager.fit_and_forecast(
            data=request.data,
            model_config=request.model_configuration
        )
        return ForecastResponse(
            success=True,
            result=result,
            message=f"Successfully fitted {request.model_configuration.model_type} model"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model fitting failed: {str(e)}")

@router.post("/compare")
async def compare_models(data: Dict[str, Any]):
    """Compare multiple models on the same dataset"""
    try:
        models = data.get('models', [])
        dataset = data.get('data', {})
        
        results = []
        for model_config in models:
            result = model_manager.fit_and_forecast(dataset, ModelConfig(**model_config))
            results.append(result)
        
        # Rank models by performance
        comparison = model_manager.compare_models(results)
        
        return {
            "success": True,
            "results": results,
            "comparison": comparison,
            "best_model": comparison["best_model"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model comparison failed: {str(e)}")

@router.get("/available-models")
async def get_available_models():
    """Get list of available model types and their parameters"""
    return {
        "success": True,
        "models": model_manager.get_available_models()
    }

@router.post("/auto-arima")
async def auto_arima_search(data: Dict[str, Any]):
    """Perform Auto-ARIMA grid search to identify optimal (p,d,q)"""
    try:
        dataset = data.get('data', data)
        result = model_manager.auto_arima_grid_search(dataset)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto-ARIMA search failed: {str(e)}")

@router.post("/residual-diagnostics")
async def get_residual_diagnostics(data: Dict[str, Any]):
    """Compute Box-Jenkins residual diagnostics (Ljung-Box, Jarque-Bera, residual ACF)"""
    try:
        dataset = data.get('data', {})
        config = data.get('model_configuration', {})
        result = model_manager.get_residual_diagnostics(dataset, config)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Residual diagnostics failed: {str(e)}")

@router.post("/backtest")
async def backtest_model(data: Dict[str, Any]):
    """Perform train/test holdout backtesting against a naive persistence baseline"""
    try:
        dataset = data.get('data', {})
        config = data.get('model_configuration', {})
        test_ratio = float(data.get('test_ratio', 0.2))
        result = model_manager.backtest_model(dataset, config, test_ratio)
        return {
            "success": True,
            "result": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtesting failed: {str(e)}")

@router.post("/auto-select")
async def auto_select_model(data: Dict[str, Any]):
    """Automatically select the best model for the dataset"""
    try:
        best_model = model_manager.auto_select_model(data)
        return {
            "success": True,
            "recommended_model": best_model,
            "message": "Automatically selected best model based on data characteristics"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto model selection failed: {str(e)}")

@router.post("/validate-parameters")
async def validate_model_parameters(model_config: Dict[str, Any]):
    """Validate model parameters"""
    try:
        is_valid, message = model_manager.validate_parameters(model_config)
        return {
            "success": True,
            "is_valid": is_valid,
            "message": message
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parameter validation failed: {str(e)}")