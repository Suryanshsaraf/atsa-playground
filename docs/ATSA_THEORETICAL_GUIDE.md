# Applied Time Series Analysis (ATSA): Theoretical Foundations & Formulations

This document outlines the mathematical framework, stochastic assumptions, and statistical foundations powering the ATSA Playground modeling engine.

---

## 1. Stochastic Processes & Stationarity

A time series $\{Y_t\}_{t \in \mathbb{Z}}$ is a stochastic process.

### 1.1 Strict vs. Weak (Covariance) Stationarity
- **Strict Stationarity:** The joint distribution of $(Y_{t_1}, Y_{t_2}, \dots, Y_{t_k})$ is invariant under time shifts:
  $$F(y_{t_1}, \dots, y_{t_k}) = F(y_{t_1 + \tau}, \dots, y_{t_k + \tau}) \quad \forall \tau \in \mathbb{Z}$$

- **Weak (Wide-Sense) Stationarity:**
  1. Constant mean: $\mathbb{E}[Y_t] = \mu \quad \forall t$
  2. Finite, time-invariant variance: $\text{Var}(Y_t) = \sigma^2 < \infty$
  3. Autocovariance depends only on lag $k$:
     $$\gamma(k) = \text{Cov}(Y_t, Y_{t-k}) = \mathbb{E}[(Y_t - \mu)(Y_{t-k} - \mu)]$$

### 1.2 Autocorrelation Function (ACF) & Partial Autocorrelation (PACF)
- **ACF at lag $k$:**
  $$\rho_k = \frac{\gamma(k)}{\gamma(0)} = \frac{\text{Cov}(Y_t, Y_{t-k})}{\text{Var}(Y_t)}$$

- **PACF at lag $k$ ($\phi_{kk}$):** Correlation between $Y_t$ and $Y_{t-k}$ after partialling out linear dependence on intermediate lags $(Y_{t-1}, \dots, Y_{t-k+1})$:
  $$Y_t = \phi_{k1} Y_{t-1} + \phi_{k2} Y_{t-2} + \dots + \phi_{kk} Y_{t-k} + \epsilon_t$$

---

## 2. Statistical Stationarity Tests

### 2.1 Augmented Dickey-Fuller (ADF) Test
Tests the null hypothesis of a unit root against a stationary alternative:
$$\Delta Y_t = \alpha + \beta t + \gamma Y_{t-1} + \sum_{i=1}^p \delta_i \Delta Y_{t-i} + \epsilon_t$$
- $H_0: \gamma = 0$ (Unit root exists $\implies$ Non-stationary)
- $H_1: \gamma < 0$ (Stationary)
- **Decision:** If $p \le 0.05$, reject $H_0$ and conclude the series is stationary.

### 2.2 KPSS (Kwiatkowski-Phillips-Schmidt-Shin) Test
Tests the null hypothesis that an observable series is stationary around a deterministic trend:
$$Y_t = r_t + \beta t + \epsilon_t, \quad r_t = r_{t-1} + u_t, \quad u_t \sim \text{i.i.d.}(0, \sigma_u^2)$$
- $H_0: \sigma_u^2 = 0$ (Stationary)
- $H_1: \sigma_u^2 > 0$ (Unit root present)
- **Dual Confirmation:**
  - ADF $p < 0.05$ AND KPSS $p > 0.05 \implies$ Confirmed stationary.

---

## 3. ARIMA Model Specifications

### 3.1 Autoregressive Process $\text{AR}(p)$
$$Y_t = c + \sum_{i=1}^p \phi_i Y_{t-i} + \epsilon_t, \quad \epsilon_t \sim \text{WN}(0, \sigma^2)$$
In lag polynomial notation: $\Phi(B) Y_t = c + \epsilon_t$ where $B^k Y_t = Y_{t-k}$.

### 3.2 Moving Average Process $\text{MA}(q)$
$$Y_t = \mu + \epsilon_t + \sum_{j=1}^q \theta_j \epsilon_{t-j}$$
In lag polynomial notation: $Y_t = \mu + \Theta(B) \epsilon_t$.

### 3.3 $\text{ARIMA}(p, d, q)$ Integration
For non-stationary series requiring $d$-th order differencing:
$$\nabla^d Y_t = (1 - B)^d Y_t$$
$$\Phi(B)(1 - B)^d Y_t = c + \Theta(B)\epsilon_t$$

### 3.4 Seasonal $\text{SARIMA}(p, d, q) \times (P, D, Q)_s$
Incorporates seasonal lag polynomials $\Phi_P(B^s)$ and $\Theta_Q(B^s)$ with seasonal lag period $s$:
$$\Phi_p(B) \Phi_P(B^s)(1 - B)^d (1 - B^s)^D Y_t = c + \Theta_q(B) \Theta_Q(B^s)\epsilon_t$$

---

## 4. Model Selection & Diagnostic Criteria

### 4.1 Information Criteria
- **Akaike Information Criterion (AIC):**
  $$\text{AIC} = 2k - 2\ln(\hat{L})$$
  Penalizes parameter count $k$ to avoid overfitting.
- **Bayesian Information Criterion (BIC):**
  $$\text{BIC} = k\ln(n) - 2\ln(\hat{L})$$

### 4.2 Residual Diagnostic Tests
- **Ljung-Box Test (White Noise Check):**
  $$Q = n(n+2) \sum_{k=1}^h \frac{\hat{\rho}_k^2}{n-k} \sim \chi^2(h)$$
  - $H_0$: Residuals are uncorrelated (White Noise).
  - Desired: $p > 0.05$ (Fail to reject $H_0$).

- **Jarque-Bera Test (Normality Check):**
  $$JB = \frac{n}{6}\left(S^2 + \frac{(K-3)^2}{4}\right)$$
  Where $S$ is skewness and $K$ is kurtosis.
