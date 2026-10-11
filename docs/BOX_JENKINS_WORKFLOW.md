# Box-Jenkins 3-Stage Methodology: Execution Workflow

The Box-Jenkins methodology (1970) is an iterative strategy for identifying, fitting, and validating Autoregressive Integrated Moving Average (ARIMA) models.

---

## Stage 1: Identification

### Objective:
1. Ensure the sequence is stationary in both mean and variance.
2. Formulate candidate orders $(p, d, q)$ and seasonal orders $(P, D, Q)_s$.

```
[Raw Time Series]
       │
       ▼
[Variance Stabilization] ──► (Box-Cox or Log Transform if heteroskedastic)
       │
       ▼
[Check Stationarity (ADF & KPSS)]
       │
       ├──► Non-Stationary (ADF p > 0.05) ──► Differencing: d = d + 1
       │
       └──► Stationary (ADF p <= 0.05, KPSS p > 0.05)
              │
              ▼
    [Plot ACF & PACF]
              │
              ├── PACF cuts off at lag p, ACF dies out exponentially ──► AR(p) candidate
              ├── ACF cuts off at lag q, PACF dies out exponentially ──► MA(q) candidate
              └── Both tails damp slowly ────────────────────────────► Mixed ARMA(p, q)
```

---

## Stage 2: Estimation & Parameter Selection

### Objective:
Estimate parameters $(\phi_1 \dots \phi_p, \theta_1 \dots \theta_q)$ via Maximum Likelihood Estimation (MLE) or Conditional Sum of Squares (CSS).

### Grid Search Strategy:
Run automated combinatorial grid search over bounded parameter space:
- $p \in [0, 3]$
- $d \in [0, 2]$
- $q \in [0, 3]$
- $P \in [0, 2], D \in [0, 1], Q \in [0, 2]$ if seasonality is detected.

Select models minimizing:
$$\text{AIC} = 2k - 2\ln(\hat{L})$$

---

## Stage 3: Diagnostic Checking

### Objective:
Verify whether residual errors $e_t = Y_t - \hat{Y}_t$ resemble pure white noise:
$$e_t \stackrel{i.i.d.}{\sim} \mathcal{N}(0, \sigma^2)$$

### Key Diagnostic Checks:
1. **Ljung-Box Test on Residuals:**
   - Null hypothesis: Errors are unautocorrelated.
   - Requirement: $p$-value $> 0.05$. If $p < 0.05$, residual structure remains $\implies$ increment $p$ or $q$.
2. **Normality & Zero Mean:**
   - Jarque-Bera test $p > 0.05$ indicates Gaussian residual distribution.
   - Residual mean $\approx 0$.
3. **Out-of-Sample Holdout Backtesting:**
   - Verify performance on last 20% unseen test observations vs. Naive random-walk baseline.
