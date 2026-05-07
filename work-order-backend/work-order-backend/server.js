const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const pool = require('./db');
const app  = express();

app.use(cors());
app.use(express.json());

// ── Helper: generate 3-digit work_id ─────────────────────────────
// Finds the max existing work_id and increments, padded to 3 digits
async function generateWorkId(client) {
  const result = await client.query(
    `SELECT MAX(CAST(work_id AS INTEGER)) as max_id FROM work_order_items`
  );
  const maxId = result.rows[0].max_id || 0;
  return String(maxId + 1).padStart(3, '0');
}

// ── GET /api/items/search?q=<query> ──────────────────────────────
app.get('/api/items/search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.json([]);
  try {
    const sql = `
      SELECT
        sl_no            AS id,
        item_description AS description,
        unit,
        rate
      FROM finished
      WHERE LOWER(item_description) LIKE LOWER($1)
      ORDER BY
        CASE WHEN LOWER(item_description) LIKE LOWER($2) THEN 0 ELSE 1 END,
        item_description
      LIMIT 20
    `;
    const result = await pool.query(sql, [`%${query}%`, `${query}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── GET /api/items/:slno ─────────────────────────────────────────
app.get('/api/items/:slno', async (req, res) => {
  const { slno } = req.params;
  try {
    const sql = `
      SELECT sl_no AS id, item_description AS description, unit, rate
      FROM finished WHERE sl_no = $1
    `;
    const result = await pool.query(sql, [slno]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch item error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── GET /api/items ───────────────────────────────────────────────
app.get('/api/items', async (req, res) => {
  try {
    const sql = `
      SELECT sl_no AS id, item_description AS description, unit, rate
      FROM finished ORDER BY sl_no
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch all error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── POST /api/save-work-order ────────────────────────────────────
// Saves all items into work_order_items table.
// Generates:
//   work_id  = 3-digit number e.g. "001", "002"
//   item_id  = work_id + "_" + 2-digit item seq e.g. "001_01", "001_02"
//
// Make sure your work_order_items table has these columns:
//   work_id  TEXT
//   item_id  TEXT
//
// ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS work_id TEXT;
// ALTER TABLE work_order_items ADD COLUMN IF NOT EXISTS item_id TEXT;

app.post('/api/save-work-order', async (req, res) => {
  const { nameOfWork, division, circle, ward, items, savedBy, designation } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items to save' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const workId = await generateWorkId(client);
    const savedItems = [];

    for (let i = 0; i < items.length; i++) {
      const item    = items[i];
      const itemSeq = String(i + 1).padStart(2, '0');
      const itemId  = `${workId}_${itemSeq}`;

      await client.query(
        `INSERT INTO work_order_items
           (work_id, item_id, name_of_work, division, circle, ward, sl_no,
            description, numbers, length, breadth, depth,
            quantity, unit, rate, amount, is_material,
            current_stage, status, submitted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          workId, itemId,
          nameOfWork, division, circle, ward,
          i + 1,
          item.description,
          item.numbers  || 0,
          item.length   || 0,
          item.breadth  || 0,
          item.depth    || 0,
          item.quantity || 0,
          item.unit     || '',
          item.rate     || 0,
          item.amount   || 0,
          item.isMaterial === 'Yes',
          'Manager',   // always starts at Manager stage
          'draft',
          savedBy || ''
        ]
      );

      savedItems.push({ ...item, workId, itemId });
    }

    await client.query('COMMIT');
    res.json({ success: true, workId, savedItems });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Save work order error:', err.message);
    res.status(500).json({ error: 'Failed to save work order items', detail: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/save-abstract ──────────────────────────────────────
// Saves abstract summary. work_id links it to the work_order_items.
//
// ALTER TABLE abstracts ADD COLUMN IF NOT EXISTS work_id TEXT;

app.post('/api/save-abstract', async (req, res) => {
  const { workId, nameOfWork, materialTotal, civilWorksTotal, gstRate, gstAmount, lsAmount, grandTotal, editedBy } = req.body;
  try {
    await pool.query(
      `INSERT INTO abstracts
         (work_id, name_of_work, material_total, civil_works_total,
          gst_rate, gst_amount, ls_amount, grand_total, edited_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [workId, nameOfWork, materialTotal, civilWorksTotal, gstRate, gstAmount, lsAmount || 0, grandTotal, editedBy || '']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Save abstract error:', err.message);
    res.status(500).json({ error: 'Failed to save abstract', detail: err.message });
  }
});

// ── POST /api/login ──────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, username, password, designation, department, ward, contact_number
       FROM users WHERE username = $1`,
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    res.json({
      success: true,
      user: {
        id:            user.id,
        name:          user.name,
        username:      user.username,
        designation:   user.designation,
        department:    user.department,
        ward:          user.ward || null,
        contactNumber: user.contact_number
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});



// ── HIERARCHY CONFIG ─────────────────────────────────────────────
const HIERARCHY = ['Manager', 'DGM', 'GM', 'CGM', 'Director'];

function getNextStageInHierarchy(stage) {
  const idx = HIERARCHY.indexOf(stage);
  return idx >= 0 && idx < HIERARCHY.length - 1 ? HIERARCHY[idx + 1] : null;
}

function canEditWork(userDesignation, workCurrentStage) {
  // User can edit if work is currently at their stage
  return userDesignation === workCurrentStage;
}

function canViewWork(userDesignation, workCurrentStage) {
  // User can view if work has passed through their stage or is at/above their stage
  const userIdx = HIERARCHY.indexOf(userDesignation);
  const stageIdx = HIERARCHY.indexOf(workCurrentStage);
  return userIdx <= stageIdx; // can view if work is at or above their level
}

// ── GET /api/works/check?workId=<id>&designation=<des> ──────────
// Hierarchy (bottom to top): Manager -> DGM -> GM -> CGM -> Director
// Rules:
//   Director always gets edit
//   designation === current_stage -> edit
//   everyone else -> view only
app.get('/api/works/check', async (req, res) => {
  const { workId, designation } = req.query;
  if (!workId || !designation) {
    return res.status(400).json({ error: 'workId and designation are required' });
  }

  try {
    const sql = `
      SELECT DISTINCT ON (work_id)
        work_id, name_of_work, division, circle, ward,
        current_stage, status, submitted_by, created_at
      FROM work_order_items
      WHERE work_id = $1 OR LOWER(name_of_work) LIKE LOWER($2)
      ORDER BY work_id, created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(sql, [workId.trim(), `%${workId.trim()}%`]);

    if (result.rows.length === 0) {
      return res.json({ exists: false });
    }

    const work = result.rows[0];

    // Get last submission info
    const subResult = await pool.query(
      `SELECT submitted_at, from_stage, to_stage, submitted_by
       FROM work_submissions
       WHERE work_id = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [work.work_id]
    );
    const lastSub = subResult.rows.length > 0 ? subResult.rows[0] : null;

    // Access logic
    let access = 'view';
    if (designation === 'Director') {
      access = 'edit';  // Director always edits
    } else if (designation === work.current_stage) {
      access = 'edit';  // Work is waiting at this person's level
    }
    // All others (submitter and above-but-not-yet-reached) = view

    res.json({
      exists:            true,
      access,
      work_id:           work.work_id,
      name_of_work:      work.name_of_work,
      division:          work.division,
      circle:            work.circle,
      ward:              work.ward,
      current_stage:     work.current_stage,
      status:            work.status,
      next_stage:        getNextStageInHierarchy(work.current_stage),
      last_submitted_at: lastSub ? lastSub.submitted_at : null,
      last_submitted_by: lastSub ? lastSub.submitted_by : null,
      last_from_stage:   lastSub ? lastSub.from_stage   : null,
      last_to_stage:     lastSub ? lastSub.to_stage     : null
    });

  } catch (err) {
    console.error('works/check error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── GET /api/works/by-name?q=<query> ────────────────────────────
// Search work by work_id or name_of_work — returns first match with stage info
app.get('/api/works/by-name', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json(null);

  try {
    // Try exact work_id first, then name match
    const sql = `
      SELECT DISTINCT ON (work_id)
        work_id, name_of_work, division, circle, ward,
        current_stage, status, edited_by, created_at
      FROM work_order_items
      WHERE work_id = $1 OR LOWER(name_of_work) LIKE LOWER($2)
      ORDER BY work_id, created_at DESC
      LIMIT 1
    `;
    const result = await pool.query(sql, [q, `%${q}%`]);
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('works/by-name error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── WORKFLOW CONFIG ──────────────────────────────────────────────
const STAGES = ['Manager', 'DGM', 'GM', 'CGM', 'Director'];

function getNextStage(current) {
  const idx = STAGES.indexOf(current);
  return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
}

function getDesignationStage(designation) {
  // Map designation to stage name
  const map = {
    'Manager':  'Manager',
    'DGM':      'DGM',
    'GM':       'GM',
    'CGM':      'CGM',
    'Director': 'Director'
  };
  return map[designation] || null;
}

// ── GET /api/works?stage=Manager ─────────────────────────────────
// Returns all unique work_ids at a given stage with their details
app.get('/api/works', async (req, res) => {
  const { stage, ward } = req.query;
  if (!stage) return res.status(400).json({ error: 'stage is required' });

  try {
    let sql, params;
    if (stage === 'Manager' && ward) {
      // Manager sees only their ward works in draft/their stage
      sql = `
        SELECT DISTINCT ON (work_id)
          work_id, name_of_work, division, circle, ward,
          current_stage, status, edited_by, created_at
        FROM work_order_items
        WHERE current_stage = $1 AND ward = $2
        ORDER BY work_id, created_at DESC
      `;
      params = [stage, ward];
    } else {
      // Higher designations see all works at their stage
      sql = `
        SELECT DISTINCT ON (work_id)
          work_id, name_of_work, division, circle, ward,
          current_stage, status, edited_by, created_at
        FROM work_order_items
        WHERE current_stage = $1
        ORDER BY work_id, created_at DESC
      `;
      params = [stage];
    }
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch works error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── GET /api/works/:workId/items ─────────────────────────────────
// Returns all items for a given work_id
app.get('/api/works/:workId/items', async (req, res) => {
  const { workId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM work_order_items WHERE work_id = $1 ORDER BY sl_no`,
      [workId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch work items error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── GET /api/works/:workId/abstract ──────────────────────────────
app.get('/api/works/:workId/abstract', async (req, res) => {
  const { workId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM abstracts WHERE work_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [workId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Abstract not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Fetch abstract error:', err.message);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// ── POST /api/works/:workId/submit ───────────────────────────────
// Submits work to next stage
app.post('/api/works/:workId/submit', async (req, res) => {
  const { workId } = req.params;
  const { submittedBy, designation, remarks } = req.body;

  const currentStage = getDesignationStage(designation);
  if (!currentStage) {
    return res.status(400).json({ error: 'Invalid designation' });
  }

  const nextStage = getNextStage(currentStage);
  if (!nextStage) {
    return res.status(400).json({ error: 'Already at final stage (Director)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update work_order_items to next stage
    await client.query(
      `UPDATE work_order_items
       SET current_stage = $1, status = 'submitted', submitted_by = $2
       WHERE work_id = $3`,
      [nextStage, submittedBy, workId]
    );

    // Update abstract to next stage
    await client.query(
      `UPDATE abstracts SET current_stage = $1, status = 'submitted'
       WHERE work_id = $2`,
      [nextStage, workId]
    );

    // Log submission
    await client.query(
      `INSERT INTO work_submissions (work_id, from_stage, to_stage, submitted_by, remarks)
       VALUES ($1, $2, $3, $4, $5)`,
      [workId, currentStage, nextStage, submittedBy, remarks || '']
    );

    await client.query('COMMIT');
    res.json({ success: true, fromStage: currentStage, toStage: nextStage });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Submit error:', err.message);
    res.status(500).json({ error: 'Submit failed', detail: err.message });
  } finally {
    client.release();
  }
});

// ── PUT /api/works/:workId/items ─────────────────────────────────
// Update items (for DGM/GM/CGM/Director edits)
app.put('/api/works/:workId/items', async (req, res) => {
  const { workId } = req.params;
  const { items, editedBy } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const item of items) {
      await client.query(
        `UPDATE work_order_items
         SET description=$1, numbers=$2, length=$3, breadth=$4, depth=$5,
             quantity=$6, unit=$7, rate=$8, amount=$9, edited_by=$10
         WHERE work_id=$11 AND item_id=$12`,
        [item.description, item.numbers, item.length, item.breadth, item.depth,
         item.quantity, item.unit, item.rate, item.amount, editedBy,
         workId, item.item_id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update items error:', err.message);
    res.status(500).json({ error: 'Update failed', detail: err.message });
  } finally {
    client.release();
  }
});

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start server ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});