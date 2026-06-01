export default function StarRating({ value, onChange }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star${value >= n ? ' on' : ''}`}
          onClick={() => onChange(n)}
          onMouseEnter={() => {}}
        >★</span>
      ))}
    </div>
  )
}
