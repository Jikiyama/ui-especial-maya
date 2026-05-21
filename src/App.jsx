import { useState, useEffect } from 'react'
import Generator from './components/Generator'
import Gallery from './components/Gallery'
import { hashApiKey } from './aws/hash'

function App() {
  const [apiKey, setApiKey] = useState('')
  const [isKeySet, setIsKeySet] = useState(false)
  const [userHash, setUserHash] = useState('')
  const [activeTab, setActiveTab] = useState('generator')

  const handleSetApiKey = async () => {
    if (apiKey.trim()) {
      const hash = await hashApiKey(apiKey)
      setUserHash(hash)
      setIsKeySet(true)
    }
  }

  if (!isKeySet) {
    return (
      <div className="app">
        <div className="api-key-screen">
          <div className="logo">
            <span className="banana-icon">✨</span>
            <h1>GPT Image Pro</h1>
            <p className="subtitle">AI Image Generator</p>
          </div>

          <div className="api-key-form">
            <label htmlFor="apiKey">Enter your OpenAI API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
            />
            <button onClick={handleSetApiKey} className="primary-btn">
              Get Started
            </button>
            <p className="api-hint">
              Get your API key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                OpenAI Platform
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <div className="header-left">
          <span className="banana-icon-small">✨</span>
          <h1>GPT Image Pro</h1>
        </div>
        <nav className="header-tabs">
          <button
            className={`tab-btn ${activeTab === 'generator' ? 'active' : ''}`}
            onClick={() => setActiveTab('generator')}
          >
            Generate
          </button>
          <button
            className={`tab-btn ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Gallery
          </button>
        </nav>
        <button className="text-btn" onClick={() => setIsKeySet(false)}>
          Change API Key
        </button>
      </header>

      {activeTab === 'generator' && <Generator apiKey={apiKey} userHash={userHash} />}
      {activeTab === 'gallery' && <Gallery userHash={userHash} />}
    </div>
  )
}

export default App
