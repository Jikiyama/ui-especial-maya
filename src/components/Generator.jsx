import { useState } from 'react'
import OpenAI from 'openai'
import { uploadImage } from '../aws/s3Client'
import { saveImageMetadata } from '../aws/dynamoClient'
import { IDENTITY_POOL_ID } from '../aws/config'

export default function Generator({ apiKey, userHash }) {
  const [aspectRatio, setAspectRatio] = useState('square')
  const [resolution, setResolution] = useState('1K')
  const [quality, setQuality] = useState('high')
  const [numImages, setNumImages] = useState(1)
  const [background, setBackground] = useState('auto')
  const [outputFormat, setOutputFormat] = useState('png')
  const [compression, setCompression] = useState(100)

  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [saveStatus, setSaveStatus] = useState('')

  const getMimeType = () => {
    if (outputFormat === 'jpeg') return 'image/jpeg'
    if (outputFormat === 'webp') return 'image/webp'
    return 'image/png'
  }

  const autoSaveImages = async (images, promptText, sizeValue) => {
    if (!IDENTITY_POOL_ID) return
    setSaveStatus('saving')
    try {
      const now = new Date()
      const dateKey = now.toISOString().split('T')[0]

      await Promise.all(images.map(async (dataUrl, index) => {
        const timestamp = new Date(now.getTime() + index).toISOString()
        const { s3Key, imageId } = await uploadImage(dataUrl, outputFormat, userHash)
        await saveImageMetadata({
          userHash,
          dateKey,
          timestamp,
          imageId,
          s3Key,
          prompt: promptText,
          format: outputFormat,
          size: sizeValue,
          quality,
        })
      }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 3000)
    } catch (err) {
      console.warn('Auto-save failed:', err)
      setSaveStatus('failed')
      setTimeout(() => setSaveStatus(''), 5000)
    }
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    setIsGenerating(true)
    setError('')
    setGeneratedImages([])
    setSelectedImage(null)

    const sizeMap = {
      'square-1K': '1024x1024',
      'square-2K': '2048x2048',
      'square-4K': '2880x2880',
      'landscape-1K': '1536x1024',
      'landscape-2K': '2048x1536',
      'landscape-4K': '3840x2160',
      'portrait-1K': '1024x1536',
      'portrait-2K': '1536x2048',
      'portrait-4K': '2160x3840',
    }

    const size = aspectRatio === 'auto'
      ? 'auto'
      : sizeMap[`${aspectRatio}-${resolution}`]

    try {
      const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      })

      const params = {
        model: 'gpt-image-2',
        prompt,
        n: numImages,
        size,
        quality,
        background,
        output_format: outputFormat,
      }

      if (outputFormat !== 'png') {
        params.output_compression = compression
      }

      const response = await openai.images.generate(params)

      const mimeType = getMimeType()
      const images = response.data.map((img) =>
        `data:${mimeType};base64,${img.b64_json}`
      )

      setGeneratedImages(images)
      setSelectedImage(images[0])

      setHistory(prev => [
        ...images.map(img => ({
          prompt,
          image: img,
          timestamp: new Date().toLocaleTimeString()
        })),
        ...prev
      ].slice(0, 10))

      autoSaveImages(images, prompt, size)

    } catch (err) {
      console.error(err)
      setError(`Error: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadImage = () => {
    if (!selectedImage) return
    const link = document.createElement('a')
    link.href = selectedImage
    link.download = `gpt_image_${Date.now()}.${outputFormat}`
    link.click()
  }

  const downloadAll = () => {
    generatedImages.forEach((img, i) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = img
        link.download = `gpt_image_${Date.now()}_${i + 1}.${outputFormat}`
        link.click()
      }, i * 100)
    })
  }

  return (
    <main>
      <div className="controls-panel">
        <section className="settings-section">
          <h2>Image Settings</h2>

          <div className="setting-group">
            <label>Aspect Ratio</label>
            <div className="radio-cards">
              {[
                { value: 'auto', label: 'Auto', icon: '✨' },
                { value: 'square', label: 'Square', icon: '◻️' },
                { value: 'landscape', label: 'Widescreen', icon: '🖼️' },
                { value: 'portrait', label: 'Portrait', icon: '📱' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`radio-card ${aspectRatio === opt.value ? 'selected' : ''}`}
                  onClick={() => setAspectRatio(opt.value)}
                >
                  <span className="card-icon">{opt.icon}</span>
                  <span className="card-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {aspectRatio !== 'auto' && (
            <div className="setting-group">
              <label>Resolution</label>
              <div className="radio-cards">
                {[
                  { value: '1K', label: 'Standard', desc: 'Fast' },
                  { value: '2K', label: 'High', desc: 'Balanced' },
                  { value: '4K', label: 'Ultra', desc: 'Best Detail' },
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
          )}

          <div className="setting-group">
            <label>Quality</label>
            <div className="radio-cards">
              {[
                { value: 'low', label: 'Standard', desc: 'Fast' },
                { value: 'medium', label: 'High', desc: 'Balanced' },
                { value: 'high', label: 'Ultra', desc: 'Best Quality' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`radio-card ${quality === opt.value ? 'selected' : ''}`}
                  onClick={() => setQuality(opt.value)}
                >
                  <span className="card-label">{opt.label}</span>
                  <span className="card-value">{opt.value}</span>
                  <span className="card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>Number of Images</label>
            <div className="radio-cards">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`radio-card ${numImages === n ? 'selected' : ''}`}
                  onClick={() => setNumImages(n)}
                >
                  <span className="card-label">{n}</span>
                  <span className="card-desc">{n === 1 ? 'Single' : `${n} Images`}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setting-group">
            <label>Background</label>
            <div className="radio-cards two-col">
              {[
                { value: 'auto', label: 'Auto', desc: 'AI decides' },
                { value: 'opaque', label: 'Opaque', desc: 'Solid background' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`radio-card ${background === opt.value ? 'selected' : ''}`}
                  onClick={() => setBackground(opt.value)}
                >
                  <span className="card-label">{opt.label}</span>
                  <span className="card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Output Settings</h2>

          <div className="setting-group">
            <label>Format</label>
            <div className="radio-cards">
              {[
                { value: 'png', label: 'PNG', desc: 'Lossless' },
                { value: 'jpeg', label: 'JPEG', desc: 'Smaller' },
                { value: 'webp', label: 'WebP', desc: 'Modern' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`radio-card ${outputFormat === opt.value ? 'selected' : ''}`}
                  onClick={() => setOutputFormat(opt.value)}
                >
                  <span className="card-label">{opt.label}</span>
                  <span className="card-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {outputFormat !== 'png' && (
            <div className="setting-group">
              <label>Compression: {compression}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={compression}
                onChange={(e) => setCompression(Number(e.target.value))}
                className="compression-slider"
              />
              <div className="slider-labels">
                <span>Smaller file</span>
                <span>Best quality</span>
              </div>
            </div>
          )}
        </section>

        <section className="prompt-section">
          <h2>Your Prompt</h2>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={"Describe the image you want to create...\n\nExample: A serene mountain landscape at sunset with a crystal clear lake in the foreground, dramatic clouds, photorealistic style"}
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
              <>✨ Generate Image{numImages > 1 ? 's' : ''}</>
            )}
          </button>

          {saveStatus === 'saving' && (
            <div className="save-status saving">Saving to gallery...</div>
          )}
          {saveStatus === 'saved' && (
            <div className="save-status saved">Saved to gallery</div>
          )}
          {saveStatus === 'failed' && (
            <div className="save-status failed">Gallery save failed (image still available above)</div>
          )}

          {error && <div className="error-message">{error}</div>}
        </section>
      </div>

      <div className="output-panel">
        <h2>Generated Image{generatedImages.length > 1 ? 's' : ''}</h2>

        <div className="image-display">
          {selectedImage ? (
            <>
              <img src={selectedImage} alt="Generated" />
              <div className="image-actions">
                <button onClick={downloadImage} className="download-btn">
                  ⬇️ Download
                </button>
                {generatedImages.length > 1 && (
                  <button onClick={downloadAll} className="download-btn">
                    ⬇️ Download All
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="placeholder">
              <span className="placeholder-icon">🖼️</span>
              <p>Your generated image will appear here</p>
            </div>
          )}
        </div>

        {generatedImages.length > 1 && (
          <div className="generated-grid">
            {generatedImages.map((img, idx) => (
              <div
                key={idx}
                className={`generated-thumb ${selectedImage === img ? 'active' : ''}`}
                onClick={() => setSelectedImage(img)}
              >
                <img src={img} alt={`Generated ${idx + 1}`} />
                <span className="thumb-label">#{idx + 1}</span>
              </div>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <h3>Recent Generations</h3>
            <div className="history-grid">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  className="history-item"
                  onClick={() => setSelectedImage(item.image)}
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
  )
}
