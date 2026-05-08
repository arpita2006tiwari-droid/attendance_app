import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP and PDF are allowed.'));
    }
  }
});

// Initialize SQLite database
const dbPath = join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Connected to SQLite database');
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS centres (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          sport TEXT NOT NULL,
          age INTEGER,
          phone TEXT,
          address TEXT,
          school TEXT,
          centre_id INTEGER,
          serial_number TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (centre_id) REFERENCES centres (id)
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
          centre_id INTEGER,
          status TEXT CHECK( status IN ('Present','Absent') ) NOT NULL,
          marked_by TEXT,
          updated_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME,
          FOREIGN KEY (student_id) REFERENCES students (id),
          FOREIGN KEY (centre_id) REFERENCES centres (id),
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

      db.run(`
        CREATE TABLE IF NOT EXISTS documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          document_type TEXT,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES students (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          sport TEXT,
          coach_name TEXT,
          date TEXT NOT NULL,
          session TEXT NOT NULL,
          session_time TEXT,
          focus_area TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, session, session_time)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS session_images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          file_name TEXT NOT NULL,
          original_name TEXT NOT NULL,
          caption TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions (id)
        )
      `);

      db.run(`
        CREATE TABLE IF NOT EXISTS student_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          coach_name TEXT,
          note_type TEXT, -- 'Active', 'Injured', 'Excellent', 'Needs Improvement'
          content TEXT,
          date TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (student_id) REFERENCES students (id)
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
      
      // Migration: Add columns to existing tables if missing
      db.run("ALTER TABLE attendance ADD COLUMN school_name TEXT", (err) => {
        if (!err) {
          db.run(`
            UPDATE attendance 
            SET school_name = (SELECT school FROM students WHERE students.id = attendance.student_id)
            WHERE school_name IS NULL
          `);
        }
      });

      db.run("ALTER TABLE attendance ADD COLUMN marked_by TEXT", (err) => {});
      db.run("ALTER TABLE attendance ADD COLUMN updated_by TEXT", (err) => {});
      db.run("ALTER TABLE attendance ADD COLUMN updated_at DATETIME", (err) => {});
      db.run("ALTER TABLE attendance ADD COLUMN centre_id INTEGER", (err) => {});

      db.run("ALTER TABLE students ADD COLUMN centre_id INTEGER", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN serial_number TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN parent_name TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN email TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN joining_date TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN school_id_number TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN aadhaar_number TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN profile_photo TEXT", (err) => {});
      db.run("ALTER TABLE students ADD COLUMN updated_at DATETIME", (err) => {});
      
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
      s.centre_id,
      s.serial_number,
      s.parent_name,
      s.email,
      s.joining_date,
      s.school_id_number,
      s.aadhaar_number,
      s.profile_photo,
      c.name as centre_name,
      COUNT(a.id) as total_classes,
      SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_classes
    FROM students s
    LEFT JOIN attendance a ON s.id = a.student_id
    LEFT JOIN centres c ON s.centre_id = c.id
    WHERE 1=1
  `;
  const params = [];
  let queryWithFilter = query;
  if (req.query.school) {
    queryWithFilter += ' AND s.school = ?';
    params.push(req.query.school);
  }
  if (req.query.centre_id) {
    queryWithFilter += ' AND s.centre_id = ?';
    params.push(req.query.centre_id);
  }
  
  const finalQuery = queryWithFilter + ` GROUP BY s.id, s.name, s.sport, s.centre_id, s.serial_number, c.name ORDER BY CAST(s.serial_number AS INTEGER) ASC, s.name ASC`;
  
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
        centre_id: r.centre_id,
        centre_name: r.centre_name,
        serial_number: r.serial_number,
        parent_name: r.parent_name,
        email: r.email,
        joining_date: r.joining_date,
        school_id_number: r.school_id_number,
        aadhaar_number: r.aadhaar_number,
        profile_photo: r.profile_photo,
        percentage,
        health,
        total_classes: r.total_classes
      };
    });
    
    res.json(studentsWithStats);
  });
});

 app.post('/api/students', upload.fields([
  { name: 'profile_photo', maxCount: 1 }
]), (req, res) => {
  const { name, sport, age, phone, address, school, centre_id, serial_number, parent_name, email, joining_date, school_id_number, aadhaar_number } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Name and sport are required' });
  
  if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number)) {
    return res.status(400).json({ error: 'Aadhaar must be exactly 12 numeric digits' });
  }

  const profile_photo = req.files && req.files['profile_photo'] ? req.files['profile_photo'][0].filename : null;

  db.run('INSERT INTO students (name, sport, age, phone, address, school, centre_id, serial_number, parent_name, email, joining_date, school_id_number, aadhaar_number, profile_photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [name, sport, age, phone, address, school, centre_id || null, serial_number || null, parent_name || null, email || null, joining_date || null, school_id_number || null, aadhaar_number || null, profile_photo], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, sport, age, phone, address, school, centre_id, serial_number, parent_name, email, joining_date, school_id_number, aadhaar_number, profile_photo });
  });
});

