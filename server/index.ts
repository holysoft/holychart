import express from 'express'
import cors from 'cors'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
const port = parseInt(process.env.PORT ?? '3001', 10)

app.use(cors())
app.use(express.json())

const apiKey = process.env.ANTHROPIC_API_KEY
const anthropic = apiKey ? new Anthropic({ apiKey }) : null

if (!anthropic) {
  console.warn('ANTHROPIC_API_KEY not set — AI icon matching disabled. Add it to .env to enable.')
}

app.post('/api/icon-match', async (req, res) => {
  const { word } = req.body as { word?: string }

  if (!word || typeof word !== 'string') {
    res.status(400).json({ error: 'word is required' })
    return
  }

  if (!anthropic) {
    res.status(503).json({ iconName: null, error: 'No API key configured' })
    return
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: `Return exactly one Iconify icon name in the format "mdi:icon-name" that best represents the concept: "${word}".

Rules:
- Only mdi (Material Design Icons) collection
- Format: mdi:icon-name (kebab-case, no spaces)
- Respond with ONLY the icon name, nothing else

Examples: mdi:server, mdi:database, mdi:cloud, mdi:shield-lock, mdi:kubernetes, mdi:docker, mdi:brain, mdi:cached, mdi:transfer, mdi:webhook, mdi:function-variant, mdi:account, mdi:cog, mdi:chart-bar, mdi:laptop`,
      }],
    })

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:-]/g, '')

    const iconName = text.match(/mdi:[a-z0-9-]+/)?.[0] ?? null
    res.json({ iconName })
  } catch (err) {
    console.error('Anthropic API error:', err)
    res.status(500).json({ iconName: null, error: 'AI service error' })
  }
})

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', aiEnabled: !!anthropic })
})

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
