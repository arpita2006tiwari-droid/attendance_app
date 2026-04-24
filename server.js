import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const dbPath = join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          sport TEXT NOT NULL,
          age INTEGER,
          phone TEXT,
          address TEXT,
          school TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER,
          date TEXT NOT NULL,
          session TEXT NOT NULL,
          session_time TEXT,
          school_name TEXT,
          status TEXT CHECK( status IN ('Present','Absent') ) NOT NULL,
          marked_by TEXT,
          updated_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME,
          FOREIGN KEY (student_id) REFERENCES students (id),
          UNIQUE(student_id, date, session, session_time)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS schools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Migration: Backfill schools table from existing students
      db.all("SELECT DISTINCT school FROM students WHERE school IS NOT NULL AND school != ''", (err, rows) => {
        if (!err && rows) {
          rows.forEach(row => {
            db.run("INSERT OR IGNORE INTO schools (name) VALUES (?)", [row.school]);
          });
        }
      });
      
      // Migration: Add school_name to existing records if missing
      db.run("ALTER TABLE attendance ADD COLUMN school_name TEXT", (err) => {
        if (!err) {
          console.log("Migration: Added school_name column to attendance table");
          // Backfill school_name from students table
          db.run(`
            UPDATE attendance 
            SET school_name = (SELECT school FROM students WHERE students.id = attendance.student_id)
            WHERE school_name IS NULL
          `);
        }
      });

      // Add columns if they don't exist (migration)
      db.run("ALTER TABLE attendance ADD COLUMN marked_by TEXT", (err) => {});
      db.run("ALTER TABLE attendance ADD COLUMN updated_by TEXT", (err) => {});
      db.run("ALTER TABLE attendance ADD COLUMN updated_at DATETIME", (err) => {});
      
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_attendance
        ON attendance(student_id, date, session)
      `);
    });
  }
});

// --- API ROUTES ---

// 1. Auth (Minimal hardcoded login)
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === 'coach123') {
    // Hardcoded for now as per requirements
    res.json({ success: true, token: 'coach-token', coach_name: 'Coach Arpita' });
  } else {
    res.status(401).json({ success: false, message: 'Invalid password' });
  }
});

// 2. Students CRUD (Now includes calculated attendance percentage)
app.get('/api/students', (req, res) => {
  const query = `
    SELECT 
      s.id, 
      s.name, 
      s.sport,
      s.age,
      s.phone,
      s.address,
      s.school,
      COUNT(a.id) as total_classes,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_classes
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id
    WHERE 1=1
  `;
  const params = [];
  let queryWithFilter = query;
  if (req.query.school) {
    queryWithFilter = queryWithFilter.replace('WHERE 1=1', 'WHERE s.school = ?');
    params.push(req.query.school);
  }
  
  const finalQuery = queryWithFilter + ` GROUP BY s.id, s.name, s.sport ORDER BY s.name ASC`;
  
  db.all(finalQuery, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const studentsWithStats = rows.map(r => {
      let percentage = 0;
      if (r.total_classes > 0) {
        percentage = Math.round((r.present_classes / r.total_classes) * 100);
      } else {
        percentage = 100; // Default if no classes yet
      }
      
      let health = 'Regular';
      if (percentage < 50) health = 'Low';
      else if (percentage < 75) health = 'Irregular';
      
      return {
        id: r.id,
        student_id: `STU-${String(r.id).padStart(3, '0')}`,
        name: r.name,
        sport: r.sport,
        age: r.age,
        phone: r.phone,
        address: r.address,
        school: r.school,
        percentage,
        health,
        total_classes: r.total_classes
      };
    });
    
    res.json(studentsWithStats);
  });
});

app.post('/api/students', (req, res) => {
  const { name, sport, age, phone, address, school } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Name and sport are required' });
  db.run('INSERT INTO students (name, sport, age, phone, address, school) VALUES (?, ?, ?, ?, ?, ?)', 
    [name, sport, age, phone, address, school], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, sport, age, phone, address, school });
  });
});

app.put('/api/students/:id', (req, res) => {
  const { name, sport, age, phone, address, school } = req.body;
  const { id } = req.params;
  db.run('UPDATE students SET name = ?, sport = ?, age = ?, phone = ?, address = ?, school = ? WHERE id = ?', 
    [name, sport, age, phone, address, school, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, name, sport, age, phone, address, school });
  });
});

app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM students WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// 2.5 History (Unique sessions)
app.get('/api/history', (req, res) => {
  const query = `
    SELECT date, session, session_time, marked_by, MAX(created_at) as created_at
    FROM attendance
    GROUP BY date, session, session_time
    ORDER BY date DESC, created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 2.6 Individual Student History
app.get('/api/attendance/student/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT a.*, s.name as student_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.student_id = ?
  `;
  const params = [id];
  let filterPart = "";
  if (req.query.startDate) {
    filterPart += " AND a.date >= ?";
    params.push(req.query.startDate);
  }
  if (req.query.endDate) {
    filterPart += " AND a.date <= ?";
    params.push(req.query.endDate);
  }
  if (req.query.session) {
    filterPart += " AND a.session = ?";
    params.push(req.query.session);
  }

  const finalQuery = query + filterPart + " ORDER BY a.date DESC, a.created_at DESC";
  db.all(finalQuery, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 3. Attendance
app.get('/api/attendance', (req, res) => {
  const { date, session } = req.query;
  let query = `
    SELECT a.*, s.name as student_name, s.sport 
    FROM attendance a
    JOIN students s ON a.student_id = s.id
  `;
  const params = [];

  if (date && session) {
    query += ' WHERE a.date = ? AND a.session = ?';
    if (req.query.session_time) {
      query += ' AND a.session_time = ?';
      params.push(date, session, req.query.session_time);
    } else {
      params.push(date, session);
    }
  }
  
  query += ' ORDER BY a.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/attendance', (req, res) => {
  const { records, date, session, coach_name } = req.body;
  
  if (!records || !Array.isArray(records) || !date || !session || !coach_name) {
    return res.status(400).json({ error: 'Missing required fields for bulk submission' });
  }

  const stmt = db.prepare(`
    INSERT INTO attendance (student_id, school_name, date, session, session_time, status, marked_by, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, date, session, session_time) DO UPDATE SET 
      status = excluded.status,
      school_name = excluded.school_name,
      updated_by = excluded.marked_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    records.forEach(record => {
      // Find the current school for this student to store in attendance
      db.get('SELECT school FROM students WHERE id = ?', [record.student_id], (err, sRow) => {
        const currentSchool = sRow ? sRow.school : null;
        stmt.run([record.student_id, currentSchool, date, session, session_time || null, record.status, coach_name, coach_name]);
      });
    });
    db.run("COMMIT", (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, count: records.length });
    });
  });
  stmt.finalize();
});

// 2.7 Schools API
app.get('/api/schools', (req, res) => {
  db.all('SELECT * FROM schools ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/schools', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.run('INSERT INTO schools (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'School already exists' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, name });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
