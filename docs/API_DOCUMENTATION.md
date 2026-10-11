# ATSA Playground: REST API Specification

The ATSA backend is powered by FastAPI. OpenAPI Swagger documentation is exposed at `/docs`.

---

## 1. Data Endpoints (`/api/data`)

### `GET /api/data/datasets`
Lists available built-in sample time-series datasets with row count, frequency, and descriptions.

### `GET /api/data/datasets/{name}`
Fetches records for a specific built-in dataset (e.g. `monthly_sales`, `stock_prices`, `daily_temperature`).

### `GET /api/data/yfinance/{symbol}`
Fetches historical market data for any Yahoo Finance ticker.
- **Query Parameters:**
  - `period` (string, default: `1y`): `1mo`, `3mo`, `6mo`, `1y`, `2y`, `5y`, `max`
  - `interval` (string, default: `1d`): `1d`, `1wk`, `1mo`
- **Response:**
  ```json
  {
    "symbol": "AAPL",
    "records": [
      { "date": "2024-01-02", "close": 185.64, "volume": 82488700 }
    ],
    "meta": { "currency": "USD", "count": 252 }
  }
  ```

---

## 2. Statistical Analysis Endpoints (`/api/analysis`)

### `POST /api/analysis/stationarity`
Computes Augmented Dickey-Fuller (ADF) and KPSS statistical tests.

### `POST /api/analysis/decompose`
Computes classical additive or multiplicative seasonal decomposition into Trend, Seasonal, and Residual components.

### `POST /api/analysis/autocorrelation`
Computes sample Autocorrelation (ACF) and Partial Autocorrelation (PACF) values with confidence bands.

---

## 3. Modeling & Evaluation Endpoints (`/api/models`)

### `POST /api/models/auto-arima`
Executes automated parameter grid search minimizing AIC over candidate $(p, d, q)$ orders.

### `POST /api/models/residual-diagnostics`
Evaluates fitted model residuals using Ljung-Box test, Jarque-Bera test, residual ACF, and histogram distribution.

### `POST /api/models/backtest`
Performs train/test holdout evaluation (e.g. 80% train, 20% test) comparing model against Naive persistence baseline.

### `POST /api/models/compare`
Runs AutoML benchmark comparison across ARIMA, SARIMA, Holt-Winters, and Moving Average models.
