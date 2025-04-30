// CodeGuardian - Dashboard UI Component
// This is the main frontend interface for CodeGuardian users

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';

function Dashboard() {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalIssuesFixed: 0,
    bugsDetected: 0,
    securityIssues: 0,
    codeQualityScore: 0
  });
  const [settings, setSettings] = useState({
    enablePreCommit: true,
    enableTestSuggestions: true,
    enableSimilarCodeSearch: true,
    scanFrequency: 'onPush'
  });

  useEffect(() => {
    // Fetch repositories configured with CodeGuardian
    const fetchRepositories = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/repositories`);
        setRepositories(response.data);
        
        if (response.data.length > 0) {
          setSelectedRepo(response.data[0]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching repositories:', error);
        setLoading(false);
      }
    };

    fetchRepositories();
  }, []);

  useEffect(() => {
    // Fetch analyses for selected repository
    const fetchAnalyses = async () => {
      if (!selectedRepo) return;
      
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/repositories/${selectedRepo.id}/analyses`);
        setAnalyses(response.data);
        
        // Update stats
        updateStats(response.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analyses:', error);
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, [selectedRepo]);

  const updateStats = (analysesData) => {
    let totalIssuesFixed = 0;
    let bugsDetected = 0;
    let securityIssues = 0;
    let qualityScoreSum = 0;
    let qualityScoreCount = 0;
    
    analysesData.forEach(analysis => {
      bugsDetected += analysis.summary?.issueCount?.high || 0;
      bugsDetected += analysis.summary?.issueCount?.medium || 0;
      bugsDetected += analysis.summary?.issueCount?.low || 0;
      
      securityIssues += analysis.summary?.securityCount?.high || 0;
      securityIssues += analysis.summary?.securityCount?.medium || 0;
      securityIssues += analysis.summary?.securityCount?.low || 0;
      
      if (analysis.resolvedIssues) {
        totalIssuesFixed += analysis.resolvedIssues;
      }
      
      if (analysis.summary?.healthScore) {
        qualityScoreSum += analysis.summary.healthScore;
        qualityScoreCount++;
      }
    });
    
    setStats({
      totalIssuesFixed,
      bugsDetected,
      securityIssues,
      codeQualityScore: qualityScoreCount > 0 ? Math.round(qualityScoreSum / qualityScoreCount) : 0
    });
  };

  const handleRepositoryChange = (repoId) => {
    const repo = repositories.find(r => r.id === repoId);
    setSelectedRepo(repo);
  };

  const handleSettingChange = (setting, value) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value
    }));
    
    // In a real app, we would save these settings to the backend
    saveSettings({
      ...settings,
      [setting]: value
    });
  };

  const saveSettings = async (settingsData) => {
    try {
      await axios.put(`${API_BASE_URL}/settings`, {
        repositoryId: selectedRepo?.id,
        settings: settingsData
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo-container">
          <img src="/logo.svg" alt="CodeGuardian Logo" className="logo" />
          <h1>CodeGuardian</h1>
        </div>
        <div className="repository-selector">
          <select 
            value={selectedRepo?.id || ''} 
            onChange={(e) => handleRepositoryChange(e.target.value)}
            disabled={loading || repositories.length === 0}
          >
            {repositories.map(repo => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="dashboard-content">
        <aside className="stats-sidebar">
          <div className="stats-card">
            <h3>Code Quality Score</h3>
            <div className="score-circle">
              <span>{stats.codeQualityScore}</span>
            </div>
          </div>
          
          <div className="stats-metrics">
            <div className="metric">
              <h4>Bugs Detected</h4>
              <p>{stats.bugsDetected}</p>
            </div>
            <div className="metric">
              <h4>Security Issues</h4>
              <p>{stats.securityIssues}</p>
            </div>
            <div className="metric">
              <h4>Issues Fixed</h4>
              <p>{stats.totalIssuesFixed}</p>
            </div>
          </div>
          
          <div className="settings-section">
            <h3>Configuration</h3>
            <div className="setting">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.enablePreCommit}
                  onChange={(e) => handleSettingChange('enablePreCommit', e.target.checked)}
                />
                Enable Pre-Commit Analysis
              </label>
            </div>
            <div className="setting">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.enableTestSuggestions}
                  onChange={(e) => handleSettingChange('enableTestSuggestions', e.target.checked)}
                />
                Test Recommendations
              </label>
            </div>
            <div className="setting">
              <label>
                <input 
                  type="checkbox" 
                  checked={settings.enableSimilarCodeSearch}
                  onChange={(e) => handleSettingChange('enableSimilarCodeSearch', e.target.checked)}
                />
                Similar Code Detection
              </label>
            </div>
            <div className="setting">
              <label>
                Scan Frequency:
                <select 
                  value={settings.scanFrequency}
                  onChange={(e) => handleSettingChange('scanFrequency', e.target.value)}
                >
                  <option value="onPush">On Every Push</option>
                  <option value="onPR">Only on PRs</option>
                  <option value="daily">Daily Scan</option>
                </select>
              </label>
            </div>
          </div>
        </aside>

        <main className="analysis-content">
          <h2>Recent Code Analysis Results</h2>
          
          {loading ? (
            <div className="loading-spinner">Loading analysis results...</div>
          ) : analyses.length === 0 ? (
            <div className="empty-state">
              <p>No analysis results available for this repository.</p>
              <button className="primary-button">Run Initial Analysis</button>
            </div>
          ) : (
            <div className="analysis-list">
              {analyses.map(analysis => (
                <div key={analysis.id} className="analysis-card">
                  <div className="analysis-header">
                    <h3>{analysis.commit ? `Commit ${analysis.commit.substring(0, 7)}` : `PR #${analysis.prNumber}`}</h3>
                    <span className="timestamp">{new Date(analysis.timestamp).toLocaleString()}</span>
                  </div>
                  
                  <div className="analysis-details">
                    <div className="analysis-stats">
                      <div className="stat">
                        <span className="label">Files:</span>
                        <span className="value">{analysis.summary?.filesAnalyzed || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Issues:</span>
                        <span className="value">
                          {(analysis.summary?.issueCount?.high || 0) + 
                           (analysis.summary?.issueCount?.medium || 0) + 
                           (analysis.summary?.issueCount?.low || 0)}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="label">Security:</span>
                        <span className="value">
                          {(analysis.summary?.securityCount?.high || 0) + 
                           (analysis.summary?.securityCount?.medium || 0) + 
                           (analysis.summary?.securityCount?.low || 0)}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="label">Score:</span>
                        <span className="value">{analysis.summary?.healthScore || 0}</span>
                      </div>
                    </div>
                    
                    {analysis.summary?.issueCount?.high > 0 && (
                      <div className="warning-badge high">
                        {analysis.summary.issueCount.high} High Priority Issues
                      </div>
                    )}
                    
                    {analysis.summary?.securityCount?.high > 0 && (
                      <div className="warning-badge security">
                        {analysis.summary.securityCount.high} Security Vulnerabilities
                      </div>
                    )}
                    
                    <button className="view-details-button">View Details</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default Dashboard;