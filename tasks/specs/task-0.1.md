# Task 0.1 — Initialise Project Structure

## Phase
0

## Description
Create the following directory layout:

```
babytracker/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── babies.py
│   │   ├── users.py
│   │   ├── feeds.py
│   │   ├── sleeps.py
│   │   ├── diapers.py
│   │   ├── pumps.py
│   │   ├── measurements.py
│   │   ├── milestones.py
│   │   ├── calendar.py
│   │   └── settings.py
│   └── requirements.txt
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── context/
        ├── pages/
        ├── components/
        └── hooks/
```

**requirements.txt:**
```
fastapi>=0.111.0
uvicorn[standard]>=0.29.0
sqlalchemy[asyncio]>=2.0.0
aiosqlite>=0.20.0
pydantic>=2.0.0
python-dateutil>=2.9.0
```

**package.json dependencies:**
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## Acceptance Criteria
Directory structure exists, `pip install -r requirements.txt` succeeds, `npm install` succeeds.

## Verify Scope
both
