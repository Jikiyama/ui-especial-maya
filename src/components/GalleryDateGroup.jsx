import { useState, useEffect } from 'react'
import { getImagesForDate } from '../aws/dynamoClient'
import { getImageUrl } from '../aws/s3Client'

export default function GalleryDateGroup({ dateKey, userHash }) {
  const [expanded, setExpanded] = useState(false)
  const [images, setImages] = useState([])
  const [imageUrls, setImageUrls] = useState({})
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  const toggle = () => setExpanded(prev => !prev)

  useEffect(() => {
    if (!expanded || loaded) return

    let cancelled = false

    async function loadImages() {
      setLoading(true)
      try {
        const items = await getImagesForDate(userHash, dateKey)
        if (cancelled) return
        setImages(items)

        for (const item of items) {
          if (cancelled) break
          try {
            const url = await getImageUrl(item.s3Key)
            if (!cancelled) {
              setImageUrls(prev => ({ ...prev, [item.imageId]: url }))
            }
          } catch (err) {
            console.warn(`Failed to load image ${item.imageId}:`, err)
          }
        }
      } catch (err) {
        console.error('Failed to load images for date:', err)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      }
    }

    loadImages()
    return () => { cancelled = true }
  }, [expanded, loaded, dateKey])

  useEffect(() => {
    if (!expanded && loaded) {
      Object.values(imageUrls).forEach(url => URL.revokeObjectURL(url))
      setImageUrls({})
      setLoaded(false)
      setSelectedImage(null)
    }
  }, [expanded])

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-')
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const downloadImage = (url, imageId, format) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `gpt_image_${imageId}.${format || 'png'}`
    link.click()
  }

  return (
    <div className="date-group">
      <button className="date-header" onClick={toggle}>
        <span className="date-label">{formatDate(dateKey)}</span>
        <div className="date-header-right">
          {loaded && <span className="date-count">{images.length} image{images.length !== 1 ? 's' : ''}</span>}
          <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {expanded && (
        <div className="date-images">
          {loading && images.length === 0 && (
            <div className="gallery-loading">Loading images...</div>
          )}

          {selectedImage && (
            <div className="gallery-preview">
              <img src={imageUrls[selectedImage.imageId]} alt={selectedImage.prompt} />
              <div className="gallery-preview-info">
                <p className="gallery-preview-prompt">{selectedImage.prompt}</p>
                <div className="gallery-preview-meta">
                  <span>{selectedImage.size}</span>
                  <span>{selectedImage.quality}</span>
                  <span>{selectedImage.format?.toUpperCase()}</span>
                </div>
                <div className="gallery-preview-actions">
                  <button
                    className="download-btn"
                    onClick={() => downloadImage(imageUrls[selectedImage.imageId], selectedImage.imageId, selectedImage.format)}
                  >
                    ⬇️ Download
                  </button>
                  <button className="download-btn" onClick={() => setSelectedImage(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="gallery-grid">
            {images.map(item => (
              <div
                key={item.imageId}
                className={`gallery-item ${selectedImage?.imageId === item.imageId ? 'active' : ''}`}
                onClick={() => setSelectedImage(item)}
              >
                {imageUrls[item.imageId] ? (
                  <img src={imageUrls[item.imageId]} alt={item.prompt} />
                ) : (
                  <div className="image-skeleton" />
                )}
                <div className="gallery-item-info">
                  <span className="gallery-item-time">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="gallery-item-prompt" title={item.prompt}>
                    {item.prompt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