app.put('/api/students/:id', upload.fields([
  { name: 'profile_photo', maxCount: 1 }
]), (req, res) => {
  const { name, sport, age, phone, address, school, centre_id, serial_number, parent_name, email, joining_date, school_id_number, aadhaar_number } = req.body;
  const { id } = req.params;

  if (aadhaar_number && !/^\d{12}$/.test(aadhaar_number)) {
    return res.status(400).json({ error: 'Aadhaar must be exactly 12 numeric digits' });
  }

  let profile_photo = req.body.profile_photo; // Preserve existing if not changed
  if (req.files && req.files['profile_photo']) {
    profile_photo = req.files['profile_photo'][0].filename;
  }

  db.run('UPDATE students SET name = ?, sport = ?, age = ?, phone = ?, address = ?, school = ?, centre_id = ?, serial_number = ?, parent_name = ?, email = ?, joining_date = ?, school_id_number = ?, aadhaar_number = ?, profile_photo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
    [name, sport, age, phone, address, school, centre_id || null, serial_number || null, parent_name || null, email || null, joining_date || null, school_id_number || null, aadhaar_number || null, profile_photo, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, name, sport, age, phone, address, school, centre_id, serial_number, parent_name, email, joining_date, school_id_number, aadhaar_number, profile_photo });
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
  const { date, session, centre_id } = req.query;
  let query = `
    SELECT a.*, s.name as student_name, s.sport, s.serial_number, c.name as centre_name
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    LEFT JOIN centres c ON a.centre_id = c.id
  `;
  const params = [];
  const filters = [];

  if (date) { filters.push('a.date = ?'); params.push(date); }
  if (session) { filters.push('a.session = ?'); params.push(session); }
  if (req.query.session_time) { filters.push('a.session_time = ?'); params.push(req.query.session_time); }
  if (centre_id) { filters.push('a.centre_id = ?'); params.push(centre_id); }

  if (filters.length > 0) {
    query += ' WHERE ' + filters.join(' AND ');
  }
  
  query += ' ORDER BY a.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/attendance', (req, res) => {
  const { records, date, session, session_time, coach_name, centre_id } = req.body;
  
  if (!records || !Array.isArray(records) || !date || !session || !coach_name) {
    return res.status(400).json({ error: 'Missing required fields for bulk submission' });
  }

  const stmt = db.prepare(`
    INSERT INTO attendance (student_id, school_name, centre_id, date, session, session_time, status, marked_by, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(student_id, date, session, session_time) DO UPDATE SET 
      status = excluded.status,
      school_name = excluded.school_name,
      centre_id = excluded.centre_id,
      updated_by = excluded.marked_by,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.serialize(() => {
    db.run("BEGIN TRANSACTION");
    records.forEach(record => {
      // Find the current school for this student to store in attendance
      db.get('SELECT school FROM students WHERE id = ?', [record.student_id], (err, sRow) => {
        const currentSchool = sRow ? sRow.school : null;
        stmt.run([record.student_id, currentSchool, centre_id || null, date, session, session_time || null, record.status, coach_name, coach_name]);
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

// 4. Centres API
app.get('/api/centres', (req, res) => {
  db.all('SELECT * FROM centres ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/centres', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  db.run('INSERT INTO centres (name) VALUES (?)', [name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Centre already exists' });
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, name });
  });
});

// 5. Documents API
app.get('/api/students/:id/documents', (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM documents WHERE student_id = ? ORDER BY uploaded_at DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/students/:id/documents', (req, res) => {
  upload.single('document')(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { id } = req.params;
    const { document_type } = req.body;
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const file_name = req.file.filename;
    const original_name = req.file.originalname;

    db.run('INSERT INTO documents (student_id, document_type, file_name, original_name) VALUES (?, ?, ?, ?)',
      [id, document_type || 'Other', file_name, original_name], function(dbErr) {
        if (dbErr) return res.status(500).json({ error: dbErr.message });
        res.json({
          id: this.lastID,
          student_id: id,
          document_type: document_type || 'Other',
          file_name,
          original_name
        });
    });
  });
});

app.delete('/api/students/:id/documents/:docId', (req, res) => {
  const { id, docId } = req.params;
  
  db.get('SELECT file_name FROM documents WHERE id = ? AND student_id = ?', [docId, id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Document not found' });
    
    // Delete from file system
    const filePath = join(__dirname, 'uploads', row.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete from database
    db.run('DELETE FROM documents WHERE id = ?', [docId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// 6. Sessions API
app.get('/api/sessions', (req, res) => {
  db.all('SELECT * FROM sessions ORDER BY date DESC, created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sessions', (req, res) => {
  const { title, sport, coach_name, date, session, session_time, focus_area, notes } = req.body;
  db.run(`
    INSERT INTO sessions (title, sport, coach_name, date, session, session_time, focus_area, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, session, session_time) DO UPDATE SET
      title = excluded.title,
      sport = excluded.sport,
      coach_name = excluded.coach_name,
      focus_area = excluded.focus_area,
      notes = excluded.notes
  `, [title, sport, coach_name, date, session, session_time, focus_area, notes], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID || null, success: true });
  });
});

// 7. Session Images API
app.get('/api/sessions/:id/images', (req, res) => {
  db.all('SELECT * FROM session_images WHERE session_id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sessions/:id/images', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { caption } = req.body;
  const { id } = req.params;
  db.run('INSERT INTO session_images (session_id, file_name, original_name, caption) VALUES (?, ?, ?, ?)',
    [id, req.file.filename, req.file.originalname, caption], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, success: true });
    });
});

// 8. Student Notes API
app.get('/api/students/:id/notes', (req, res) => {
  db.all('SELECT * FROM student_notes WHERE student_id = ? ORDER BY date DESC, created_at DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/students/:id/notes', (req, res) => {
  const { coach_name, note_type, content, date } = req.body;
  db.run('INSERT INTO student_notes (student_id, coach_name, note_type, content, date) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, coach_name, note_type, content, date || new Date().toISOString().split('T')[0]], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, success: true });
    });
});

// 9. Insights & Stats API
app.get('/api/stats/summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStr = lastWeek.toISOString().split('T')[0];

  const results = { notices: [], presentToday: 0, totalSessionsWeek: 0 };

  // 1. Basic Stats
  db.get(`SELECT COUNT(*) as count FROM attendance WHERE date = ? AND status = 'Present'`, [today], (err, pToday) => {
    results.presentToday = pToday ? pToday.count : 0;
    
    db.get(`SELECT COUNT(DISTINCT date || session || session_time) as count FROM attendance WHERE date >= ?`, [lastWeekStr], (err, totalW) => {
      results.totalSessionsWeek = totalW ? totalW.count : 0;

      // 2. Low Attendance (< 50%)
      db.all(`
        SELECT s.name, (SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) as percentage
        FROM students s
        JOIN attendance a ON s.id = a.student_id
        GROUP BY s.id
        HAVING percentage < 50
        LIMIT 3
      `, [], (err, lows) => {
        if (lows) {
          lows.forEach(s => results.notices.push(`Low attendance detected: ${s.name} (${Math.round(s.percentage)}%)`));
        }

        // 3. Consecutive Absences (3 sessions)
        db.all(`
          SELECT student_id, name, status, date, session
          FROM (
            SELECT a.student_id, s.name, a.status, a.date, a.session,
            ROW_NUMBER() OVER (PARTITION BY a.student_id ORDER BY a.date DESC, a.session_time DESC) as rn
            FROM attendance a
            JOIN students s ON s.id = a.student_id
          )
          WHERE rn <= 3
        `, [], (err, rows) => {
          if (rows) {
            const studentHistory = {};
            rows.forEach(r => {
              if (!studentHistory[r.student_id]) studentHistory[r.student_id] = [];
              studentHistory[r.student_id].push(r.status);
            });
            Object.keys(studentHistory).forEach(sid => {
              if (studentHistory[sid].length === 3 && studentHistory[sid].every(s => s === 'Absent')) {
                const sName = rows.find(r => r.student_id == sid).name;
                results.notices.push(`${sName} missed 3 consecutive sessions`);
              }
            });
          }

          // 4. Batch Performance
          db.get(`
            SELECT session, (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as percentage
            FROM attendance
            WHERE date >= ?
            GROUP BY session
            ORDER BY percentage DESC
            LIMIT 1
          `, [lastWeekStr], (err, best) => {
            if (best) {
              results.notices.push(`${best.session} batch had the highest attendance this week (${Math.round(best.percentage)}%)`);
            }

            // 5. Injuries
            db.get(`SELECT COUNT(DISTINCT student_id) as count FROM student_notes WHERE note_type = 'Injured'`, [], (err, injured) => {
              if (injured && injured.count > 0) {
                results.notices.push(`${injured.count} students are currently marked injured`);
              }

              res.json(results);
            });
          });
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
