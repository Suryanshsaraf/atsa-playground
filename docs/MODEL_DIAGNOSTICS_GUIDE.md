# Time Series Model Diagnostics & Evaluation Metrics Guide

This guide explains how to interpret each diagnostic metric and test reported in the ATSA Playground platform.

---

## 1. Forecast Error Metrics

### 1.1 Root Mean Squared Error (RMSE)
$$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{t=1}^n (y_t - \hat{y}_t)^2}$$
- **Characteristics:** Penalizes large outlier forecast errors heavily due to squaring. Expressed in identical units as original series.

### 1.2 Mean Absolute Error (MAE)
$$\text{MAE} = \frac{1}{n} \sum_{t=1}^n |y_t - \hat{y}_t|$$
- **Characteristics:** Linear penalty; robust to extreme spikes and volatile shocks.

### 1.3 Mean Absolute Percentage Error (MAPE)
$$\text{MAPE} = \frac{100\%}{n} \sum_{t=1}^n \left| \frac{y_t - \hat{y}_t}{y_t} \right|$$
- **Rule of Thumb:**
  - $< 10\%$: Highly accurate forecasting.
  - $10\% - 20\%$: Good forecast quality.
  - $20\% - 50\%$: Reasonable forecast.
  - $> 50\%$: Inaccurate / weak predictive power.

---

## 2. Statistical Diagnostic Tests

| Test | Statistic | Null Hypothesis ($H_0$) | Desired Outcome |
| :--- | :--- | :--- | :--- |
| **ADF Test** | Augmented Dickey-Fuller $\tau$ | Unit root exists (Non-stationary) | $p \le 0.05 \implies$ Stationary |
| **KPSS Test** | LM statistic | Series is trend-stationary | $p > 0.05 \implies$ Stationary |
| **Ljung-Box** | $Q(h)$ statistic | Residuals are uncorrelated (White Noise) | $p > 0.05 \implies$ Valid Model |
| **Jarque-Bera** | $\chi^2(2)$ statistic | Residuals are normally distributed | $p > 0.05 \implies$ Gaussian errors |

---

## 3. Naive Baseline Benchmark

The benchmark uses a **Random Walk Naive Persistence** forecast:
$$\hat{Y}_{T+h} = Y_T \quad \forall h \ge 1$$
Any complex statistical or machine learning model **must beat** this Naive benchmark's RMSE and MAE on out-of-sample holdout data to justify its mathematical complexity.
