import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { ThemeToggle } from '../components/common/ThemeToggle';

const CodeBlock: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = useState(false);
  const cleanCode = code.replace(/^python\s*\n?/, '').trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-md text-slate-100">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/90 border-b border-slate-700/60 text-xs">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>
          <span className="font-mono text-slate-400 font-semibold ml-2">python</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-slate-300 hover:text-white px-2.5 py-1 rounded-md bg-slate-700/70 hover:bg-slate-700 transition-colors text-[11px] font-medium cursor-pointer"
        >
          {copied ? <span>✓ Copied</span> : <span>Copy Code</span>}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-xs text-emerald-300 leading-relaxed">
        <code>{cleanCode}</code>
      </pre>
    </div>
  );
};

const FormattedSectionContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;

  const parts = content.split('```');

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          return <CodeBlock key={idx} code={part} />;
        }

        const paragraphs = part.split('\n\n');
        return (
          <div key={idx} className="space-y-2.5">
            {paragraphs.map((p, pIdx) => {
              const trimmed = p.trim();
              if (!trimmed) return null;

              if (trimmed.includes('\n•') || trimmed.includes('\n-') || trimmed.startsWith('•') || trimmed.startsWith('-')) {
                const lines = trimmed.split('\n');
                return (
                  <div key={pIdx} className="space-y-1 my-1.5">
                    {lines.map((line, lIdx) => {
                      const cleanLine = line.trim();
                      if (cleanLine.startsWith('•') || cleanLine.startsWith('-')) {
                        const bulletText = cleanLine.replace(/^[•\-]\s*/, '');
                        return (
                          <div key={lIdx} className="flex items-start space-x-2 pl-2">
                            <span className="text-indigo-600 font-bold mt-0.5">•</span>
                            <span dangerouslySetInnerHTML={{
                              __html: bulletText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            }} />
                          </div>
                        );
                      }
                      return (
                        <p key={lIdx} dangerouslySetInnerHTML={{
                          __html: cleanLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        }} />
                      );
                    })}
                  </div>
                );
              }

              return (
                <p key={pIdx} dangerouslySetInnerHTML={{
                  __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }} />
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

const LearningPage: React.FC = () => {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [learningModules, setLearningModules] = useState<any[]>([]);
  const [moduleContent, setModuleContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [backendConnected, setBackendConnected] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [quizResults, setQuizResults] = useState<any>(null);

  // Fallback modules if backend is not available
  const fallbackModules = [
    {
      id: 'time-series-fundamentals',
      title: 'Time Series Fundamentals',
      difficulty: 'Beginner',
      duration: '45 minutes',
      description: 'Learn the core concepts of time series analysis',
      quiz_questions: 3
    },
    {
      id: 'arima-models',
      title: 'ARIMA Models',
      difficulty: 'Intermediate', 
      duration: '60 minutes',
      description: 'Master AutoRegressive Integrated Moving Average models',
      quiz_questions: 3
    },
    {
      id: 'sarima-models',
      title: 'SARIMA Models',
      difficulty: 'Intermediate',
      duration: '50 minutes',
      description: 'Learn Seasonal ARIMA for handling seasonality',
      quiz_questions: 3
    }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    initializeLearning();
  }, []);

  const initializeLearning = async () => {
    setLoading(true);
    
    // Check backend connection
    const isConnected = await API.Health.checkBackendHealth();
    setBackendConnected(isConnected);
    
    if (isConnected) {
      // Load modules from backend
      const modules = await API.Learning.getModules();
      setLearningModules(modules.length > 0 ? modules : fallbackModules);
    } else {
      // Use fallback modules
      setLearningModules(fallbackModules);
    }
    
    setLoading(false);
  };

  const loadModuleContent = async (moduleId: string) => {
    setSelectedModule(moduleId);
    setModuleContent(null);
    setShowQuiz(false);
    setQuizResults(null);
    
    if (backendConnected) {
      const content = await API.Learning.getModuleContent(moduleId);
      setModuleContent(content);
    } else {
      // Show placeholder content
      setModuleContent({
        id: moduleId,
        title: learningModules.find(m => m.id === moduleId)?.title || 'Module',
        description: 'Connect to backend server to load full learning content with interactive features.',
        content: [
          {
            type: 'section',
            title: 'Backend Required',
            content: 'This module requires backend connection to display comprehensive learning materials, examples, and interactive content.'
          }
        ]
      });
    }
  };

  const loadQuiz = async (moduleId: string) => {
    if (!backendConnected) {
      alert('Backend connection required for quizzes');
      return;
    }
    
    const quiz = await API.Learning.getQuiz(moduleId);
    if (quiz) {
      setCurrentQuiz(quiz);
      setShowQuiz(true);
      setUserAnswers({});
      setQuizResults(null);
    }
  };

  const submitQuiz = async () => {
    if (!currentQuiz || !backendConnected) return;
    
    const results = await API.Learning.submitQuiz(
      currentQuiz.module_id,
      'demo-user',
      userAnswers
    );
    
    if (results) {
      setQuizResults(results);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading learning modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs border-b border-gray-200/80 dark:border-slate-800 sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center space-x-2">
              <span>🎯 ATSA Playground</span>
            </Link>
            <nav className="hidden md:flex space-x-4">
              <Link to="/" className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Home
              </Link>
              <Link to="/playground" className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Workspace
              </Link>
              <Link to="/learn" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/60">
                Academy
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-2.5">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedModule ? (
          <div>
            {/* Learning Overview */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">📚 Learn Time Series Analysis</h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Master Applied Time Series Analysis through interactive modules, animations, and hands-on exercises
              </p>
            </div>

            {/* Backend Connection Status */}
            <div className={`mb-8 p-4 rounded-xl ${backendConnected ? 'bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-300'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${backendConnected ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span className="font-semibold text-sm">
                  {backendConnected ? 'Backend Connected - Full Features Available' : 'Limited Mode - Backend Not Connected'}
                </span>
              </div>
              {!backendConnected && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                  Some features like quizzes and full content require backend connection. Basic modules are still available.
                </p>
              )}
            </div>

            {/* Progress Overview */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 mb-8 shadow-xs border border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Your Progress</h2>
                <div className="text-sm text-gray-500 dark:text-gray-400">0/4 modules completed</div>
              </div>
              <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-3">
                <div className="bg-blue-600 h-3 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>

            {/* Learning Modules Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {learningModules.map((module) => (
                <div 
                  key={module.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow cursor-pointer border border-gray-200/80 dark:border-slate-800"
                  onClick={() => setSelectedModule(module.id)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{module.title}</h3>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(module.difficulty)}`}>
                        {module.difficulty}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{module.description}</p>
                  
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">⏱️ {module.duration}</span>
                      {module.quiz_questions && (
                        <span className="text-gray-500">🧩 {module.quiz_questions} quiz questions</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          loadModuleContent(module.id);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Start Learning
                      </button>
                      {module.quiz_questions > 0 && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            loadQuiz(module.id);
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            backendConnected 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                          disabled={!backendConnected}
                        >
                          Take Quiz
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Resources */}
            <div className="mt-12 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800/80 rounded-2xl p-8 border border-blue-100/60 dark:border-slate-800">
              <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-white">📖 Additional Resources</h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <h3 className="font-medium mb-2 text-slate-800 dark:text-white">Interactive Examples</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Explore real-world datasets and see models in action</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">🧮</div>
                  <h3 className="font-medium mb-2 text-slate-800 dark:text-white">Mathematical Deep-Dive</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Understand the theory behind each model</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">💡</div>
                  <h3 className="font-medium mb-2 text-slate-800 dark:text-white">Best Practices</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Learn industry tips and common pitfalls</p>
                </div>
              </div>
            </div>
          </div>
        ) : showQuiz && currentQuiz ? (
          /* Quiz View */
          <div>
            <div className="mb-6">
              <button 
                onClick={() => {
                  setShowQuiz(false);
                  setSelectedModule(null);
                }}
                className="flex items-center text-blue-600 hover:text-blue-700 font-medium mb-4"
              >
                ← Back to Modules
              </button>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Quiz: {learningModules.find(m => m.id === currentQuiz.module_id)?.title}
              </h1>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm">
              {!quizResults ? (
                <div>
                  <h2 className="text-xl font-semibold mb-6">Test Your Knowledge</h2>
                  <div className="space-y-6">
                    {currentQuiz.questions.map((question: any, index: number) => (
                      <div key={question.id} className="border border-gray-200 rounded-lg p-6">
                        <h3 className="font-medium mb-4">
                          {index + 1}. {question.question}
                        </h3>
                        
                        {question.type === 'multiple_choice' && question.options && (
                          <div className="space-y-2">
                            {question.options.map((option: string, optionIndex: number) => (
                              <label key={optionIndex} className="flex items-center space-x-3 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`question-${question.id}`}
                                  value={optionIndex}
                                  onChange={(e) => setUserAnswers(prev => ({
                                    ...prev,
                                    [question.id]: parseInt(e.target.value)
                                  }))}
                                  className="text-blue-600"
                                />
                                <span>{option}</span>
                              </label>
                            ))}
                          </div>
                        )}
                        
                        {question.type === 'true_false' && (
                          <div className="space-y-2">
                            <label className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value="true"
                                onChange={(e) => setUserAnswers(prev => ({
                                  ...prev,
                                  [question.id]: e.target.value === 'true'
                                }))}
                                className="text-blue-600"
                              />
                              <span>True</span>
                            </label>
                            <label className="flex items-center space-x-3 cursor-pointer">
                              <input
                                type="radio"
                                name={`question-${question.id}`}
                                value="false"
                                onChange={(e) => setUserAnswers(prev => ({
                                  ...prev,
                                  [question.id]: e.target.value === 'true'
                                }))}
                                className="text-blue-600"
                              />
                              <span>False</span>
                            </label>
                          </div>
                        )}
                        
                        {question.type === 'coding' && (
                          <textarea
                            className="w-full p-3 border border-gray-300 rounded-lg font-mono text-sm"
                            rows={3}
                            placeholder="Enter your answer..."
                            onChange={(e) => setUserAnswers(prev => ({
                              ...prev,
                              [question.id]: e.target.value
                            }))}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={submitQuiz}
                      disabled={Object.keys(userAnswers).length !== currentQuiz.questions.length}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Submit Quiz
                    </button>
                  </div>
                </div>
              ) : (
                /* Quiz Results */
                <div>
                  <div className="text-center mb-8">
                    <div className={`text-6xl mb-4 ${
                      quizResults.passed ? '🎉' : '📚'
                    }`}>
                      {quizResults.passed ? '🎉' : '�'}
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">
                      Quiz {quizResults.passed ? 'Passed!' : 'Completed'}
                    </h2>
                    <div className="text-lg">
                      Score: {quizResults.score}% ({quizResults.correct_answers}/{quizResults.total_questions})
                    </div>
                    {quizResults.passed ? (
                      <p className="text-green-600 mt-2">Great job! You can move to the next module.</p>
                    ) : (
                      <p className="text-yellow-600 mt-2">Review the material and try again to improve your score.</p>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    {quizResults.detailed_results.map((result: any, index: number) => (
                      <div key={index} className={`border rounded-lg p-4 ${
                        result.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}>
                        <div className="flex items-start space-x-3">
                          <div className={`text-lg ${
                            result.correct ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {result.correct ? '✅' : '❌'}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-2">{result.explanation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-8 flex justify-center space-x-4">
                    <button
                      onClick={() => {
                        setShowQuiz(false);
                        setQuizResults(null);
                        setSelectedModule(null);
                      }}
                      className="bg-gray-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                    >
                      Back to Modules
                    </button>
                    {!quizResults.passed && (
                      <button
                        onClick={() => {
                          setQuizResults(null);
                          setUserAnswers({});
                        }}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        Retake Quiz
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Module Content View */
          <div>
            <div className="mb-6">
              <button 
                onClick={() => {
                  setSelectedModule(null);
                  setModuleContent(null);
                }}
                className="flex items-center text-blue-600 hover:text-blue-700 font-medium mb-4"
              >
                ← Back to Modules
              </button>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {moduleContent?.title || 'Loading...'}
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                {moduleContent?.description}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xs border border-gray-200/80 dark:border-slate-800">
              {moduleContent ? (
                <div className="prose prose-blue max-w-none">
                  {moduleContent.content.map((section: any, index: number) => (
                    <div key={index} className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                          {section.title}
                        </h2>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          section.type === 'mathematical' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-850' :
                          section.type === 'practical' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-850' :
                          section.type === 'code_example' ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700' :
                          section.type === 'case_study' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 border border-purple-200 dark:border-purple-850' :
                          'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-850'
                        }`}>
                          {section.type === 'mathematical' && '🧮 Mathematical Rigor'}
                          {section.type === 'practical' && '💡 Practical Guide'}
                          {section.type === 'code_example' && '💻 Python Implementation'}
                          {section.type === 'case_study' && '📊 Real-World Case Study'}
                          {section.type === 'introduction' && '📖 Concept Overview'}
                        </span>
                      </div>
                      
                      <div className={`p-6 rounded-2xl ${
                        section.type === 'mathematical' ? 'bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50 shadow-xs' :
                        section.type === 'practical' ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 shadow-xs' :
                        section.type === 'code_example' ? 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 shadow-xs' :
                        section.type === 'case_study' ? 'bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50 shadow-xs' :
                        'bg-gray-50 dark:bg-slate-800/40 border border-gray-200 dark:border-slate-800'
                      }`}>
                        <FormattedSectionContent content={section.content} />
                      </div>
                      
                      {/* Quiz button for this module */}
                      {index === moduleContent.content.length - 1 && backendConnected && (
                        <div className="mt-6 text-center">
                          <button
                            onClick={() => loadQuiz(selectedModule!)}
                            className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
                          >
                            Take Quiz for This Module
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading module content...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LearningPage;