import { useState, useEffect } from 'react'
import { getAllDates } from '../aws/dynamoClient'
import GalleryDateGroup from './GalleryDateGroup'

export default function Gallery({ userHash }) {
  const [dates, setDates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadDates = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getAllDates(userHash)
      setDates(result)
    } catch (err) {
      console.error('Failed to load gallery dates:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDates() }, [])

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2>Image Gallery</h2>
        <button className="text-btn" onClick={loadDates} disabled={loading}>
          Refresh
        </button>
      </div>

      {loading && (
        <div className="gallery-loading">Loading gallery...</div>
      )}

      {error && (
        <div className="error-message">
          Failed to load gallery: {error}
        </div>
      )}

      {!loading && !error && dates.length === 0 && (
        <div className="gallery-empty">
          <span className="gallery-empty-icon">📁</span>
          <p>No images saved yet.</p>
          <p>Generate some images and they'll appear here automatically.</p>
        </div>
      )}

      <div className="gallery-dates">
        {dates.map(date => (
          <GalleryDateGroup key={date} dateKey={date} userHash={userHash} />
        ))}
      </div>
    </div>
  )
}
