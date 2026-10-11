import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Plot from 'react-plotly.js';
import Papa from 'papaparse';
import {
  TrendingUp,
  BarChart3,
  Layers,
  ShieldCheck,
  Download,
  Upload,
  Play,
  Sparkles,
  Cpu,
  Target,
  Microscope,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ArrowUpRight,
  Info,
  Trophy,
  Award,
  ArrowRight,
  Globe,
  Search,
  Keyboard
} from 'lucide-react';
import API from '../services/api';
import { useTheme } from '../App';
import { KeyboardShortcutsModal } from '../components/common/KeyboardShortcutsModal';
import { ThemeToggle } from '../components/common/ThemeToggle';

const SimplePlaygroundPage: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Connection & Dataset State
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [sampleDatasets, setSampleDatasets] = useState<any[]>([]);
  const [selectedDatasetName, setSelectedDatasetName] = useState<string>('stock_prices');
  const [currentData, setCurrentData] = useState<any>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  // Data Source Mode & yfinance State
  const [dataMode, setDataMode] = useState<'preset' | 'yfinance'>('preset');
  const [tickerSymbol, setTickerSymbol] = useState<string>('AAPL');
  const [tickerPeriod, setTickerPeriod] = useState<string>('1y');
  const [loadingTicker, setLoadingTicker] = useState<boolean>(false);

  // Model & Parameters State
  const [selectedModel, setSelectedModel] = useState<string>('arima');
  const [arimaOrder, setArimaOrder] = useState<{ p: number; d: number; q: number }>({ p: 1, d: 1, q: 1 });
  const [sarimaOrder, setSarimaOrder] = useState<{ p: number; d: number; q: number; P: number; D: number; Q: number; s: number }>({
    p: 1,
    d: 1,
    q: 1,
    P: 1,
    D: 0,
    Q: 0,
    s: 12
  });
  const [hwTrend, setHwTrend] = useState<string>('add');
  const [hwSeasonal, setHwSeasonal] = useState<string>('add');
  const [hwPeriods, setHwPeriods] = useState<number>(12);
  const [maWindow, setMaWindow] = useState<number>(10);
  const [forecastPeriods, setForecastPeriods] = useState<number>(15);
  const [confidenceInterval, setConfidenceInterval] = useState<number>(0.95);

  // High-Level Workflow View Modes
  // 1. 'forecast': Primary Forecast & Modeling (with optional Holdout Backtest toggle)
  // 2. 'comparison': Benchmark & Compare all candidate models (AutoML Leaderboard)
  // 3. 'exploration': EDA, Stationarity (ADF/KPSS), Decomposition, ACF/PACF, Rolling Stats
  // 4. 'diagnostics': Box-Jenkins Step 3 Residual Diagnostics
  const [viewMode, setViewMode] = useState<'forecast' | 'comparison' | 'exploration' | 'diagnostics'>('forecast');
  
  // Model Comparison State
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState<boolean>(false);
  
  // Secondary filter for Exploration Mode
  const [edaTab, setEdaTab] = useState<'stationarity' | 'decomposition' | 'acfpacf' | 'rolling'>('stationarity');

  // Toggle for Holdout Backtest in Forecast Mode
  const [enableBacktest, setEnableBacktest] = useState<boolean>(false);
  const [backtestTestRatio, setBacktestTestRatio] = useState<number>(0.2);

  // Execution & Diagnostics Data
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const [decompData, setDecompData] = useState<any>(null);
  const [loadingDecomp, setLoadingDecomp] = useState<boolean>(false);

  const [acfData, setAcfData] = useState<any>(null);
  const [loadingAcf, setLoadingAcf] = useState<boolean>(false);

  const [rollingData, setRollingData] = useState<any>(null);
  const [loadingRolling, setLoadingRolling] = useState<boolean>(false);

  const [stationarityData, setStationarityData] = useState<any>(null);
  const [loadingStationarity, setLoadingStationarity] = useState<boolean>(false);

  const [residualDiagData, setResidualDiagData] = useState<any>(null);
  const [loadingResidualDiag, setLoadingResidualDiag] = useState<boolean>(false);

  const [backtestData, setBacktestData] = useState<any>(null);
  const [loadingBacktest, setLoadingBacktest] = useState<boolean>(false);

  // Auto-ARIMA State
  const [autoArimaResults, setAutoArimaResults] = useState<any>(null);
  const [loadingAutoArima, setLoadingAutoArima] = useState<boolean>(false);
  const [showAutoArimaModal, setShowAutoArimaModal] = useState<boolean>(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    initializePlayground();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '?') {
        setIsShortcutsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
      } else if (e.key === '1') {
        setViewMode('forecast');
      } else if (e.key === '2') {
        setViewMode('comparison');
      } else if (e.key === '3') {
        setViewMode('exploration');
      } else if (e.key === '4') {
        setViewMode('diagnostics');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initializePlayground = async () => {
    try {
      const isConnected = await API.Health.checkBackendHealth();
      setBackendConnected(isConnected);

      if (isConnected) {
        const datasets = await API.Data.getSampleDatasets();
        setSampleDatasets(datasets);
        await loadDatasetByName('stock_prices');
      } else {
        loadOfflineDemo();
      }
    } catch (e) {
      console.warn('Backend not detected, activating GitHub Pages demo mode:', e);
      setBackendConnected(false);
      loadOfflineDemo();
    }
  };

  const loadOfflineDemo = () => {
    const demoDatasets = [
      {
        name: 'stock_prices',
        title: 'Stock Prices (AAPL Demo)',
        description: 'Simulated daily stock prices with volatility and trend'
      },
      {
        name: 'monthly_sales',
        title: 'Monthly Retail Sales',
        description: 'Retail sales volume showing seasonal cycles'
      },
      {
        name: 'airline_passengers',
        title: 'Airline Passenger Growth',
        description: 'Classic Box-Jenkins airline passenger series'
      }
    ];
    setSampleDatasets(demoDatasets);

    const dates = Array.from({ length: 60 }, (_, i) => `2024-0${Math.floor(i / 20) + 1}-${String((i % 28) + 1).padStart(2, '0')}`);
    const records = dates.map((d, i) => ({
      date: d,
      price: Number((160 + 0.5 * i + 8 * Math.sin(i / 3) + Math.cos(i * 1.5) * 3).toFixed(2))
    }));

    const demoObj = {
      name: 'stock_prices',
      title: 'Stock Prices (AAPL Demo)',
      records: records,
      value_column: 'price',
      time_column: 'date',
      description: 'Interactive demo dataset running on GitHub Pages'
    };

    setCurrentData(demoObj);
    setSelectedDatasetName('stock_prices');
    resetDiagnosticsState();
    runModelWithData(demoObj, selectedModel);
  };

  const resetDiagnosticsState = () => {
    setAnalysisResult(null);
    setDecompData(null);
    setAcfData(null);
    setRollingData(null);
    setStationarityData(null);
    setResidualDiagData(null);
    setBacktestData(null);
    setAutoArimaResults(null);
    setComparisonData(null);
  };

  const loadDatasetByName = async (datasetName: string) => {
    if (!datasetName) return;
    setSelectedDatasetName(datasetName);
    try {
      const data = await API.Data.loadSampleDataset(datasetName);
      if (data && data.records) {
        setCurrentData(data);
        resetDiagnosticsState();
        showToast(`Loaded ${data.title || datasetName} dataset (${data.records.length} pts)`);
        runModelWithData(data, selectedModel);
      }
    } catch (error) {
      console.error('Failed to load dataset:', error);
      showToast('Error loading dataset');
    }
  };

  const fetchMarketData = async (symbolToFetch?: string) => {
    const sym = (symbolToFetch || tickerSymbol).trim().toUpperCase();
    if (!sym) {
      showToast('Enter a valid stock ticker symbol (e.g. AAPL)');
      return;
    }
    setLoadingTicker(true);
    try {
      const data = await API.Data.fetchYFinance(sym, tickerPeriod);
      if (data && data.records && data.records.length > 0) {
        setCurrentData(data);
        setSelectedDatasetName('');
        setTickerSymbol(sym);
        resetDiagnosticsState();
        showToast(`Loaded ${data.title} (${data.records.length} trading days)`);
        runModelWithData(data, selectedModel);
      } else {
        showToast(`Ticker ${sym} not found or no data available`);
      }
    } catch (err: any) {
      console.error('yfinance error:', err);
      showToast(`Error fetching ${sym}: ${err?.message || 'Symbol not found'}`);
    } finally {
      setLoadingTicker(false);
    }
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const records = results.data as any[];
        if (!records || records.length < 10) {
          showToast('File must contain at least 10 rows.');
          return;
        }

        const keys = Object.keys(records[0]);
        const timeCol = keys.find(k => /date|time|timestamp|period|day|month|year/i.test(k)) || keys[0];
        const valueCol = keys.find(k => k !== timeCol && typeof records[0][k] === 'number') || keys[1] || keys[0];

        const customObj = {
          name: file.name,
          title: file.name.replace(/\.[^/.]+$/, ''),
          records: records,
          value_column: valueCol,
          time_column: timeCol,
          description: `Custom: ${file.name}`
        };

        setCurrentData(customObj);
        setSelectedDatasetName('');
        resetDiagnosticsState();
        showToast(`Uploaded ${records.length} observations`);
        runModelWithData(customObj, selectedModel);
      },
      error: (err) => {
        console.error('CSV parse error:', err);
        showToast('Error parsing CSV file');
      }
    });
  };

  const buildModelConfig = (modelType: string) => {
    let parameters: Record<string, any> = {};

    switch (modelType) {
      case 'arima':
        parameters = { order: [arimaOrder.p, arimaOrder.d, arimaOrder.q] };
        break;
      case 'sarima':
        parameters = {
          order: [sarimaOrder.p, sarimaOrder.d, sarimaOrder.q],
          seasonal_order: [sarimaOrder.P, sarimaOrder.D, sarimaOrder.Q, sarimaOrder.s]
        };
        break;
      case 'holt_winters':
        parameters = {
          trend: hwTrend === 'none' ? null : hwTrend,
          seasonal: hwSeasonal === 'none' ? null : hwSeasonal,
          seasonal_periods: hwSeasonal === 'none' ? null : hwPeriods
        };
        break;
      case 'moving_average':
        parameters = { window: maWindow };
        break;
      default:
        parameters = { order: [1, 1, 1] };
    }

    return {
      model_type: modelType,
      parameters,
      forecast_periods: forecastPeriods,
      confidence_interval: confidenceInterval
    };
  };

  const runModelWithData = async (dataToUse: any, modelType: string) => {
    if (!dataToUse || !dataToUse.records) return;
    setIsAnalyzing(true);
    try {
      if (backendConnected) {
        const config = buildModelConfig(modelType);
        const result = await API.Models.fitModel(dataToUse, config);
        if (result) {
          setAnalysisResult(result);
          setResidualDiagData(null);
          setBacktestData(null);
          showToast(`${modelType.toUpperCase()} fitted successfully`);
          setIsAnalyzing(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend fit error, using client simulation:', err);
    } finally {
      setIsAnalyzing(false);
    }

    // Client-side simulation fallback for GitHub Pages
    try {
      const records = dataToUse.records || [];
      const valCol = dataToUse.value_column;
      const values: number[] = records.map((r: any) => Number(r[valCol]) || 0);
      const n = values.length;
      const lastVal = values[n - 1] || 100;
      const slope = n > 1 ? (values[n - 1] - values[0]) / n : 0.5;
      const std = Math.sqrt(values.reduce((acc: number, v: number) => acc + Math.pow(v - (values[0] + slope * n / 2), 2), 0) / Math.max(1, n)) || 5;

      const forecastVals = Array.from({ length: forecastPeriods }, (_, i) => {
        const step = i + 1;
        const seasonal = 4 * Math.sin((2 * Math.PI * step) / 12);
        return Number((lastVal + slope * step + seasonal).toFixed(2));
      });

      const forecastLower = forecastVals.map(f => Number((f - 1.96 * std).toFixed(2)));
      const forecastUpper = forecastVals.map(f => Number((f + 1.96 * std).toFixed(2)));
      const fittedVals = values.map((v: number, i: number) => Number((v * 0.98 + (i % 2 === 0 ? 0.5 : -0.5)).toFixed(2)));
      const forecastDates = Array.from({ length: forecastPeriods }, (_, i) => `+${i + 1}`);

      setAnalysisResult({
        model_type: modelType,
        fitted_values: fittedVals,
        forecast: forecastVals,
        forecast_lower: forecastLower,
        forecast_upper: forecastUpper,
        forecast_dates: forecastDates,
        metrics: {
          rmse: Number((std * 0.42).toFixed(3)),
          mae: Number((std * 0.31).toFixed(3)),
          mape: 3.4
        }
      });
      showToast(`${modelType.toUpperCase()} rendered (Demo Mode)`);
    } catch (e) {
      console.error('Offline forecast simulation error:', e);
    }
  };

  const runAnalysis = () => {
    if (!currentData) {
      showToast('Select a dataset first');
      return;
    }
    runModelWithData(currentData, selectedModel);
  };

  // Auto-ARIMA Grid Search
  const runAutoArimaSearch = async () => {
    if (!currentData) return;
    setLoadingAutoArima(true);
    try {
      const res = await API.Models.autoArima(currentData);
      if (res && res.best_order) {
        setAutoArimaResults(res);
        setArimaOrder({
          p: res.best_order[0],
          d: res.best_order[1],
          q: res.best_order[2]
        });
        setSelectedModel('arima');
        setShowAutoArimaModal(true);
        showToast(`Optimal ARIMA(${res.best_order.join(',')}) found!`);

        const config = {
          model_type: 'arima',
          parameters: { order: res.best_order },
          forecast_periods: forecastPeriods,
          confidence_interval: confidenceInterval
        };
        const newResult = await API.Models.fitModel(currentData, config);
        if (newResult) setAnalysisResult(newResult);
      }
    } catch (err) {
      console.error('Auto-ARIMA error:', err);
      showToast('Auto-ARIMA search failed');
    } finally {
      setLoadingAutoArima(false);
    }
  };

  // Residual Diagnostics Fetch
  const fetchResidualDiagnostics = async () => {
    if (!currentData) return;
    setLoadingResidualDiag(true);
    try {
      const config = buildModelConfig(selectedModel);
      const res = await API.Models.residualDiagnostics(currentData, config);
      if (res) setResidualDiagData(res);
    } catch (err) {
      console.error('Residual diagnostics error:', err);
      showToast('Diagnostic evaluation failed');
    } finally {
      setLoadingResidualDiag(false);
    }
  };

  // Holdout Backtest Fetch
  const fetchBacktest = async () => {
    if (!currentData) return;
    setLoadingBacktest(true);
    try {
      const config = buildModelConfig(selectedModel);
      const res = await API.Models.backtest(currentData, config, backtestTestRatio);
      if (res) setBacktestData(res);
    } catch (err) {
      console.error('Backtest error:', err);
      showToast('Backtest evaluation failed');
    } finally {
      setLoadingBacktest(false);
    }
  };

  const fetchDecomposition = async () => {
    if (!currentData) return;
    setLoadingDecomp(true);
    try {
      const res = await API.Analysis.decomposeTimeSeries(currentData, 'additive', hwPeriods || 12);
      if (res) setDecompData(res);
    } catch (e) {
      console.error(e);
      showToast('Decomposition failed');
    } finally {
      setLoadingDecomp(false);
    }
  };

  const fetchACFPACF = async () => {
    if (!currentData) return;
    setLoadingAcf(true);
    try {
      const res = await API.Analysis.calculateACFPACF(currentData, 20);
      if (res) setAcfData(res);
    } catch (e) {
      console.error(e);
      showToast('ACF/PACF calculation failed');
    } finally {
      setLoadingAcf(false);
    }
  };

  const fetchRollingStats = async () => {
    if (!currentData) return;
    setLoadingRolling(true);
    try {
      const res = await API.Analysis.calculateRollingStats(currentData, maWindow || 12);
      if (res) setRollingData(res);
    } catch (e) {
      console.error(e);
      showToast('Rolling stats calculation failed');
    } finally {
      setLoadingRolling(false);
    }
  };

  const fetchStationarity = async () => {
    if (!currentData) return;
    setLoadingStationarity(true);
    try {
      const res = await API.Analysis.testStationarity(currentData);
      if (res) setStationarityData(res);
    } catch (e) {
      console.error(e);
      showToast('Stationarity test failed');
    } finally {
      setLoadingStationarity(false);
    }
  };

  const runModelComparison = async () => {
    if (!currentData || !currentData.records) {
      showToast('Select a dataset first');
      return;
    }
    setLoadingComparison(true);
    try {
      const modelsToCompare = [
        {
          model_type: 'arima',
          parameters: { order: [arimaOrder.p, arimaOrder.d, arimaOrder.q] },
          forecast_periods: forecastPeriods,
          confidence_interval: confidenceInterval
        },
        {
          model_type: 'sarima',
          parameters: {
            order: [sarimaOrder.p, sarimaOrder.d, sarimaOrder.q],
            seasonal_order: [sarimaOrder.P, sarimaOrder.D, sarimaOrder.Q, sarimaOrder.s]
          },
          forecast_periods: forecastPeriods,
          confidence_interval: confidenceInterval
        },
        {
          model_type: 'holt_winters',
          parameters: {
            trend: hwTrend === 'none' ? null : hwTrend,
            seasonal: hwSeasonal === 'none' ? null : hwSeasonal,
            seasonal_periods: hwSeasonal === 'none' ? null : hwPeriods
          },
          forecast_periods: forecastPeriods,
          confidence_interval: confidenceInterval
        },
        {
          model_type: 'moving_average',
          parameters: { window: maWindow },
          forecast_periods: forecastPeriods,
          confidence_interval: confidenceInterval
        }
      ];

      const res = await API.Models.compareModels(currentData, modelsToCompare);
      if (res && res.results) {
        setComparisonData(res);
        showToast(`Benchmarked 4 models! Best: ${res.best_model?.toUpperCase()}`);
      } else {
        showToast('Model comparison failed');
      }
    } catch (err) {
      console.error('Comparison error:', err);
      showToast('Model comparison failed');
    } finally {
      setLoadingComparison(false);
    }
  };

  // Reactive lazy data fetcher based on current view mode
  useEffect(() => {
    if (viewMode === 'comparison' && !comparisonData && !loadingComparison) {
      runModelComparison();
    } else if (viewMode === 'diagnostics' && !residualDiagData) {
      fetchResidualDiagnostics();
    } else if (viewMode === 'exploration') {
      if (edaTab === 'stationarity' && !stationarityData) fetchStationarity();
      else if (edaTab === 'decomposition' && !decompData) fetchDecomposition();
      else if (edaTab === 'acfpacf' && !acfData) fetchACFPACF();
      else if (edaTab === 'rolling' && !rollingData) fetchRollingStats();
    } else if (viewMode === 'forecast' && enableBacktest && !backtestData) {
      fetchBacktest();
    }
  }, [viewMode, edaTab, enableBacktest, currentData, selectedModel]);

  // Export CSV
  const handleExportCSV = () => {
    if (!analysisResult || !analysisResult.forecast) {
      showToast('No forecast available to export');
      return;
    }

    const dates = analysisResult.forecast_dates || [];
    const forecasts = analysisResult.forecast || [];
    const lower = analysisResult.forecast_lower || [];
    const upper = analysisResult.forecast_upper || [];

    let csvContent = 'data:text/csv;charset=utf-8,Period,Forecast,Lower_CI,Upper_CI\n';
    for (let i = 0; i < forecasts.length; i++) {
      const d = dates[i] || `Period_${i + 1}`;
      const f = forecasts[i]?.toFixed(4) || '';
      const l = lower[i]?.toFixed(4) || '';
      const u = upper[i]?.toFixed(4) || '';
      csvContent += `${d},${f},${l},${u}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedModel}_forecast_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Forecast CSV exported');
  };

  // -------------------------------------------------------------
  // PLOT RENDERERS
  // -------------------------------------------------------------

  const renderForecastOrBacktestPlot = () => {
    if (!currentData || !currentData.records) {
      return (
        <div className="h-[420px] flex flex-col items-center justify-center text-slate-400">
          <FileSpreadsheet className="w-10 h-10 mb-2.5 text-slate-300" />
          <p className="text-sm font-medium">Select a dataset to view time series forecast</p>
        </div>
      );
    }

    // If holdout backtest mode is active, render the out-of-sample test evaluation
    if (enableBacktest) {
      if (loadingBacktest) {
        return (
          <div className="h-[420px] flex items-center justify-center space-x-2 text-slate-500 text-sm">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent"></div>
            <span>Evaluating out-of-sample holdout test...</span>
          </div>
        );
      }

      if (!backtestData || !backtestData.test_metrics) {
        return (
          <div className="h-[420px] flex flex-col items-center justify-center text-slate-400">
            <Target className="w-10 h-10 mb-2.5 text-slate-300" />
            <p className="text-sm font-medium">Click below to compute holdout test predictions</p>
            <button
              onClick={fetchBacktest}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors"
            >
              Run Out-of-Sample Test
            </button>
          </div>
        );
      }

      const { train_dates, train_actual, test_dates, test_actual, forecast, forecast_lower, forecast_upper, test_metrics } = backtestData;

      return (
        <div className="space-y-3">
          {/* Backtest KPI Row */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test RMSE</span>
              <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">{test_metrics.rmse.toFixed(3)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test MAE</span>
              <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">{test_metrics.mae.toFixed(3)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Naive Walk RMSE</span>
              <div className="text-sm font-bold font-mono text-slate-500 dark:text-slate-400">{test_metrics.naive_rmse.toFixed(3)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">vs Random Walk</span>
              <div className={`text-sm font-bold font-mono ${test_metrics.improvement_pct > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {test_metrics.improvement_pct > 0 ? `+${test_metrics.improvement_pct.toFixed(1)}%` : `${test_metrics.improvement_pct.toFixed(1)}%`}
              </div>
            </div>
          </div>

          <div className="h-[480px] xl:h-[540px]">
            <Plot
              data={[
                {
                  x: train_dates,
                  y: train_actual,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Train History',
                  line: { color: isDark ? '#64748b' : '#94a3b8', width: 1.8 }
                },
                {
                  x: test_dates,
                  y: test_actual,
                  type: 'scatter',
                  mode: 'lines+markers',
                  marker: { size: 4, color: '#10b981' },
                  name: 'Ground Truth Test',
                  line: { color: '#10b981', width: 2 }
                },
                {
                  x: test_dates,
                  y: forecast,
                  type: 'scatter',
                  mode: 'lines+markers',
                  marker: { size: 4, color: '#d97706' },
                  name: 'Forecast Test',
                  line: { color: '#d97706', width: 2.2, dash: 'dash' }
                },
                {
                  x: [...test_dates, ...[...test_dates].reverse()],
                  y: [...forecast_upper, ...[...forecast_lower].reverse()],
                  fill: 'toself',
                  fillcolor: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.12)',
                  line: { color: 'transparent' },
                  name: '95% Confidence Interval',
                  showlegend: false
                }
              ]}
              layout={{
                autosize: true,
                margin: { l: 45, r: 20, t: 20, b: 35 },
                hovermode: 'x unified',
                legend: { orientation: 'h', y: 1.12, font: { color: isDark ? '#cbd5e1' : '#334155', size: 11 } },
                xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: isDark ? '#cbd5e1' : '#334155' }
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        </div>
      );
    }

    // Standard Forecast View
    const timeCol = currentData.time_column;
    const valCol = currentData.value_column;
    const actualX = currentData.records.map((r: any) => r[timeCol]);
    const actualY = currentData.records.map((r: any) => r[valCol]);

    const traces: any[] = [
      {
        x: actualX,
        y: actualY,
        type: 'scatter',
        mode: 'lines',
        name: 'Historical Actual',
        line: { color: '#2563eb', width: 2 }
      }
    ];

    if (analysisResult && analysisResult.fitted_values) {
      const fittedLen = analysisResult.fitted_values.length;
      const fittedX = actualX.slice(actualX.length - fittedLen);
      traces.push({
        x: fittedX,
        y: analysisResult.fitted_values,
        type: 'scatter',
        mode: 'lines',
        name: 'In-Sample Fitted',
        line: { color: '#8b5cf6', width: 1.5, dash: 'dot' }
      });
    }

    if (analysisResult && analysisResult.forecast) {
      const forecastX = analysisResult.forecast_dates || Array.from({ length: analysisResult.forecast.length }, (_, i) => `+${i + 1}`);

      if (analysisResult.forecast_lower && analysisResult.forecast_upper) {
        traces.push({
          x: [...forecastX, ...[...forecastX].reverse()],
          y: [...analysisResult.forecast_upper, ...[...analysisResult.forecast_lower].reverse()],
          fill: 'toself',
          fillcolor: 'rgba(245, 158, 11, 0.15)',
          line: { color: 'transparent' },
          name: `${Math.round(confidenceInterval * 100)}% Confidence Band`,
          showlegend: true
        });
      }

      traces.push({
        x: forecastX,
        y: analysisResult.forecast,
        type: 'scatter',
        mode: 'lines+markers',
        marker: { size: 5, color: '#d97706' },
        name: `Forecast (${selectedModel.toUpperCase()})`,
        line: { color: '#d97706', width: 2.2, dash: 'dash' }
      });
    }

    return (
      <div className="h-[520px] xl:h-[580px] 2xl:h-[640px]">
        <Plot
          data={traces}
          layout={{
            autosize: true,
            margin: { l: 45, r: 20, t: 20, b: 35 },
            hovermode: 'x unified',
            legend: { orientation: 'h', y: 1.10, x: 0, font: { color: isDark ? '#cbd5e1' : '#334155', size: 11 } },
            xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
            yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            font: { color: isDark ? '#cbd5e1' : '#334155' }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          config={{ responsive: true, displayModeBar: true, displaylogo: false }}
        />
      </div>
    );
  };

  const renderExplorationView = () => {
    return (
      <div className="space-y-4">
        {/* Sub-Pills for Exploration */}
        <div className="flex space-x-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl w-fit">
          {[
            { id: 'stationarity', label: 'Stationarity (ADF & KPSS)' },
            { id: 'decomposition', label: 'Decomposition' },
            { id: 'acfpacf', label: 'ACF & PACF' },
            { id: 'rolling', label: 'Rolling Volatility' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setEdaTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                edaTab === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. Stationarity */}
        {edaTab === 'stationarity' && (
          <div>
            {loadingStationarity ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-sm">Testing stationarity...</div>
            ) : stationarityData && stationarityData.adf_test ? (
              <div className="space-y-3">
                <div className={`p-3.5 rounded-xl border text-xs font-medium leading-relaxed ${stationarityData.conclusion.is_stationary ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300' : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'}`}>
                  <strong>Recommendation:</strong> {stationarityData.conclusion.recommendation}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Augmented Dickey-Fuller (ADF)</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stationarityData.adf_test.is_stationary ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'}`}>
                        {stationarityData.adf_test.is_stationary ? 'Stationary' : 'Unit Root Present'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 font-mono pt-1">
                      <div className="flex justify-between"><span>Statistic:</span><strong>{stationarityData.adf_test.statistic.toFixed(4)}</strong></div>
                      <div className="flex justify-between"><span>p-value:</span><strong>{stationarityData.adf_test.pvalue.toFixed(4)}</strong></div>
                    </div>
                  </div>

                  <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">KPSS Test</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${stationarityData.kpss_test.is_stationary ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'}`}>
                        {stationarityData.kpss_test.is_stationary ? 'Stationary' : 'Non-Stationary'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 font-mono pt-1">
                      <div className="flex justify-between"><span>Statistic:</span><strong>{stationarityData.kpss_test.statistic.toFixed(4)}</strong></div>
                      <div className="flex justify-between"><span>p-value:</span><strong>{stationarityData.kpss_test.pvalue.toFixed(4)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                <ShieldCheck className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <button onClick={fetchStationarity} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Run ADF & KPSS Tests
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. Decomposition */}
        {edaTab === 'decomposition' && (
          <div>
            {loadingDecomp ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-sm">Decomposing series...</div>
            ) : decompData && decompData.trend ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { name: 'Observed', y: decompData.original, color: '#3b82f6' },
                  { name: 'Trend Component', y: decompData.trend, color: '#10b981' },
                  { name: 'Seasonal Component', y: decompData.seasonal, color: '#f59e0b' },
                  { name: 'Residual Noise', y: decompData.residual, color: '#ef4444' }
                ].map((plot) => (
                  <div key={plot.name} className="bg-slate-50/70 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{plot.name}</span>
                    <div className="h-36">
                      <Plot
                        data={[{ x: decompData.dates || Array.from({ length: plot.y.length }, (_, i) => i), y: plot.y, type: 'scatter', mode: 'lines', line: { color: plot.color, width: 1.6 } }]}
                        layout={{
                          autosize: true,
                          margin: { l: 35, r: 10, t: 8, b: 20 },
                          xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                          yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                          paper_bgcolor: 'transparent',
                          plot_bgcolor: 'transparent',
                          font: { color: isDark ? '#cbd5e1' : '#334155' }
                        }}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%' }}
                        config={{ responsive: true, displayModeBar: false }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                <Layers className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <button onClick={fetchDecomposition} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Decompose Series
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. ACF & PACF */}
        {edaTab === 'acfpacf' && (
          <div>
            {loadingAcf ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-sm">Computing correlations...</div>
            ) : acfData && acfData.acf ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Autocorrelation Function (ACF)</span>
                  <div className="h-64">
                    <Plot
                      data={[{ x: acfData.acf.lags, y: acfData.acf.values, type: 'bar', marker: { color: '#3b82f6' } }]}
                      layout={{
                        autosize: true,
                        margin: { l: 35, r: 10, t: 15, b: 30 },
                        xaxis: { title: { text: 'Lag', font: { color: isDark ? '#94a3b8' : '#64748b' } }, showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                        yaxis: { title: { text: 'Correlation', font: { color: isDark ? '#94a3b8' : '#64748b' } }, range: [-1, 1], showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                        shapes: [
                          { type: 'line', x0: 0, x1: acfData.acf.lags.length - 1, y0: 1.96 / Math.sqrt(currentData?.records?.length || 50), y1: 1.96 / Math.sqrt(currentData?.records?.length || 50), line: { color: '#ef4444', dash: 'dash', width: 1.2 } },
                          { type: 'line', x0: 0, x1: acfData.acf.lags.length - 1, y0: -1.96 / Math.sqrt(currentData?.records?.length || 50), y1: -1.96 / Math.sqrt(currentData?.records?.length || 50), line: { color: '#ef4444', dash: 'dash', width: 1.2 } }
                        ],
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: isDark ? '#cbd5e1' : '#334155' }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ responsive: true, displayModeBar: false }}
                    />
                  </div>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Partial Autocorrelation (PACF)</span>
                  <div className="h-64">
                    <Plot
                      data={[{ x: acfData.pacf.lags, y: acfData.pacf.values, type: 'bar', marker: { color: '#8b5cf6' } }]}
                      layout={{
                        autosize: true,
                        margin: { l: 35, r: 10, t: 15, b: 30 },
                        xaxis: { title: { text: 'Lag', font: { color: isDark ? '#94a3b8' : '#64748b' } }, showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                        yaxis: { title: { text: 'Partial Corr', font: { color: isDark ? '#94a3b8' : '#64748b' } }, range: [-1, 1], showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                        shapes: [
                          { type: 'line', x0: 0, x1: acfData.pacf.lags.length - 1, y0: 1.96 / Math.sqrt(currentData?.records?.length || 50), y1: 1.96 / Math.sqrt(currentData?.records?.length || 50), line: { color: '#ef4444', dash: 'dash', width: 1.2 } },
                          { type: 'line', x0: 0, x1: acfData.pacf.lags.length - 1, y0: -1.96 / Math.sqrt(currentData?.records?.length || 50), y1: -1.96 / Math.sqrt(currentData?.records?.length || 50), line: { color: '#ef4444', dash: 'dash', width: 1.2 } }
                        ],
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        font: { color: isDark ? '#cbd5e1' : '#334155' }
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                      config={{ responsive: true, displayModeBar: false }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                <BarChart3 className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <button onClick={fetchACFPACF} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Compute ACF & PACF
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Rolling Stats */}
        {edaTab === 'rolling' && (
          <div>
            {loadingRolling ? (
              <div className="h-80 flex items-center justify-center text-slate-400 text-sm">Computing rolling stats...</div>
            ) : rollingData && rollingData.rolling_mean ? (
              <div className="h-72">
                <Plot
                  data={[
                    { x: rollingData.dates || Array.from({ length: rollingData.original.length }, (_, i) => i), y: rollingData.original, type: 'scatter', mode: 'lines', name: 'Original', line: { color: isDark ? '#64748b' : '#94a3b8', width: 1.5 } },
                    { x: rollingData.dates || Array.from({ length: rollingData.original.length }, (_, i) => i), y: rollingData.rolling_mean, type: 'scatter', mode: 'lines', name: `Rolling Mean (w=${rollingData.window})`, line: { color: '#2563eb', width: 2.2 } }
                  ]}
                  layout={{
                    autosize: true,
                    margin: { l: 40, r: 15, t: 15, b: 30 },
                    hovermode: 'x unified',
                    legend: { orientation: 'h', y: 1.15, font: { color: isDark ? '#cbd5e1' : '#334155' } },
                    xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                    yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: isDark ? '#cbd5e1' : '#334155' }
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '100%' }}
                  config={{ responsive: true, displayModeBar: false }}
                />
              </div>
            ) : (
              <div className="h-80 flex flex-col items-center justify-center text-slate-400">
                <Activity className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                <button onClick={fetchRollingStats} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer">
                  Compute Rolling Statistics
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderDiagnosticsView = () => {
    if (loadingResidualDiag) {
      return (
        <div className="h-80 flex items-center justify-center text-slate-400 text-sm space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent"></div>
          <span>Computing Box-Jenkins residual diagnostics...</span>
        </div>
      );
    }

    if (!residualDiagData || !residualDiagData.summary) {
      return (
        <div className="h-80 flex flex-col items-center justify-center text-slate-400">
          <Microscope className="w-8 h-8 mb-2 text-slate-300" />
          <p className="text-sm font-medium mb-2">Evaluate model residuals for White Noise & Normality</p>
          <button onClick={fetchResidualDiagnostics} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">
            Run Residual Check
          </button>
        </div>
      );
    }

    const { summary, ljung_box, jarque_bera, acf, histogram, sequence } = residualDiagData;

    return (
      <div className="space-y-3">
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${summary.is_white_noise ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300' : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-300'}`}>
          <span><strong>Box-Jenkins Step 3:</strong> {summary.conclusion}</span>
          <span className="font-bold px-2 py-0.5 rounded bg-white/70 dark:bg-slate-800 text-slate-800 dark:text-slate-100">
            {summary.is_white_noise ? 'Passed' : 'Needs Tuning'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-700 dark:text-slate-200">Ljung-Box Test</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${ljung_box.is_white_noise ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'}`}>
                {ljung_box.is_white_noise ? 'White Noise' : 'Correlated'}
              </span>
            </div>
            <div className="flex justify-between font-mono text-slate-600 dark:text-slate-300 mt-1">
              <span>Q-Stat: {ljung_box.statistic.toFixed(3)}</span>
              <span>p-val: <strong>{ljung_box.p_value.toFixed(4)}</strong></span>
            </div>
          </div>

          <div className="bg-slate-50/70 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-700 dark:text-slate-200">Jarque-Bera Normality</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${jarque_bera.is_normal ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'}`}>
                {jarque_bera.is_normal ? 'Gaussian' : 'Skewed'}
              </span>
            </div>
            <div className="flex justify-between font-mono text-slate-600 dark:text-slate-300 mt-1">
              <span>JB-Stat: {jarque_bera.statistic.toFixed(3)}</span>
              <span>p-val: <strong>{jarque_bera.p_value.toFixed(4)}</strong></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Residual Sequence</span>
            <div className="h-64 xl:h-72">
              <Plot
                data={[{ x: sequence.dates, y: sequence.residuals, type: 'scatter', mode: 'lines', line: { color: '#6366f1', width: 1.4 } }]}
                layout={{
                  autosize: true,
                  margin: { l: 30, r: 10, t: 10, b: 25 },
                  shapes: [{ type: 'line', x0: sequence.dates[0], x1: sequence.dates[sequence.dates.length - 1], y0: 0, y1: 0, line: { color: '#ef4444', dash: 'dash' } }],
                  xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: isDark ? '#cbd5e1' : '#334155' }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Residual ACF</span>
            <div className="h-64 xl:h-72">
              <Plot
                data={[{ x: acf.lags, y: acf.values, type: 'bar', marker: { color: '#3b82f6' } }]}
                layout={{
                  autosize: true,
                  margin: { l: 30, r: 10, t: 10, b: 25 },
                  shapes: [
                    { type: 'line', x0: 0, x1: acf.lags.length - 1, y0: acf.conf_limit, y1: acf.conf_limit, line: { color: '#ef4444', dash: 'dash', width: 1 } },
                    { type: 'line', x0: 0, x1: acf.lags.length - 1, y0: -acf.conf_limit, y1: -acf.conf_limit, line: { color: '#ef4444', dash: 'dash', width: 1 } }
                  ],
                  xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: isDark ? '#cbd5e1' : '#334155' }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Histogram vs Normal Curve</span>
            <div className="h-64 xl:h-72">
              <Plot
                data={[
                  { x: histogram.bin_centers, y: histogram.densities, type: 'bar', marker: { color: isDark ? '#475569' : '#cbd5e1' } },
                  { x: histogram.x_span, y: histogram.norm_pdf, type: 'scatter', mode: 'lines', line: { color: '#10b981', width: 1.8 } }
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 30, r: 10, t: 10, b: 25 },
                  showlegend: false,
                  xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  font: { color: isDark ? '#cbd5e1' : '#334155' }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderComparisonView = () => {
    if (loadingComparison) {
      return (
        <div className="h-[420px] flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-sm space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-3 border-indigo-600 border-t-transparent"></div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Benchmarking Candidate Models...</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">Fitting ARIMA, SARIMA, Holt-Winters, and Moving Average concurrently</p>
        </div>
      );
    }

    if (!comparisonData || !comparisonData.results) {
      return (
        <div className="h-[420px] flex flex-col items-center justify-center text-center p-8">
          <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4 shadow-xs">
            <Trophy className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1.5">AutoML Time Series Benchmarking</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-5 leading-relaxed">
            Concurrently train and benchmark ARIMA, SARIMA, Holt-Winters, and Moving Average models on <span className="font-semibold text-slate-700 dark:text-slate-300">{currentData?.title || 'this dataset'}</span> to automatically determine the highest-performing model based on RMSE, MAE, and MAPE.
          </p>
          <button
            onClick={runModelComparison}
            disabled={!backendConnected || !currentData}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 dark:shadow-none flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Benchmark All Models Now</span>
          </button>
        </div>
      );
    }

    const { results, comparison, best_model } = comparisonData;
    const rankedModels = comparison?.models || [];
    const bestResult = results.find((r: any) => r.model_type === best_model);

    // Multi-trace overlay plot
    const actualX = currentData.records.map((r: any) => r[currentData.time_column]);
    const actualY = currentData.records.map((r: any) => r[currentData.value_column]);

    const colors: Record<string, string> = {
      arima: '#f59e0b',
      sarima: '#10b981',
      holt_winters: '#8b5cf6',
      moving_average: '#06b6d4'
    };

    const traces: any[] = [
      {
        x: actualX,
        y: actualY,
        type: 'scatter',
        mode: 'lines',
        name: 'Historical Actual',
        line: { color: isDark ? '#64748b' : '#334155', width: 2 }
      }
    ];

    results.forEach((r: any) => {
      if (r.forecast) {
        const forecastX = r.forecast_dates || Array.from({ length: r.forecast.length }, (_, i) => `+${i + 1}`);
        const col = colors[r.model_type] || '#ec4899';
        traces.push({
          x: forecastX,
          y: r.forecast,
          type: 'scatter',
          mode: 'lines+markers',
          marker: { size: 4, color: col },
          name: `${r.model_type.toUpperCase()} (RMSE: ${r.metrics?.rmse ? r.metrics.rmse.toFixed(2) : 'N/A'})`,
          line: { color: col, width: r.model_type === best_model ? 2.5 : 1.5, dash: 'dash' }
        });
      }
    });

    return (
      <div className="space-y-4">
        {/* Winner Highlight Card */}
        <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-emerald-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-emerald-950/40 p-3.5 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-400/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                  Top Performing Model
                </span>
                <span className="text-xs font-extrabold text-slate-800 dark:text-white uppercase font-mono">
                  {best_model}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                Achieved lowest RMSE of <strong className="font-mono text-slate-900 dark:text-white">{bestResult?.metrics?.rmse?.toFixed(3) || 'N/A'}</strong> and MAE of <strong className="font-mono text-slate-900 dark:text-white">{bestResult?.metrics?.mae?.toFixed(3) || 'N/A'}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setSelectedModel(best_model);
                setViewMode('forecast');
                showToast(`Switched active model to ${best_model.toUpperCase()}`);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
            >
              <span>Use as Active Model</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={runModelComparison}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Re-run benchmark"
            >
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Model Comparative Forecast Plot */}
        <div className="bg-slate-50/50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800">
          <div className="flex justify-between items-center px-1 mb-1">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Comparative Forecast Overlay</span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">Toggle traces in legend to inspect individual forecasts</span>
          </div>
          <div className="h-[380px] xl:h-[440px]">
            <Plot
              data={traces}
              layout={{
                autosize: true,
                margin: { l: 40, r: 15, t: 15, b: 30 },
                hovermode: 'x unified',
                legend: { orientation: 'h', y: 1.15, x: 0, font: { size: 10, color: isDark ? '#cbd5e1' : '#334155' } },
                xaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                yaxis: { showgrid: true, gridcolor: isDark ? '#334155' : '#f1f5f9', tickfont: { color: isDark ? '#94a3b8' : '#64748b' } },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { color: isDark ? '#cbd5e1' : '#334155' }
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ responsive: true, displayModeBar: false }}
            />
          </div>
        </div>

        {/* Detailed Leaderboard Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-750">
              <tr>
                <th className="p-2.5">Rank</th>
                <th className="p-2.5">Model</th>
                <th className="p-2.5 font-mono text-right" title="Root Mean Squared Error: √[(1/n) Σ(y - ŷ)²]">
                  <span className="cursor-help border-b border-dotted border-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">RMSE ⓘ</span>
                </th>
                <th className="p-2.5 font-mono text-right" title="Mean Absolute Error: (1/n) Σ|y - ŷ|">
                  <span className="cursor-help border-b border-dotted border-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">MAE ⓘ</span>
                </th>
                <th className="p-2.5 font-mono text-right" title="Mean Absolute Percentage Error: (100%/n) Σ|(y - ŷ)/y|">
                  <span className="cursor-help border-b border-dotted border-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">MAPE (%) ⓘ</span>
                </th>
                <th className="p-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 font-mono">
              {rankedModels.map((m: any, idx: number) => {
                const isWinner = m.model_type === best_model;
                return (
                  <tr key={idx} className={isWinner ? 'bg-indigo-50/50 dark:bg-indigo-950/40 font-bold text-indigo-950 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50/60 dark:hover:bg-slate-800/60'}>
                    <td className="p-2.5 font-sans">
                      {idx === 0 ? (
                        <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          🥇 #1 Winner
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-mono">#{idx + 1}</span>
                      )}
                    </td>
                    <td className="p-2.5 uppercase font-bold text-slate-800 dark:text-white">
                      {m.model_type}
                    </td>
                    <td className="p-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">
                      {m.rmse !== null ? m.rmse.toFixed(3) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">
                      {m.mae !== null ? m.mae.toFixed(3) : 'N/A'}
                    </td>
                    <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">
                      {m.mape !== null ? `${m.mape.toFixed(2)}%` : 'N/A'}
                    </td>
                    <td className="p-2.5 text-center font-sans">
                      <button
                        onClick={() => {
                          setSelectedModel(m.model_type);
                          setViewMode('forecast');
                          showToast(`Selected ${m.model_type.toUpperCase()}`);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          isWinner
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        Select Model
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 dark:bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center space-x-2 text-xs font-medium border border-slate-700 animate-fade-in">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Auto-ARIMA Modal */}
      {showAutoArimaModal && autoArimaResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-white">Auto-ARIMA Optimization (AIC)</h3>
              </div>
              <button onClick={() => setShowAutoArimaModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm">✕</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Evaluated combinations of AR(p), Diff(d), and MA(q) orders. Selected order minimizes Akaike Information Criterion:
            </p>
            <div className="max-h-52 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl mb-3 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
                  <tr><th className="p-2">Rank</th><th className="p-2">Order</th><th className="p-2">AIC</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {autoArimaResults.candidates.map((cand: any, idx: number) => (
                    <tr key={idx} className={idx === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                      <td className="p-2">{idx === 0 ? '🏆 Best' : `#${idx + 1}`}</td>
                      <td className="p-2">ARIMA({cand.order.join(',')})</td>
                      <td className="p-2">{cand.aic.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={() => setShowAutoArimaModal(false)}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
            >
              Apply ARIMA({autoArimaResults.best_order.join(',')})
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2 text-base font-bold text-slate-900 dark:text-white">
              <div className="w-7 h-7 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-sm">
                A
              </div>
              <span>ATSA Playground</span>
            </Link>
            <nav className="flex space-x-1">
              <Link to="/" className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Home
              </Link>
              <Link to="/playground" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/60">
                Workspace
              </Link>
              <Link to="/learn" className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Academy
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${backendConnected ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span>{backendConnected ? 'Engine Live' : 'GitHub Pages Demo'}</span>
            </div>

            <ThemeToggle />

            <button
              onClick={handleExportCSV}
              disabled={!analysisResult}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors disabled:opacity-50 cursor-pointer border border-transparent dark:border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace (Edge-to-Edge Full-Screen) */}
      <main className="w-full px-4 sm:px-6 py-3.5 space-y-3">
        {/* Top Metric Strip (Bloomberg/Stripe style horizontal KPI ribbon) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 px-4 py-2.5 shadow-xs flex items-center justify-between text-xs">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 dark:text-slate-500 font-medium">Dataset:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{currentData?.title || currentData?.name || 'None'}</span>
              <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">
                {currentData?.records?.length || 0} obs
              </span>
            </div>
            <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-800"></div>
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 dark:text-slate-500 font-medium">Active Model:</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                {selectedModel}
                {selectedModel === 'arima' && `(${arimaOrder.p},${arimaOrder.d},${arimaOrder.q})`}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-6 font-mono text-xs">
            {analysisResult?.metrics && (
              <>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 mr-1.5 font-sans font-medium text-[11px]">RMSE:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{analysisResult.metrics.rmse ? analysisResult.metrics.rmse.toFixed(3) : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 mr-1.5 font-sans font-medium text-[11px]">MAE:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{analysisResult.metrics.mae ? analysisResult.metrics.mae.toFixed(3) : 'N/A'}</span>
                </div>
                {analysisResult.model_info?.aic && (
                  <div>
                    <span className="text-slate-400 dark:text-slate-500 mr-1.5 font-sans font-medium text-[11px]">AIC:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{analysisResult.model_info.aic.toFixed(1)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* 2-Column Responsive Full-Screen Layout */}
        <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
          {/* Left Column: Fixed Width Sidebar */}
          <div className="w-full lg:w-[320px] xl:w-[360px] shrink-0 space-y-3">
            {/* Model & Config Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3.5">
              {/* Dataset Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    1. Data Source
                  </label>
                  <div className="flex space-x-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setDataMode('preset')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${dataMode === 'preset' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                      Presets / CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => setDataMode('yfinance')}
                      className={`px-2 py-0.5 rounded-md flex items-center space-x-1 transition-all cursor-pointer ${dataMode === 'yfinance' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-2xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                      <Globe className="w-2.5 h-2.5" />
                      <span>Live yfinance</span>
                    </button>
                  </div>
                </div>

                {dataMode === 'preset' ? (
                  <div className="flex space-x-2">
                    <select
                      value={selectedDatasetName}
                      onChange={(e) => loadDatasetByName(e.target.value)}
                      className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {sampleDatasets.map((ds) => (
                        <option key={ds.name} value={ds.name}>
                          {ds.title || ds.name} ({ds.rows} pts)
                        </option>
                      ))}
                    </select>
                    <input type="file" ref={fileInputRef} accept=".csv" onChange={handleCustomFileUpload} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload custom CSV"
                      className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs transition-colors shrink-0 cursor-pointer border border-transparent dark:border-slate-700"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 p-2.5 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl">
                    <div className="flex space-x-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={tickerSymbol}
                          onChange={(e) => setTickerSymbol(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchMarketData();
                          }}
                          placeholder="Ticker (e.g. AAPL, NVDA, TCS.NS)"
                          className="w-full text-xs pl-7 pr-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg font-mono font-bold uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                      </div>
                      <select
                        value={tickerPeriod}
                        onChange={(e) => setTickerPeriod(e.target.value)}
                        className="text-xs px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg font-mono font-semibold"
                      >
                        <option value="6mo">6M</option>
                        <option value="1y">1Y</option>
                        <option value="2y">2Y</option>
                        <option value="5y">5Y</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => fetchMarketData()}
                        disabled={loadingTicker || !tickerSymbol}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
                      >
                        {loadingTicker ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                        ) : (
                          <span>Fetch</span>
                        )}
                      </button>
                    </div>

                    {/* Popular Ticker Presets */}
                    <div className="flex flex-wrap gap-1 items-center pt-1 border-t border-emerald-100/60 dark:border-emerald-900/40">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mr-1">Popular:</span>
                      {['AAPL', 'NVDA', 'TSLA', 'MSFT', 'RELIANCE.NS', 'BTC-USD'].map((tick) => (
                        <button
                          type="button"
                          key={tick}
                          onClick={() => {
                            setTickerSymbol(tick);
                            fetchMarketData(tick);
                          }}
                          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer ${tickerSymbol === tick ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'}`}
                        >
                          {tick}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Model Family */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">2. Model Selection</label>
                  {selectedModel === 'arima' && (
                    <button
                      onClick={runAutoArimaSearch}
                      disabled={loadingAutoArima || !currentData}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Cpu className="w-3 h-3" />
                      <span>{loadingAutoArima ? 'Searching...' : 'Auto-Fit (p,d,q)'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/70 dark:bg-slate-800/70 rounded-xl">
                  {[
                    { id: 'arima', label: 'ARIMA' },
                    { id: 'sarima', label: 'SARIMA' },
                    { id: 'holt_winters', label: 'Holt-Winters' },
                    { id: 'moving_average', label: 'Moving Avg' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                        selectedModel === m.id
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Parameter Controls */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                {selectedModel === 'arima' && (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">p (AR)</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={arimaOrder.p}
                        onChange={(e) => setArimaOrder({ ...arimaOrder, p: parseInt(e.target.value) || 0 })}
                        className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono font-bold mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">d (Diff)</span>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        value={arimaOrder.d}
                        onChange={(e) => setArimaOrder({ ...arimaOrder, d: parseInt(e.target.value) || 0 })}
                        className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono font-bold mt-0.5"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">q (MA)</span>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={arimaOrder.q}
                        onChange={(e) => setArimaOrder({ ...arimaOrder, q: parseInt(e.target.value) || 0 })}
                        className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono font-bold mt-0.5"
                      />
                    </div>
                  </div>
                )}

                {selectedModel === 'sarima' && (
                  <div className="space-y-1.5 text-center">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400">p</span>
                        <input type="number" min="0" value={sarimaOrder.p} onChange={(e) => setSarimaOrder({ ...sarimaOrder, p: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400">d</span>
                        <input type="number" min="0" value={sarimaOrder.d} onChange={(e) => setSarimaOrder({ ...sarimaOrder, d: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-400">q</span>
                        <input type="number" min="0" value={sarimaOrder.q} onChange={(e) => setSarimaOrder({ ...sarimaOrder, q: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-750">
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400">P</span>
                        <input type="number" min="0" value={sarimaOrder.P} onChange={(e) => setSarimaOrder({ ...sarimaOrder, P: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400">D</span>
                        <input type="number" min="0" value={sarimaOrder.D} onChange={(e) => setSarimaOrder({ ...sarimaOrder, D: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400">Q</span>
                        <input type="number" min="0" value={sarimaOrder.Q} onChange={(e) => setSarimaOrder({ ...sarimaOrder, Q: parseInt(e.target.value) || 0 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                      <div>
                        <span className="text-[9px] font-semibold text-slate-400">s</span>
                        <input type="number" min="2" value={sarimaOrder.s} onChange={(e) => setSarimaOrder({ ...sarimaOrder, s: parseInt(e.target.value) || 12 })} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                      </div>
                    </div>
                  </div>
                )}

                {selectedModel === 'holt_winters' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Trend</span>
                      <select value={hwTrend} onChange={(e) => setHwTrend(e.target.value)} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded">
                        <option value="add">Add</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Season</span>
                      <select value={hwSeasonal} onChange={(e) => setHwSeasonal(e.target.value)} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded">
                        <option value="add">Add</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Period (s)</span>
                      <input type="number" min="2" value={hwPeriods} onChange={(e) => setHwPeriods(parseInt(e.target.value) || 12)} className="w-full text-xs p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded text-center font-mono" />
                    </div>
                  </div>
                )}

                {selectedModel === 'moving_average' && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      <span>Window Size:</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">{maWindow}</span>
                    </div>
                    <input type="range" min="2" max="30" value={maWindow} onChange={(e) => setMaWindow(parseInt(e.target.value))} className="w-full accent-indigo-600" />
                  </div>
                )}

                {/* Horizon Slider */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-750">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    <span>Forecast Horizon:</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400">{forecastPeriods} steps</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="60"
                    value={forecastPeriods}
                    onChange={(e) => setForecastPeriods(parseInt(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={runAnalysis}
                disabled={!backendConnected || !currentData || isAnalyzing}
                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all shadow-xs cursor-pointer ${
                  isAnalyzing
                    ? 'bg-indigo-400 text-white cursor-wait'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                    <span>Fitting Model...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Model & Forecast</span>
                  </>
                )}
              </button>

              {/* Benchmark Link */}
              <button
                type="button"
                onClick={() => {
                  setViewMode('comparison');
                  if (!comparisonData) runModelComparison();
                }}
                disabled={!backendConnected || !currentData}
                className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-xl font-semibold text-[11px] flex items-center justify-center space-x-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Benchmark All Models</span>
              </button>

              {/* Holdout Backtesting Toggle */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-slate-600 dark:text-slate-300">
                  <Target className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-medium">Holdout Backtest</span>
                </div>
                <input
                  type="checkbox"
                  checked={enableBacktest}
                  onChange={(e) => setEnableBacktest(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Clean Unified Full-Width Canvas */}
          <div className="flex-1 min-w-0 w-full space-y-3">
            {/* 4 Macro Modes (Segmented Clean Navigation) */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex space-x-1">
                {[
                  { id: 'forecast', label: '🔮 Forecast & Backtest' },
                  { id: 'comparison', label: '🏆 Model Leaderboard' },
                  { id: 'exploration', label: '📊 Exploratory Analysis (EDA)' },
                  { id: 'diagnostics', label: '🔬 Residual Check (Box-Jenkins)' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setViewMode(mode.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === mode.id
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
                <button
                  onClick={() => setIsShortcutsOpen(true)}
                  className="px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Keyboard Shortcuts (?)"
                >
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>(?)</span>
                </button>
              </div>
            </div>

            {/* Dynamic View Canvas */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs min-h-[560px] xl:min-h-[620px]">
              {viewMode === 'forecast' && renderForecastOrBacktestPlot()}
              {viewMode === 'comparison' && renderComparisonView()}
              {viewMode === 'exploration' && renderExplorationView()}
              {viewMode === 'diagnostics' && renderDiagnosticsView()}
            </div>
          </div>
        </div>
      </main>

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
};

export default SimplePlaygroundPage;