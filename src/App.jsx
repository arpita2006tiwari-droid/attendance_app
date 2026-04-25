import { useState, useEffect } from 'react';
import { Search, Plus, Check, X, LogOut, Activity, Info, ChevronRight, ChevronLeft, History, Moon, Clock, Download, Calendar, Filter, Users } from 'lucide-react';

export default function App() {
  const getSafeStorage = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };

  const [token, setToken] = useState(getSafeStorage('token'));
  const [coachName, setCoachName] = useState((getSafeStorage('coachName') === 'Coach Arpita' ? '' : getSafeStorage('coachName')) || '');
  const [students, setStudents] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  
  // Pending Attendance state for bulk marking
  const [pendingAttendance, setPendingAttendance] = useState({});
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const selectedSport = 'Basketball';
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [session, setSession] = useState('Morning');
  const [sessionTime, setSessionTime] = useState('');
  
  // New States for School Grouping & History Explorer
  const [currentView, setCurrentView] = useState('marking'); // 'marking' | 'explorer'
  const [selectedSchool, setSelectedSchool] = useState('All Schools');
  const [explorerStudent, setExplorerStudent] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [schools, setSchools] = useState([]);
  const [showAddSchoolModal, setShowAddSchoolModal] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Form State
  const [loginPwd, setLoginPwd] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentAge, setNewStudentAge] = useState('');
  const [newStudentPhone, setNewStudentPhone] = useState('');
  const [newStudentAddress, setNewStudentAddress] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('');

  // Info Modal State
  const [selectedStudentInfo, setSelectedStudentInfo] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sidebar State removed
  
  // History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [history, setHistory] = useState([]);
  const [studentHistory, setStudentHistory] = useState([]);
  const [explorerHistory, setExplorerHistory] = useState([]);

  const fetchData = async () => {
    try {
      const schoolParam = selectedSchool === 'All Schools' ? '' : `?school=${encodeURIComponent(selectedSchool)}`;
      const resStudents = await fetch(`/api/students${schoolParam}`);
      const dataStudents = await resStudents.json();
      
      const resAttendance = await fetch(`/api/attendance?date=${attendanceDate}&session=${session}&session_time=${sessionTime}`);
      const dataAttendance = await resAttendance.json();

      // We merge the daily attendance status directly into the students array for easy rendering
      const mergedStudents = (dataStudents || []).map(s => {
        const record = (dataAttendance || []).find(a => a.student_id === s.id);
        return {
          ...s,
          currentStatus: record ? record.status : null
        };
      });
      setStudents(mergedStudents);

      // Initialize pendingAttendance from existing records
      const initialPending = {};
      let marked = false;
      (dataAttendance || []).forEach(a => {
        initialPending[a.student_id] = a.status;
        marked = true;
      });
      setPendingAttendance(initialPending);
      setIsAlreadyMarked(marked);
      setIsEditing(!marked); // Default to editing if not marked, else locked

      const resRecent = await fetch('/api/attendance');
      const dataRecent = await resRecent.json();
      setRecentAttendance((dataRecent || []).slice(0, 10)); // Top 10 recent

      const resSchools = await fetch('/api/schools');
      const dataSchools = await resSchools.json();
      setSchools(dataSchools || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    const fetchExplorerData = async () => {
      if (!explorerStudent) return;
      try {
        const res = await fetch(`/api/attendance/student/${explorerStudent.id}`);
        const data = await res.json();
        setExplorerHistory(data || []);
      } catch (err) {
        console.error('Failed to fetch explorer history');
      }
    };
    fetchExplorerData();
  }, [explorerStudent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'soft');
    if (token) fetchData();
    
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [token, attendanceDate, session, sessionTime, selectedSchool]);

  const addSchool = async (e) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    try {
      const res = await fetch('/api/schools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSchoolName })
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setNewSchoolName('');
        setShowAddSchoolModal(false);
        fetchData();
      }
    } catch (err) {
      alert('Failed to add school');
    }
  };



  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: loginPwd })
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        setCoachName(data.coach_name);
        localStorage.setItem('token', data.token);
        localStorage.setItem('coachName', data.coach_name);
      } else {
        alert('Invalid password');
      }
    } catch (err) {
      alert('Login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setCoachName('');
    localStorage.removeItem('token');
    localStorage.removeItem('coachName');
  };

  const openStudentInfo = async (student) => {
    setSelectedStudentInfo(student);
    try {
      const res = await fetch(`/api/attendance/student/${student.id}`);
      const data = await res.json();
      setStudentHistory(data);
    } catch (err) {
      console.error('Failed to fetch student history');
    }
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    await fetch('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: newStudentName, 
        sport: selectedSport,
        age: newStudentAge ? parseInt(newStudentAge) : null,
        phone: newStudentPhone,
        address: newStudentAddress,
        school: newStudentSchool
      })
    });
    setNewStudentName('');
    setNewStudentAge('');
    setNewStudentPhone('');
    setNewStudentAddress('');
    setNewStudentSchool('');
    setShowAddModal(false);
    fetchData();
  };

  const deleteStudent = async (id) => {
    console.log('Attempting to delete student ID:', id);
    if (!window.confirm('Are you sure you want to delete this student? This will also remove their attendance history.')) {
      return;
    }
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSelectedStudentInfo(null);
        fetchData();
      }
    } catch (err) {
      alert('Failed to delete student');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const markAttendanceLocally = (studentId, status) => {
    setPendingAttendance(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const submitBulkAttendance = async () => {
    if (!coachName.trim()) {
      alert('Please enter coach name before submitting.');
      return;
    }

    if (isAlreadyMarked) {
      if (!window.confirm('Attendance already marked for this session. Do you want to update it?')) {
        return;
      }
    }

    const records = Object.entries(pendingAttendance).map(([id, status]) => ({
      student_id: parseInt(id),
      status
    }));

    if (records.length === 0) {
      alert('Please mark attendance for at least one student.');
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records,
          date: attendanceDate,
          session,
          session_time: sessionTime,
          coach_name: coachName
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Attendance submitted successfully!');
        // Reset everything to "New Attendance" (Today's Morning Session)
        setAttendanceDate(new Date().toISOString().split('T')[0]);
        setSession('Morning');
        setSessionTime('');
        setPendingAttendance({});
        setSearchQuery('');
        setIsEditing(true); 
        fetchData();
      }
    } catch (err) {
      alert('Failed to submit attendance');
    }
  };

  // Filter students based on sport and search query
  const filteredStudents = (students || []).filter(s => {
    if (!s) return false;
    const matchesSport = s.sport === selectedSport;
    const name = (s.name || '').toLowerCase();
    const id = String(s.student_id || '').toLowerCase();
    const query = (searchQuery || '').toLowerCase();
    return matchesSport && (name.includes(query) || id.includes(query));
  });

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main className="main-content">
          <header style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>

            {/* Row 1: Title + Icons */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h1 style={{ margin:0, fontSize:'1.25rem', fontWeight:700 }}>Hi5 Youth Foundation</h1>
              <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                <button onClick={() => { fetchHistory(); setShowHistoryModal(true); }} className="btn-icon" title="History"><Clock size={20} /></button>
                <button onClick={handleLogout} className="btn-icon" title="Logout"><LogOut size={20} /></button>
              </div>
            </div>

            {/* Row 2: Tab Toggle */}
            <div style={{ display:'flex', background:'var(--bg-alt)', borderRadius:'10px', padding:'4px', gap:'4px' }}>
              <button onClick={() => setCurrentView('marking')} className={`tab-btn ${currentView==='marking'?'active':''}`} style={{ flex:1 }}>Mark Attendance</button>
              <button onClick={() => setCurrentView('explorer')} className={`tab-btn ${currentView==='explorer'?'active':''}`} style={{ flex:1 }}>History Explorer</button>
            </div>

            {/* Row 3: Filter Row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, background:'var(--surface-color)', border:'1px solid var(--border-color)', borderRadius:'10px', padding:'7px 10px' }}>
                <Users size={16} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                <select
                  value={selectedSchool}
                  onChange={e => setSelectedSchool(e.target.value)}
                  style={{ flex:1, border:'none', background:'transparent', padding:0, fontSize:'0.9rem', color:'var(--text-primary)', outline:'none' }}
                >
                  <option>All Schools</option>
                  {(schools||[]).map(school => <option key={school.id} value={school.name}>{school.name}</option>)}
                </select>
                <button onClick={() => setShowAddSchoolModal(true)} style={{ background:'transparent', border:'none', padding:'2px', color:'var(--accent-color)', cursor:'pointer', display:'flex', alignItems:'center' }}><Plus size={16} /></button>
              </div>
              <button onClick={() => setShowAddModal(true)} className="btn-primary add-btn"><Plus size={18} /> Add Student</button>
            </div>

          </header>


        {currentView === 'marking' ? (
          <>
            {/* ── Sections wrapper ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>

              {/* Search Bar */}
              <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                <Search size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ border:'none', background:'transparent', padding:0, flex:1, outline:'none', fontSize:'0.95rem', color:'var(--text-primary)' }}
                />
              </div>

              {/* Date + Session Group */}
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>

                {/* Date Row */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                  <Calendar size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={e => setAttendanceDate(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, flex:1, fontSize:'0.9rem', color:'var(--text-primary)', outline:'none' }}
                  />
                  <button
                    onClick={() => { setAttendanceDate(new Date().toISOString().split('T')[0]); setSession('Morning'); setSessionTime(''); setIsEditing(true); }}
                    style={{ background:'transparent', border:'none', fontSize:'0.8rem', color:'var(--accent-color)', padding:'2px 8px', cursor:'pointer', fontWeight:600, flexShrink:0, borderRadius:'6px' }}
                  >Today</button>
                </div>

                {/* Session Row: dropdown + time on ONE row */}
                <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'#FFFBF5', border:'1px solid var(--border-color)', borderRadius:'12px', padding:'11px 14px' }}>
                  <Clock size={18} style={{ color:'var(--text-secondary)', flexShrink:0 }} />
                  <select
                    value={session}
                    onChange={e => setSession(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, fontSize:'0.9rem', flex:1, color:'var(--text-primary)', outline:'none' }}
                  >
                    <option>Morning</option>
                    <option>Afternoon</option>
                    <option>Evening</option>
                    <option>Match</option>
                  </select>
                  <div style={{ width:'1px', height:'18px', background:'var(--border-color)', flexShrink:0 }} />
                  <input
                    type="time"
                    value={sessionTime}
                    onChange={e => setSessionTime(e.target.value)}
                    style={{ border:'none', background:'transparent', padding:0, fontSize:'0.9rem', flex:1, minWidth:'85px', color:'var(--text-primary)', WebkitTextFillColor:'var(--text-primary)', outline:'none' }}
                  />
                </div>

              </div>

            </div> {/* end sections wrapper */


            <div style={{ border:'none', background:'transparent', boxShadow:'none' }}>
              <div className="attendance-list-compact">
                {!filteredStudents || filteredStudents.length === 0 ? (
                  <div style={{ textAlign:'center', paddingTop:'60px', paddingBottom:'32px', color:'var(--text-secondary)', opacity:0.55, fontSize:'0.9rem', letterSpacing:'0.01em' }}>No students found.</div>
                ) : (

                  filteredStudents.map(student => (
                    <div 
                      key={student.id} 
                      className={`attendance-row ${pendingAttendance[student.id] === 'Present' ? 'marked-present' : ''} ${pendingAttendance[student.id] === 'Absent' ? 'marked-absent' : ''}`}
                    >
                      <div className="student-info-compact" onClick={() => openStudentInfo(student)}>
                        <div className="avatar" style={{ width: 34, height: 34, fontSize: '0.8rem' }}>
                          {(student.name || '?').substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div className="student-name-text">{student.name}</div>
                          <div className="student-school-tag">{student.school || 'No Team'}</div>
                        </div>
                      </div>

                      <div className="pa-toggle">
                        <button 
                          className={`btn-pa ${pendingAttendance[student.id] === 'Present' ? 'active-p' : ''}`}
                          onClick={() => markAttendanceLocally(student.id, 'Present')}
                          disabled={!isEditing}
                        >
                          P
                        </button>
                        <button 
                          className={`btn-pa ${pendingAttendance[student.id] === 'Absent' ? 'active-a' : ''}`}
                          onClick={() => markAttendanceLocally(student.id, 'Absent')}
                          disabled={!isEditing}
                        >
                          A
                        </button>
                        <button 
                          className="btn-icon" 
                          onClick={() => openStudentInfo(student)}
                          style={{ padding: '4px' }}
                        >
                          <Info size={18} color="var(--text-secondary)" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Fixed Submission Bar */}
            {filteredStudents.length > 0 && isEditing && (
              <div className="fixed-submit-bar">
                <button 
                  className="btn-primary" 
                  onClick={submitBulkAttendance}
                  style={{ width: '100%', maxWidth: '400px', height: '50px', fontSize: '1.1rem' }}
                >
                  Submit Attendance
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="history-explorer">
            <div className="flex gap-4 mb-6 explorer-header">
              <div className="flex-1 info-item">
                <label className="text-sm font-bold mb-2">Select Student</label>
                <select className="w-full" value={explorerStudent?.id || ''} onChange={e => setExplorerStudent(students.find(st => st.id === parseInt(e.target.value)))}>
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.school || 'No School'})</option>)}
                </select>
              </div>
              <div className="info-item">
                <label className="text-sm font-bold mb-2">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="info-item">
                <label className="text-sm font-bold mb-2">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {explorerStudent ? (
              <div className="card p-6 explorer-content">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>{explorerStudent.name}</h2>
                    <p className="text-secondary">{explorerStudent.school || 'No School'} • {explorerStudent.sport}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-3xl font-bold text-accent">{explorerStudent.percentage}%</div>
                      <div className="text-xs text-secondary uppercase tracking-wider">Attendance</div>
                    </div>
                    <button className="btn-ghost border px-4 py-2 flex items-center gap-2" onClick={exportToCSV}>
                      <Download size={18} /> Export CSV
                    </button>
                  </div>
                </div>

                <div className="student-history-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {explorerHistory.length === 0 ? (
                    <p className="text-center py-12 text-secondary">No records found for this period.</p>
                  ) : (
                    explorerHistory.map((rec, i) => (
                      <div key={i} className="flex justify-between items-center py-4 border-bottom" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm">{rec.date}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white" style={{ fontSize: '0.65rem' }}>{rec.session}</span>
                          </div>
                          <div className="text-xs text-secondary mt-1 flex gap-4">
                            {rec.session_time && <span>🕒 {rec.session_time}</span>}
                            <span>Coach: {rec.marked_by}</span>
                          </div>
                        </div>
                        <div className={`badge ${rec.status === 'Present' ? 'regular' : 'low'}`}>{rec.status}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-24 card opacity-50">
                <Calendar size={64} className="mx-auto mb-4 text-secondary" />
                <p>Select a student to view their complete history.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedStudentInfo && (
            <div className="modal-overlay" onClick={() => setSelectedStudentInfo(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="avatar" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>{(selectedStudentInfo.name || '?').substring(0, 2).toUpperCase()}</div>
                    <div>
                      <h2 style={{ fontSize: '1.2rem' }}>{selectedStudentInfo.name}</h2>
                      <p className="text-secondary">{selectedStudentInfo.student_id}</p>
                    </div>
                  </div>
                  <button className="btn-icon" onClick={() => setSelectedStudentInfo(null)}><X size={20}/></button>
                </div>
                <div className="info-grid">
                  <div className="info-item"><span className="text-secondary text-sm font-medium">Age</span><span>{selectedStudentInfo.age || 'N/A'}</span></div>
                  <div className="info-item"><span className="text-secondary text-sm font-medium">Phone</span><span>{selectedStudentInfo.phone || 'N/A'}</span></div>
                  <div className="info-item"><span className="text-secondary text-sm font-medium">School</span><span>{selectedStudentInfo.school || 'N/A'}</span></div>
                  <div className="info-item"><span className="text-secondary text-sm font-medium">Status</span><span className={`badge ${(selectedStudentInfo.health || '').toLowerCase()}`}>{selectedStudentInfo.health}</span></div>
                </div>
                <div className="mt-6 pt-4 flex gap-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <button className="btn-danger flex-1" onClick={() => deleteStudent(selectedStudentInfo.id)}>Delete Student</button>
                  <button className="btn-ghost flex-1" onClick={() => setSelectedStudentInfo(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {showAddModal && (
            <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2 className="mb-6">Add New Student</h2>
                <form onSubmit={addStudent} className="flex flex-col gap-4">
                  <div className="info-item"><label className="text-sm font-medium">Name</label><input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required /></div>
                  <div className="flex gap-4">
                    <div className="info-item flex-1"><label className="text-sm font-medium">Age</label><input type="number" value={newStudentAge} onChange={e => setNewStudentAge(e.target.value)} /></div>
                    <div className="info-item flex-1">
                      <label className="text-sm font-medium">School / Team</label>
                      <select 
                        value={newStudentSchool} 
                        onChange={e => setNewStudentSchool(e.target.value)}
                        required
                      >
                        <option value="">Select School...</option>
                        {(schools || []).map(school => (
                          <option key={school.id} value={school.name}>{school.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn-primary mt-4">Save Student</button>
                </form>
              </div>
            </div>
          )}

          {showHistoryModal && (
            <div className="modal-overlay" onClick={() => setShowHistoryModal(false)}>
              <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <h2 className="mb-6">Recent Sessions</h2>
                <div className="student-history-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {(history || []).map((h, i) => (
                    <div key={i} className="p-4 border rounded-lg mb-2 cursor-pointer hover:border-accent" onClick={() => { setAttendanceDate(h.date); setSession(h.session); setShowHistoryModal(false); }}>
                      <div className="font-bold">{h.date}</div>
                      <div className="text-sm text-secondary">{h.session} • By {h.marked_by}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showAddSchoolModal && (
            <div className="modal-overlay" onClick={() => setShowAddSchoolModal(false)}>
              <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                  <h2 style={{ fontSize: '1.2rem' }}>Add New School/Team</h2>
                  <button className="btn-icon" onClick={() => setShowAddSchoolModal(false)}><X size={20}/></button>
                </div>
                
                <form onSubmit={addSchool} className="flex flex-col gap-4">
                  <div className="info-item">
                    <label className="text-sm font-medium">School Name</label>
                    <input 
                      type="text" 
                      placeholder="Enter name (e.g., Arnold's)" 
                      value={newSchoolName}
                      onChange={e => setNewSchoolName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="mt-4">
                    <button type="submit" className="btn-primary w-full" style={{ width: '100%' }}>Add School</button>
                  </div>
                </form>
              </div>
            </div>
          )}
    </div>
  );
}
