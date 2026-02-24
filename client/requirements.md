## Packages
framer-motion | Page transitions and scroll-triggered animations
recharts | Dashboard analytics charts and data visualization
date-fns | Human-readable date formatting
lucide-react | High-quality icons for UI

## Notes
- Tailwind Config: Need to extend fontFamily with `display: ["var(--font-display)"]` and `sans: ["var(--font-sans)"]`.
- WebSocket/Real-time is not heavily used in this specific build, but standard CRUD REST endpoints are fully utilized.
- Auth uses session/cookie-based persistence via `/api/me`.
- CSV Uploads expect POST `/api/upload/csv` with `multipart/form-data`.
- External job applications will open in a new tab if `isExternalApply` is true on the job record.
