# Sirat Backend 🔧

Node.js + Express API server providing AI-powered dua search using OpenAI GPT-4.

---

## 🚀 Quick Start

```bash
npm install
npm run dev
```

The server will start on `http://localhost:3000`

---

## 📁 Structure

```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── middleware/     # Error handling
│   ├── config/         # Configuration
│   └── utils/          # Helper functions
├── public/
│   └── duas.json       # Dua database
└── package.json
```

---

## 🔧 Configuration

Create a `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key
PORT=3000
NODE_ENV=development
```

---

## 🏗️ Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **AI:** OpenAI GPT-4 API
- **Deployment:** Railway

---

## 📡 API Endpoints

### `POST /api/dua/search`

Search for duas using natural language queries.

**Request Body:**

```json
{
  "query": "dua for patience"
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "123",
      "arabic": "...",
      "transliteration": "...",
      "translation": "...",
      "reference": "..."
    }
  ]
}
```

---

## 🧪 Development

```bash
npm run dev      # Start with hot reload
npm run build    # Build TypeScript
npm start        # Run production build
```

---

## 📚 Documentation

- OpenAI integration in `src/services/openaiService.ts`
- Dua database management in `src/utils/duaDatabase.ts`
- API routes defined in `src/routes/dua.ts`
