import express, { Application, NextFunction, Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import storeRoutes from './routes/storeRoutes'
import {
  addSnapshot,
  blueprintHtml,
  deriveProject,
  generateTakeoff,
  getProject,
  listProjects,
  mapSuppliers,
  saveProject,
  searchSuppliers,
  takeoffCsv,
  validateProject,
  type ApiProjectDocument,
} from './services/bimService'

dotenv.config()

const app: Application = express()

// Middleware
app.use(cors())
app.use(helmet())
app.use(express.json())

// Structured request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(JSON.stringify({ time: new Date().toISOString(), method: req.method, path: req.path }))
  next()
})

// Store / supplier comparison routes
app.use('/api/store', storeRoutes)

// Health check endpoint (defined before DB connection so it always works)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', dbConnected: false })
})

app.get('/api/projects', (_req: Request, res: Response) => {
  res.json({ projects: listProjects() })
})

app.post('/api/projects', (req: Request, res: Response) => {
  const project = req.body as ApiProjectDocument
  res.status(201).json({ project: saveProject(project) })
})

app.get('/api/projects/:id', (req: Request, res: Response) => {
  const project = getProject(req.params.id)
  if (!project) {
    res.status(404).json({ error: 'Project not found' })
    return
  }
  res.json({ project })
})

app.put('/api/projects/:id', (req: Request, res: Response) => {
  const project = { ...(req.body as ApiProjectDocument), id: req.params.id }
  res.json({ project: saveProject(project) })
})

app.post('/api/projects/:id/snapshots', (req: Request, res: Response) => {
  const project = { ...(req.body as ApiProjectDocument), id: req.params.id }
  res.status(201).json({ snapshot: addSnapshot(req.params.id, project) })
})

app.post('/api/geometry/derive', (req: Request, res: Response) => {
  res.json({ derived: deriveProject(req.body as ApiProjectDocument) })
})

app.post('/api/validate', (req: Request, res: Response) => {
  res.json({ results: validateProject(req.body as ApiProjectDocument) })
})

app.post('/api/takeoff', (req: Request, res: Response) => {
  res.json({ takeoff: generateTakeoff(req.body as ApiProjectDocument) })
})

app.post('/api/suppliers/search', (req: Request, res: Response) => {
  const query = typeof req.body.query === 'string' ? req.body.query : ''
  const zipCode = typeof req.body.zipCode === 'string' ? req.body.zipCode : '96813'
  res.json({ products: searchSuppliers(query, zipCode) })
})

app.post('/api/suppliers/map', (req: Request, res: Response) => {
  const takeoff = generateTakeoff(req.body as ApiProjectDocument)
  const zipCode = typeof req.body?.suppliers?.zipCode === 'string' ? req.body.suppliers.zipCode : '96813'
  res.json({ products: mapSuppliers(takeoff.lines, zipCode) })
})

app.post('/api/export/project-json', (req: Request, res: Response) => {
  res.type('application/json').send(JSON.stringify(req.body, null, 2))
})

app.post('/api/export/bom-csv', (req: Request, res: Response) => {
  const takeoff = generateTakeoff(req.body as ApiProjectDocument)
  res.type('text/csv').send(takeoffCsv(takeoff.lines))
})

app.post('/api/export/blueprint-pdf', (req: Request, res: Response) => {
  const project = req.body as ApiProjectDocument
  const takeoff = generateTakeoff(project)
  res.type('text/html').send(blueprintHtml(project, takeoff.lines))
})

// Catch-all error handler — must have 4 params for Express to recognise it
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error'
  console.error('[error]', err)
  res.status(500).json({ error: 'Internal server error', message })
})

// Start server regardless of database connection
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Server attempting to start on http://localhost:${PORT}`)
  console.log('Database connection: deferred (configure DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME in .env)')
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`ERROR: Port ${PORT} is already in use. Please kill the process or set a different PORT in your .env file.`);
    process.exit(1);
  } else {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
})

export default app
