import { useState, useRef } from 'react'
import { GoogleGenerativeAI } from '@google/generative-ai'

function App() {
  // API Key state
  const [apiKey, setApiKey] = useState('')
  const [isKeySet, setIsKeySet] = useState(false)

  // Settings state
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [resolution, setResolution] = useState('2K')

  // Reference images state
  const [referenceImages, setReferenceImages] = useState([])
  const fileInputRef = useRef(null)

  // Prompt and generation state
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])

  const handleSetApiKey = () => {
    if (apiKey.trim()) {
      setIsKeySet(true)
      setError('')
    }
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const validFiles = files.filter(f =>
      ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'].includes(f.type)
    )

    validFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setReferenceImages(prev => [...prev, {
          name: file.name,
          data: e.target.result,
          file: file
        }])
      }
      reader.readAsDataURL(file)
    })
  }

  const removeImage = (index) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError('')
    setGeneratedImage(null)

    try {
      // Initialize Google Generative AI with user's API key
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" })

      // Build content parts - exactly like Python
      const parts = [prompt]

      // Add reference images if any (same format as Python)
      for (const img of referenceImages) {
        parts.push(`\n[Reference Image: ${img.name}]`)
        const base64Data = img.data.split(',')[1]
        const mimeType = img.data.split(';')[0].split(':')[1]
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
          }
        })
      }

      const result = await model.generateContent({
        contents: [{ role: "user", parts: parts.map(p => typeof p === 'string' ? { text: p } : p) }],
        generationConfig: {
          responseModalities: ["IMAGE"],
          temperature: 1.0
        },
        safetySettings: [
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
      })

      const response = result.response

      // Look for image in response
      let foundImage = false
      const candidates = response.candidates
      if (candidates && candidates[0]) {
        const candidate = candidates[0]
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageData = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              setGeneratedImage(imageData)
              setHistory(prev => [{
                prompt,
                image: imageData,
                timestamp: new Date().toLocaleTimeString()
              }, ...prev.slice(0, 9)])
              foundImage = true
              break
            }
          }
        }
      }

      if (!foundImage) {
        setError('No image was returned. Try a different prompt or check your API quota.')
      }

    } catch (err) {
      console.error(err)
      setError(`Error: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = () => {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `nano_banana_${Date.now()}.png`
    link.click()
  }

  // API Key Screen
  if (!isKeySet) {
    return (
      <div className="app">
        <div className="api-key-screen">
          <div className="logo">
            <span className="banana-icon">🍌</span>
            <h1>Nano Banana Pro</h1>
            <p className="subtitle">AI Image Generator</p>
          </div>

          <div className="api-key-form">
            <label htmlFor="apiKey">Enter your Google AI API Key</label>
            <input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              onKeyDown={(e) => e.key === 'Enter' && handleSetApiKey()}
            />
            <button onClick={handleSetApiKey} className="primary-btn">
              Get Started
            </button>
            <p className="api-hint">
              Get your API key from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
                Google AI Studio
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Main App Screen
  return (
    <div className="app">
      <header>
        <div className="header-left">
          <span className="banana-icon-small">🍌</span>
          <h1>Nano Banana Pro</h1>
        </div>
        <button className="text-btn" onClick={() => setIsKeySet(false)}>
          Change API Key
        </button>
      </header>

      <main>
        <div className="controls-panel">
          {/* Settings Section */}
          <section className="settings-section">
            <h2>Image Settings</h2>

            <div className="setting-group">
              <label>Aspect Ratio</label>
              <div className="radio-cards">
                {[
                  { value: '1:1', label: 'Square', icon: '◻️' },
                  { value: '16:9', label: 'Widescreen', icon: '🖼️' },
                  { value: '9:16', label: 'Portrait', icon: '📱' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`radio-card ${aspectRatio === opt.value ? 'selected' : ''}`}
                    onClick={() => setAspectRatio(opt.value)}
                  >
                    <span className="card-icon">{opt.icon}</span>
                    <span className="card-label">{opt.label}</span>
                    <span className="card-value">{opt.value}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="setting-group">
              <label>Resolution</label>
              <div className="radio-cards">
                {[
                  { value: '1K', label: 'Standard', desc: 'Fast' },
                  { value: '2K', label: 'High', desc: 'Balanced' },
                  { value: '4K', label: 'Ultra', desc: 'Best Quality' }
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`radio-card ${resolution === opt.value ? 'selected' : ''}`}
                    onClick={() => setResolution(opt.value)}
                  >
                    <span className="card-label">{opt.label}</span>
                    <span className="card-value">{opt.value}</span>
                    <span className="card-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Reference Images Section */}
          <section className="reference-section">
            <h2>Reference Images <span className="optional">(Optional)</span></h2>
            <p className="section-hint">Add images to guide the AI's output style or content</p>

            <div className="reference-images">
              {referenceImages.map((img, idx) => (
                <div key={idx} className="ref-image-card">
                  <img src={img.data} alt={img.name} />
                  <button className="remove-btn" onClick={() => removeImage(idx)}>×</button>
                  <span className="ref-name">{img.name}</span>
                </div>
              ))}

              <button
                className="add-image-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="plus">+</span>
                <span>Add Image</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>
          </section>

          {/* Prompt Section */}
          <section className="prompt-section">
            <h2>Your Prompt</h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to create...&#10;&#10;Example: A serene mountain landscape at sunset with a crystal clear lake in the foreground, dramatic clouds, photorealistic style"
              rows={4}
            />

            <button
              className="generate-btn"
              onClick={generateImage}
              disabled={isGenerating || !prompt.trim()}
            >
              {isGenerating ? (
                <>
                  <span className="spinner"></span>
                  Generating...
                </>
              ) : (
                <>🎨 Generate Image</>
              )}
            </button>

            {error && <div className="error-message">{error}</div>}
          </section>
        </div>

        {/* Output Panel */}
        <div className="output-panel">
          <h2>Generated Image</h2>

          <div className="image-display">
            {generatedImage ? (
              <>
                <img src={generatedImage} alt="Generated" />
                <div className="image-actions">
                  <button onClick={downloadImage} className="download-btn">
                    ⬇️ Download
                  </button>
                </div>
              </>
            ) : (
              <div className="placeholder">
                <span className="placeholder-icon">🖼️</span>
                <p>Your generated image will appear here</p>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="history-section">
              <h3>Recent Generations</h3>
              <div className="history-grid">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="history-item"
                    onClick={() => setGeneratedImage(item.image)}
                  >
                    <img src={item.image} alt={item.prompt} />
                    <span className="history-time">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
