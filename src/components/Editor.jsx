import { useState, useRef } from 'react'
import OpenAI from 'openai'
import { uploadImage } from '../aws/s3Client'
import { saveImageMetadata } from '../aws/dynamoClient'
import { IDENTITY_POOL_ID } from '../aws/config'

const MAX_REFERENCE_IMAGES = 16

export default function Editor({ apiKey, userHash }) {
  const [aspectRatio, setAspectRatio] = useState('auto')
  const [resolution, setResolution] = useState('1K')
  const [quality, setQuality] = useState('high')
  const [numImages, setNumImages] = useState(1)
  const [outputFormat, setOutputFormat] = useState('png')
  const [compression, setCompression] = useState(100)

  const [referenceImages, setReferenceImages] = useState([])
  const fileInputRef = useRef(null)

  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState([])
  const [selectedImage, setSelectedImage] = useState(null)
  const [error, setError] = useState('')
  const [saveStatus, setSaveStatus] = useState('')

  const getMimeType = () => {
    if (outputFormat === 'jpeg') return 'image/jpeg'
    if (outputFormat === 'webp') return 'image/webp'
    return 'image/png'
  }

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files)
    const valid = files.filter(f =>
      ['image/png', 'image/jpeg', 'image/webp'].includes(f.type)
    )

    valid.forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setReferenceImages(prev => {
          if (prev.length >= MAX_REFERENCE_IMAGES) return prev
          return [...prev, { name: file.name, data: ev.target.result, file }]
        })
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }

  const removeImage = (index) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index))
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

  const editImage = async () => {
    if (referenceImages.length === 0) {
      setError('Please add at least one reference image')
      return
    }
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
        image: referenceImages.map(img => img.file),
        prompt,
        n: numImages,
        size,
        quality,
        output_format: outputFormat,
      }

      if (outputFormat !== 'png') {
        params.output_compression = compression
      }

      const response = await openai.images.edit(params)

      const mimeType = getMimeType()
      const images = response.data.map((img) =>
        `data:${mimeType};base64,${img.b64_json}`
      )

      setGeneratedImages(images)
      setSelectedImage(images[0])

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
    link.download = `gpt_edit_${Date.now()}.${outputFormat}`
    link.click()
  }

  const downloadAll = () => {
    generatedImages.forEach((img, i) => {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = img
        link.download = `gpt_edit_${Date.now()}_${i + 1}.${outputFormat}`
        link.click()
      }, i * 100)
    })
  }

  return (
    <main>
      <div className="controls-panel">
        <section className="reference-section">
          <h2>Reference Images <span className="optional">(1–16 required)</span></h2>
          <p className="section-hint">The model edits and combines these images based on your prompt</p>

          <div className="reference-images">
            {referenceImages.map((img, idx) => (
              <div key={idx} className="ref-image-card">
                <img src={img.data} alt={img.name} />
                <button className="remove-btn" onClick={() => removeImage(idx)}>×</button>
                <span className="ref-name">{img.name}</span>
              </div>
            ))}

            {referenceImages.length < MAX_REFERENCE_IMAGES && (
              <button
                className="add-image-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="plus">+</span>
                <span>Add Image</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        </section>

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
            placeholder={"Describe how to edit or combine the reference images...\n\nExample: Combine these into a single cohesive scene, place the product on a marble countertop with soft studio lighting"}
            rows={4}
          />

          <button
            className="generate-btn"
            onClick={editImage}
            disabled={isGenerating || !prompt.trim() || referenceImages.length === 0}
          >
            {isGenerating ? (
              <>
                <span className="spinner"></span>
                Editing...
              </>
            ) : (
              <>🎨 Edit Image{numImages > 1 ? 's' : ''}</>
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
        <h2>Edited Image{generatedImages.length > 1 ? 's' : ''}</h2>

        <div className="image-display">
          {selectedImage ? (
            <>
              <img src={selectedImage} alt="Edited" />
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
              <p>Your edited image will appear here</p>
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
                <img src={img} alt={`Edited ${idx + 1}`} />
                <span className="thumb-label">#{idx + 1}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
