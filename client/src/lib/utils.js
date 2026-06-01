// ── Text extraction ──────────────────────────────────────────────
export const SKILL_KWS = [
  'Python','JavaScript','TypeScript','Java','C++','C#','R','SQL','NoSQL',
  'React','Node.js','Angular','Vue','Django','Flask','FastAPI',
  'Machine Learning','Deep Learning','NLP','Computer Vision','Data Analysis',
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD',
  'Git','GitHub','Agile','Scrum','TensorFlow','PyTorch','Scikit-learn',
  'Excel','Tableau','Power BI','Spark','Kafka','Airflow',
  'Project Management','Leadership','Communication','Problem Solving',
  'Critical Thinking','Stakeholder Management','Public Speaking'
]

export function extractSkills(text) {
  const found = SKILL_KWS.filter(k => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text))
  return found.length ? found.join(', ') : 'Data Analysis, Communication, Problem Solving'
}

export function extractRole(jd) {
  const m = jd.match(/(?:position|role|title)[:\s]+([^\n\r,\.]{4,50})/i) ||
            jd.match(/seeking\s+(?:a|an)\s+([^\n\r,\.]{4,50})/i)
  return m ? m[1].trim() : ''
}

export function extractDomain(jd) {
  const domains = ['Healthcare','Finance','Education','Technology','Manufacturing',
    'Retail','Logistics','Cybersecurity','Artificial Intelligence',
    'Data Science','Cloud Computing','Biotechnology','Legal']
  for (const d of domains) if (new RegExp(d, 'i').test(jd)) return d
  return 'Technology'
}

export function detectCo(jd) {
  const pats = [
    /^Company:\s*(.+)$/im,
    /^Organization:\s*(.+)$/im,
    /(?:at|join|with)\s+([A-Z][A-Za-z0-9&\-\s]{2,30}(?:Inc|LLC|Corp|Ltd|Co|Company|Technologies|Solutions|Systems|Group|Services|Healthcare|University|Institute)\.?)\b/,
    /([A-Z][A-Za-z0-9&\-\s]{2,25})\s+is\s+(?:seeking|hiring|looking\s+for)/i
  ]
  for (const p of pats) {
    const m = jd.match(p)
    if (m) return m[1].trim().replace(/\.$/, '')
  }
  return ''
}

// ── CIP classification ───────────────────────────────────────────
const CIP_MAP = [
  ['11','Computer & Information Sciences',['computer','software','information technology','programming','data','cybersecurity','ai','machine learning','algorithm']],
  ['14','Engineering',['engineering','mechanical','electrical','civil','chemical','biomedical','systems']],
  ['52','Business & Management',['business','management','marketing','finance','accounting','economics','mba','entrepreneurship']],
  ['51','Health Professions',['nursing','medicine','healthcare','public health','pharmacy','clinical','medical','patient']],
  ['13','Education',['education','teaching','curriculum','pedagogy','instruction','learning','classroom']],
  ['42','Psychology',['psychology','counseling','behavioral','mental health','cognitive','neuroscience']],
  ['45','Social Sciences',['sociology','political science','economics','anthropology','social work']],
  ['26','Biological Sciences',['biology','biochemistry','genetics','microbiology','ecology','genomics']],
  ['40','Physical Sciences',['physics','chemistry','mathematics','statistics','astronomy','geology']],
  ['50','Arts & Media',['design','art','music','film','media','creative','ux','graphic']],
]

export function classifyCIP(text) {
  const t = text.toLowerCase()
  let best = ['99', 'Undeclared'], hi = 0
  for (const [code, lbl, kws] of CIP_MAP) {
    const s = kws.filter(k => t.includes(k)).length
    if (s > hi) { hi = s; best = [code, lbl] }
  }
  return best
}

// ── Leaderboard simulation ───────────────────────────────────────
export const LB_PEERS = [
  ['A. Johnson',87],['M. Patel',83],['K. Williams',79],['L. Chen',75],
  ['B. Davis',71],['R. Martinez',67],['S. Thompson',63],['N. Brown',58],
  ['C. Garcia',54],['T. Wilson',50],['J. Anderson',45],['P. Moore',40],
]
export const LB_SCALE = [1, 1.05, 1.15, 1.3, 1.55, 2, 2.8]

export function buildLeaderboard(compScore, name, privacy, lbLevel) {
  const scale = LB_SCALE[lbLevel] || 1
  const myScore = Math.max(0, Math.round(compScore / scale))
  const myName  = privacy === 'anonymous'
    ? (name || 'You').split(' ').map(x => x[0] + '.').join(' ')
    : privacy === 'hidden' ? null
    : name || 'You'

  const entries = LB_PEERS.map(([n, s]) => ({ n, s: Math.max(1, Math.round(s / scale)) }))
  if (myName) entries.push({ n: myName, s: myScore, you: true })
  entries.sort((a, b) => b.s - a.s)
  return entries.slice(0, 10)
}
